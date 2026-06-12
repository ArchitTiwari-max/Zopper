import * as XLSX from 'xlsx';
import * as path from 'path';
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
  // Noise words to ignore during token comparisons
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

  if (tokens1.size === 0 && tokens2.size === 0) return 0;

  let intersectionCount = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersectionCount++;
    }
  }

  const unionCount = tokens1.size + tokens2.size - intersectionCount;
  return intersectionCount / unionCount;
}

// Combine Jaccard and Levenshtein similarity
function calculateNameSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeStoreName(s1);
  const norm2 = normalizeStoreName(s2);

  const clean1 = cleanString(norm1);
  const clean2 = cleanString(norm2);

  if (clean1 === clean2) return 1.0;

  const jaccard = jaccardSimilarity(s1, s2);
  
  const maxLen = Math.max(norm1.length, norm2.length);
  const levSim = maxLen === 0 ? 0 : 1 - levenshteinDistance(norm1, norm2) / maxLen;

  return 0.7 * jaccard + 0.3 * levSim;
}

// Simple normalization for city name
function normalizeCity(city: string): string {
  return city.toLowerCase()
    .replace(/\s+/g, '')
    .replace('ghazibad', 'ghaziabad')
    .replace('bareily', 'bareilly')
    .replace('gurgaon', 'gurugram')
    .trim();
}

async function main() {
  const inputPath = path.resolve(__dirname, '../testing/SalesDost Working Store.xlsx');
  const outputPath = path.resolve(__dirname, '../testing/SalesDost Working Store Matched.xlsx');

  console.log(`Loading input Excel file from: ${inputPath}`);
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Loaded ${data.length} records from Excel.`);

  const prisma = new PrismaClient();
  try {
    console.log('Fetching stores from database...');
    const dbStores = await prisma.store.findMany({
      select: {
        id: true,
        storeName: true,
        city: true
      }
    });
    console.log(`Loaded ${dbStores.length} stores from database.`);

    console.log('Starting store matching process...');
    const startTime = Date.now();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const excelName = row['Store Name'] || row['Store Name_1'] || '';
      const excelCity = row['City'] || '';
      const normExcelCity = normalizeCity(excelCity);

      // Phase 1: Filter DB stores by city
      const cityCandidates = dbStores.filter(dbStore => {
        const normDbCity = normalizeCity(dbStore.city || '');
        return normDbCity === normExcelCity || normDbCity.includes(normExcelCity) || normExcelCity.includes(normDbCity);
      });

      let bestMatch: any = null;
      let highestScore = -1;

      // Try matching in city candidates first
      if (cityCandidates.length > 0) {
        for (const candidate of cityCandidates) {
          const score = calculateNameSimilarity(excelName, candidate.storeName);
          if (score > highestScore) {
            highestScore = score;
            bestMatch = candidate;
          }
        }
      }

      // Phase 2: Fallback to global search only if no candidate in the city had score >= 0.30
      if (highestScore < 0.30) {
        let bestGlobalMatch: any = null;
        let highestGlobalScore = -1;

        for (const dbStore of dbStores) {
          const score = calculateNameSimilarity(excelName, dbStore.storeName);
          if (score > highestGlobalScore) {
            highestGlobalScore = score;
            bestGlobalMatch = dbStore;
          }
        }

        // Only overwrite if global match is significantly better
        if (highestGlobalScore > highestScore) {
          highestScore = highestGlobalScore;
          bestMatch = bestGlobalMatch;
        }
      }

      const percentageScore = Math.round(highestScore * 100);

      // Append new matching columns to the Excel row object
      row['DB Store ID'] = bestMatch ? bestMatch.id : 'N/A';
      row['DB Store Name'] = bestMatch ? bestMatch.storeName : 'N/A';
      row['Match Score (%)'] = percentageScore;

      // Log progress every 500 rows
      if ((i + 1) % 500 === 0) {
        console.log(`Matched ${i + 1}/${data.length} rows...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Fuzzy matching completed in ${duration} seconds.`);

    // Write updated JSON data back to Excel
    console.log(`Writing output to new Excel file: ${outputPath}`);
    const newWorksheet = XLSX.utils.json_to_sheet(data);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
    XLSX.writeFile(newWorkbook, outputPath);

    console.log('Successfully saved updated Excel file.');

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
