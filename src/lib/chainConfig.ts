import { prisma } from './prisma';

export interface RoleWeight {
  role: string;
  weight: number;
}

export interface ChainConfig {
  id: string;
  chainName: string;
  prefix: string;
  excludedStoreIds: string[];
  storeRoles: RoleWeight[];
  stakeholderRoles: RoleWeight[];
}

/**
 * Extract the chain prefix from a store name.
 * Splits on the first "-" or space and uppercases.
 * e.g. "CROMA-Delhi-Saket" → "CROMA"
 *      "VS-VIJAY SALES (SEC 18)" → "VS"
 *      "HITACHI Store Lajpat" → "HITACHI"
 */
export function extractChainPrefix(storeName: string): string {
  const upper = storeName.toUpperCase().trim();
  const dashIdx = upper.indexOf('-');
  const spaceIdx = upper.indexOf(' ');

  if (dashIdx !== -1 && (spaceIdx === -1 || dashIdx < spaceIdx)) {
    return upper.substring(0, dashIdx);
  }
  if (spaceIdx !== -1) {
    return upper.substring(0, spaceIdx);
  }
  return upper;
}

/**
 * Find the matching ChainConfig for a given storeId + storeName.
 * Returns null if no config matches or store is excluded.
 */
export async function getChainConfigForStore(
  storeId: string,
  storeName: string
): Promise<ChainConfig | null> {
  const prefix = extractChainPrefix(storeName);

  // Group minor chains under 'LOCAL' umbrella
  const potentialStores = await prisma.store.findMany({
    where: { storeName: { startsWith: prefix, mode: 'insensitive' } },
    select: { storeName: true }
  });
  const exactCount = potentialStores.filter(s => extractChainPrefix(s.storeName) === prefix).length;

  const effectivePrefix = exactCount <= 35 ? 'LOCAL' : prefix;

  const config = await prisma.storeChainConfig.findFirst({
    where: {
      prefix: effectivePrefix
    }
  });

  if (!config) return null;
  if (config.excludedStoreIds.includes(storeId)) return null;

  return {
    id: config.id,
    chainName: config.chainName,
    prefix: config.prefix,
    excludedStoreIds: config.excludedStoreIds,
    storeRoles: config.storeRoles as RoleWeight[],
    stakeholderRoles: config.stakeholderRoles as RoleWeight[],
  };
}

/**
 * Calculate the alignment score for a store using its chain config.
 * Returns 0 if no chain config exists.
 */
export function calculateAlignmentScore(
  storeLevel: any[],
  stakeholderLevel: any[],
  chainConfig: ChainConfig | null
): number {
  if (!chainConfig) return 0;

  const isRoleAligned = (roleName: string, levelData: any[]): boolean => {
    const roleEntry = levelData.find(
      (r: any) => r.role?.trim().toUpperCase() === roleName.toUpperCase()
    );
    if (!roleEntry || !roleEntry.personnel) return false;
    return roleEntry.personnel.some(
      (p: any) =>
        p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '')
    );
  };

  let score = 0;

  for (const { role, weight } of chainConfig.storeRoles) {
    if (isRoleAligned(role, storeLevel)) score += weight;
  }
  for (const { role, weight } of chainConfig.stakeholderRoles) {
    if (isRoleAligned(role, stakeholderLevel)) score += weight;
  }

  return Math.min(score, 100);
}

/**
 * Load all chain configs from DB.
 */
export async function getAllChainConfigs(): Promise<ChainConfig[]> {
  const configs = await prisma.storeChainConfig.findMany({
    orderBy: { chainName: 'asc' }
  });

  return configs.map(c => ({
    id: c.id,
    chainName: c.chainName,
    prefix: c.prefix,
    excludedStoreIds: c.excludedStoreIds,
    storeRoles: c.storeRoles as RoleWeight[],
    stakeholderRoles: c.stakeholderRoles as RoleWeight[],
  }));
}
