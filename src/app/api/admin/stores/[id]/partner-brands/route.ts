import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PartnerBrandType } from '@prisma/client';

export const runtime = 'nodejs';

// Map display values to enum stored in DB
const typeToEnum = (t: string): PartnerBrandType | null => {
  const v = (t || '').toUpperCase();
  if (v === 'A+' || v === 'A_PLUS') return PartnerBrandType.A_PLUS;
  if (v === 'A') return PartnerBrandType.A;
  if (v === 'B') return PartnerBrandType.B;
  if (v === 'C') return PartnerBrandType.C;
  if (v === 'D') return PartnerBrandType.D;
  if (v === 'NONE') return PartnerBrandType.NONE;
  return null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    // Await params in Next.js 15
    const { id: storeId } = await params;
    const body = await request.json().catch(() => ({}));
    const brandId: string | undefined = body?.brandId;
    const brandTypeRaw: string | undefined = body?.brandType;

    if (!brandId || !brandTypeRaw) {
      return NextResponse.json({ error: 'brandId and brandType are required' }, { status: 400 });
    }

    const brandType = typeToEnum(brandTypeRaw);
    if (!brandType) {
      return NextResponse.json({ error: 'Invalid brandType. Use one of A+, A, B, C, D, NONE' }, { status: 400 });
    }

    // Validate store
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Validate brand
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Upsert StoreBrand join table record
    await prisma.storeBrand.upsert({
      where: {
        storeId_brandId: {
          storeId,
          brandId
        }
      },
      update: {
        brandType
      },
      create: {
        storeId,
        brandId,
        brandType
      }
    });

    // Return pretty payload with names and types
    const updatedStoreBrands = await prisma.storeBrand.findMany({
      where: { storeId },
      include: { brand: { select: { brandName: true } } }
    });

    const pairs = updatedStoreBrands.map(sb => ({
      id: sb.brandId,
      name: sb.brand.brandName,
      type: sb.brandType
    }));

    return NextResponse.json({ success: true, store: { id: storeId, partnerBrandPairs: pairs } });
  } catch (e) {
    console.error('Update partner brands error:', e);
    return NextResponse.json({ error: 'Failed to update partner brands' }, { status: 500 });
  }
}
