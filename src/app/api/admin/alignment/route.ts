import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// ─── City → SVG Coordinate Map ────────────────────────────────────────────────
// These coordinates correspond to the India SVG viewBox used in IndiaMap.tsx
const CITY_COORDS: Record<string, { x: number; y: number; state: string }> = {
  // Maharashtra
  'mumbai': { x: 175, y: 490, state: 'Maharashtra' },
  'pune': { x: 188, y: 508, state: 'Maharashtra' },
  'nagpur': { x: 255, y: 440, state: 'Maharashtra' },
  'nashik': { x: 188, y: 468, state: 'Maharashtra' },
  'thane': { x: 178, y: 488, state: 'Maharashtra' },
  'aurangabad': { x: 215, y: 472, state: 'Maharashtra' },

  // Delhi / NCR
  'delhi': { x: 240, y: 230, state: 'Delhi' },
  'new delhi': { x: 240, y: 230, state: 'Delhi' },
  'gurgaon': { x: 242, y: 238, state: 'Haryana' },
  'gurugram': { x: 242, y: 238, state: 'Haryana' },
  'noida': { x: 248, y: 234, state: 'Uttar Pradesh' },
  'faridabad': { x: 246, y: 240, state: 'Haryana' },
  'ghaziabad': { x: 248, y: 230, state: 'Uttar Pradesh' },

  // Karnataka
  'bangalore': { x: 225, y: 590, state: 'Karnataka' },
  'bengaluru': { x: 225, y: 590, state: 'Karnataka' },
  'mysuru': { x: 218, y: 608, state: 'Karnataka' },
  'mysore': { x: 218, y: 608, state: 'Karnataka' },
  'hubli': { x: 198, y: 560, state: 'Karnataka' },
  'mangalore': { x: 196, y: 588, state: 'Karnataka' },

  // Tamil Nadu
  'chennai': { x: 258, y: 616, state: 'Tamil Nadu' },
  'coimbatore': { x: 224, y: 638, state: 'Tamil Nadu' },
  'madurai': { x: 244, y: 652, state: 'Tamil Nadu' },

  // Telangana / Andhra
  'hyderabad': { x: 248, y: 530, state: 'Telangana' },
  'secunderabad': { x: 252, y: 528, state: 'Telangana' },
  'visakhapatnam': { x: 295, y: 522, state: 'Andhra Pradesh' },

  // Gujarat
  'ahmedabad': { x: 163, y: 370, state: 'Gujarat' },
  'surat': { x: 162, y: 415, state: 'Gujarat' },
  'vadodara': { x: 172, y: 390, state: 'Gujarat' },
  'rajkot': { x: 138, y: 368, state: 'Gujarat' },

  // Rajasthan
  'jaipur': { x: 218, y: 272, state: 'Rajasthan' },
  'jodhpur': { x: 185, y: 285, state: 'Rajasthan' },
  'udaipur': { x: 194, y: 320, state: 'Rajasthan' },

  // Uttar Pradesh
  'lucknow': { x: 290, y: 278, state: 'Uttar Pradesh' },
  'kanpur': { x: 284, y: 286, state: 'Uttar Pradesh' },
  'agra': { x: 258, y: 264, state: 'Uttar Pradesh' },
  'varanasi': { x: 318, y: 302, state: 'Uttar Pradesh' },

  // West Bengal
  'kolkata': { x: 370, y: 378, state: 'West Bengal' },

  // Punjab / Chandigarh
  'chandigarh': { x: 228, y: 190, state: 'Chandigarh' },
  'ludhiana': { x: 216, y: 188, state: 'Punjab' },
  'amritsar': { x: 204, y: 182, state: 'Punjab' },

  // Madhya Pradesh
  'bhopal': { x: 245, y: 368, state: 'Madhya Pradesh' },
  'indore': { x: 220, y: 378, state: 'Madhya Pradesh' },

  // Kerala
  'kochi': { x: 218, y: 660, state: 'Kerala' },
  'thiruvananthapuram': { x: 220, y: 690, state: 'Kerala' },

  // Odisha
  'bhubaneswar': { x: 338, y: 428, state: 'Odisha' },
};

const getCityCoords = (city: string): { x: number; y: number; state: string } => {
  const key = city.toLowerCase().trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  // Partial match
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Default: center of India
  return { x: 260, y: 420, state: 'Maharashtra' };
};

/**
 * GET: Fetch all store alignment data for the Admin Dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterState = searchParams.get('state');

    const stores = await prisma.store.findMany({
      include: {
        alignment: true,
        executiveStores: {
          include: {
            executive: {
              select: { name: true }
            }
          }
        }
      }
    });

    const transformedData = stores
      .filter(store => {
        const upperName = store.storeName.toUpperCase();
        const includesBrand = upperName.includes('CROMA') || upperName.includes('VS') || upperName.includes('RELIANCE');
        if (!includesBrand) return false;

        if (filterState) {
          const coords = getCityCoords(store.city || '');
          return coords.state.toLowerCase() === filterState.toLowerCase();
        }

        return true;
      })
      .map(store => {
        const alignment = store.alignment;
        const storeType = store.storeName.toUpperCase().includes('CROMA') ? 'Croma' :
            store.storeName.toUpperCase().includes('RELIANCE') ? 'Reliance' : 'Vijay Sales';

        let score = 0;

        if (alignment) {
          const storeLevel = (alignment.storeLevel as any[]) || [];
          const stakeholderLevel = (alignment.stakeholderLevel as any[]) || [];

          const isRoleAligned = (roleName: string, levelData: any[]) => {
            const roleEntry = levelData.find((r: any) => r.role?.trim().toUpperCase() === roleName.toUpperCase());
            if (!roleEntry || !roleEntry.personnel) return false;
            return roleEntry.personnel.some((p: any) =>
              p.name?.trim() !== '' &&
              /^[0-9]{10}$/.test(p.phone?.trim() || '')
            );
          };

          // --- Store Level Scores ---
          if (isRoleAligned('SEC', storeLevel)) score += 40;
          if (isRoleAligned('Store Manager', storeLevel)) score += 10;

          if (storeType === 'Croma') {
            if (isRoleAligned('ADM', storeLevel)) score += 20;
            if (isRoleAligned('Cluster Manager', storeLevel)) score += 5;
          } else {
            // VS / Reliance rules
            if (isRoleAligned('TL', storeLevel)) score += 20;
            if (isRoleAligned('Category Manager', storeLevel)) score += 5;
          }

          // --- Stakeholder Level Scores (Uniform) ---
          if (isRoleAligned('ABM', stakeholderLevel)) score += 5;
          if (isRoleAligned('ASE', stakeholderLevel)) score += 5;
          if (isRoleAligned('ZSE', stakeholderLevel)) score += 5;
          if (isRoleAligned('ZSM', stakeholderLevel)) score += 5;
          if (isRoleAligned('KAM', stakeholderLevel)) score += 5;
        }

        // Cap score at 100 just in case
        score = Math.min(score, 100);
        const status = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

        // Resolve x/y map coordinates from city name
        const coords = getCityCoords(store.city || '');

        // Only include heavy alignment data if a specific state is requested
        const responseData: any = {
          id: store.id,
          name: store.storeName,
          city: store.city,
          state: coords.state,
          code: store.id.toString(),
          x: coords.x,
          y: coords.y,
          storeType,
          score,
          alignment: status,
          executives: store.executiveStores.length,
        };

        if (filterState) {
          responseData.storeLevel = alignment ? alignment.storeLevel : [];
          responseData.stakeholderLevel = alignment ? alignment.stakeholderLevel : [];
        }

        return responseData;
      });

    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('Error fetching admin alignment data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
