import { PrismaClient } from '@prisma/client';

// Simple Levenshtein distance
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
}

// Normalize strings for token comparisons and replacements
function normalizeStoreName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bvs\b/g, 'vijay sales')
    .replace(/\brdc\b/g, 'raj nagar dc')
    .replace(/\brd\b/g, 'reliance digital')
    .replace(/\belectroworld\b/g, 'electro world')
    .replace(/\bindrapuram\b/g, 'indirapuram')
    .replace(/\bsec\b/g, 'sector')
    .replace(/\bsect\b/g, 'sector')
    .replace(/\bghazibad\b/g, 'ghaziabad')
    .replace(/\bbareily\b/g, 'bareilly')
    .replace(/\bgurgaon\b/g, 'gurugram')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Token-based Jaccard similarity with advanced word/noise filtering
function jaccardSimilarity(s1: string, s2: string): number {
  const noiseWords = new Set([
    'br', 'branch', 'up', 'sales', 'co', 'company', 'pvt', 'ltd', 'limited',
    'and', 'of', 'the', 'in', 'at', 'with', 'on', 'for', 'to', 'a', 'an', 'by',
    'ms', 'm', 's', 'electronics', 'electrical', 'electricals', 'electro',
    'appliances', 'home', 'store', 'stores', 'showroom', 'agency', 'agencies',
    'enterprise', 'enterprises', 'retail', 'retailer', 'retailers', 'distributor',
    'distributors', 'trader', 'traders', 'trading', 'associate', 'associates',
    'centre', 'center', 'services', 'service', 'world', 'zone'
  ]);

  const getTokens = (s: string) => {
    const norm = normalizeStoreName(s);
    return new Set(
      norm.split(/\s+/)
        .filter(t => t.length > 1 && !noiseWords.has(t)) // filter out short tokens and noise words
    );
  };

  const tokens1 = getTokens(s1);
  const tokens2 = getTokens(s2);
  console.log('tokens1:', Array.from(tokens1));
  console.log('tokens2:', Array.from(tokens2));

  if (tokens1.size === 0 && tokens2.size === 0) return 0;

  let intersectionCount = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersectionCount++;
    }
  }

  const unionCount = tokens1.size + tokens2.size - intersectionCount;
  console.log(`Jaccard intersection: ${intersectionCount}, union: ${unionCount}, Jaccard: ${intersectionCount / unionCount}`);
  return intersectionCount / unionCount;
}

// Combine Jaccard and Levenshtein similarity
function calculateNameSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeStoreName(s1);
  const norm2 = normalizeStoreName(s2);
  console.log(`norm1: "${norm1}"`);
  console.log(`norm2: "${norm2}"`);

  const clean1 = cleanString(norm1);
  const clean2 = cleanString(norm2);

  if (clean1 === clean2) {
    console.log('Clean strings match exactly! returning 1.0');
    return 1.0;
  }

  const jaccard = jaccardSimilarity(s1, s2);
  
  const maxLen = Math.max(norm1.length, norm2.length);
  const levDist = levenshteinDistance(norm1, norm2);
  const levSim = maxLen === 0 ? 0 : 1 - levDist / maxLen;
  console.log(`Levenshtein distance: ${levDist}, maxLen: ${maxLen}, Levenshtein similarity: ${levSim}`);

  const total = 0.7 * jaccard + 0.3 * levSim;
  console.log('Weighted total similarity:', total);
  return total;
}

async function main() {
  const s1 = "Vs - Up(Indirapuram) Br";
  const s2 = "VS-VIJAY SALES (INDRAPURAM)";
  console.log('Calculating similarity for:');
  console.log(`s1: "${s1}"`);
  console.log(`s2: "${s2}"`);
  const score = calculateNameSimilarity(s1, s2);
  console.log('Final rounded score:', Math.round(score * 100));
}

main().catch(console.error);
