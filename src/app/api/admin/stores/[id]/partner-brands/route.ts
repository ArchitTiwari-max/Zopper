import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Map display values to enum stored in DB
const typeToEnum = (t: string): 'A_PLUS' | 'A' | 'B' | 'C' | null => {
  const v = (t || '').toUpperCase();
  if (v === 'A+' || v === 'A_PLUS') return 'A_PLUS';
  if (v === 'A') return 'A';
  if (v === 'B') return 'B';
  if (v === 'C') return 'C';
  return null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const storeId = params.id;
    const body = await request.json().catch(() => ({}));
    const brandId: string | undefined = body?.brandId;
    const brandTypeRaw: string | undefined = body?.brandType;

    if (!brandId || !brandTypeRaw) {
      return NextResponse.json({ error: 'brandId and brandType are required' }, { status: 400 });
    }

    const brandType = typeToEnum(brandTypeRaw);
    if (!brandType) {
      return NextResponse.json({ error: 'Invalid brandType. Use one of A+, A, B, C' }, { status: 400 });
    }

    // Validate store
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Validate brand
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const ids = Array.isArray(store.partnerBrandIds) ? [...store.partnerBrandIds] : [];
    const types = Array.isArray((store as any).partnerBrandTypes) ? [ ...(store as any).partnerBrandTypes ] : [] as any[];

    const idx = ids.indexOf(brandId);
    if (idx >= 0) {
      types[idx] = brandType as any;
    } else {
      ids.push(brandId);
      types.push(brandType as any);
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: { partnerBrandIds: ids, partnerBrandTypes: types as any },
      include: { }
    });

    // Return pretty payload with names and types
    const brands = await prisma.brand.findMany({ select: { id: true, brandName: true } });
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));
    const pairs = (updated.partnerBrandIds || []).map((id: string, i: number) => ({
      id,
      name: brandMap.get(id) || 'Unknown Brand',
      type: (updated as any).partnerBrandTypes?.[i] || null
    }));

    return NextResponse.json({ success: true, store: { id: updated.id, partnerBrandPairs: pairs } });
  } catch (e) {
    console.error('Update partner brands error:', e);
    return NextResponse.json({ error: 'Failed to update partner brands' }, { status: 500 });
  }
}
