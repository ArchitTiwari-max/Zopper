import * as XLSX from 'xlsx';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

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
  const inputPath = path.resolve(__dirname, '../testing/Final Sheet-Sales Store.xlsx');
  const outputPath = path.resolve(__dirname, '../testing/Final Sheet-Sales Store Matched.xlsx');

  console.log(`Reading input Excel file: ${inputPath}`);
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  console.log(`Loaded ${data.length} records from Excel.`);

  // 1. Gather all existing Store IDs from Excel
  const existingExcelStoreIds = new Set<string>();
  for (const row of data) {
    const storeIdVal = String(row['Store ID'] || '').trim();
    const isNewStore = storeIdVal.toLowerCase().includes('new');
    if (storeIdVal !== '' && storeIdVal.toUpperCase() !== 'NA' && storeIdVal.toUpperCase() !== 'N/A' && !isNewStore) {
      existingExcelStoreIds.add(storeIdVal);
    }
  }
  console.log(`Found ${existingExcelStoreIds.size} unique existing store IDs in Excel.`);

  // 2. Connect to Database using MongoClient
  const uri = process.env.DATABASE_URL || "";
  console.log('Connecting to database...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Fetching all stores from DB...');
    const allDbStores = await db.collection('Store').find({}).toArray();
    console.log(`Total database stores: ${allDbStores.length}`);

    // Fetch physical visit counts grouped by storeId
    console.log('Fetching physical visit counts from DB...');
    const visitCounts = await db.collection('Visit').aggregate([
      { $group: { _id: "$storeId", count: { $sum: 1 } } }
    ]).toArray();
    const visitCountMap = new Map<string, number>();
    for (const item of visitCounts) {
      if (item._id) {
        visitCountMap.set(String(item._id).trim(), Number(item.count || 0));
      }
    }
    console.log(`Loaded physical visit counts for ${visitCountMap.size} stores.`);

    // Filter database stores to keep only those whose ID is not already in Excel
    const dbCandidates = allDbStores.filter(store => {
      const dbId = String(store._id || '');
      return !existingExcelStoreIds.has(dbId);
    });
    console.log(`Database candidate stores for matching: ${dbCandidates.length}`);

    // 3. Perform fuzzy matching for rows with missing/NA Store ID
    console.log('Starting store matching process...');
    const startTime = Date.now();
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const storeIdVal = String(row['Store ID'] || '').trim();
      const isNewStore = storeIdVal.toLowerCase().includes('new');

      if (isNewStore) {
        // Exclude new stores from matching and analysis
        row['Matching DB Store ID'] = 'New Store (Excluded)';
        row['Matching DB Store Name'] = 'New Store (Excluded)';
        row['Matching DB Store City'] = 'New Store (Excluded)';
        row['Match Score (%)'] = '';
        row['DB Physical Visits'] = 0;
        continue;
      }

      const isMissingId = (storeIdVal === '' || storeIdVal.toUpperCase() === 'NA' || storeIdVal.toUpperCase() === 'N/A');

      if (!isMissingId) {
        // Already has a store ID, do not search
        row['Matching DB Store ID'] = 'Already Matched';
        row['Matching DB Store Name'] = 'Already Matched';
        row['Matching DB Store City'] = 'Already Matched';
        row['Match Score (%)'] = '';
        row['DB Physical Visits'] = visitCountMap.get(storeIdVal) || 0;
        continue;
      }

      const excelName = String(row['Store Name'] || '').trim();
      const excelCity = String(row['City'] || '').trim();
      const normExcelCity = normalizeCity(excelCity);

      if (excelName === '') {
        row['Matching DB Store ID'] = 'N/A (Empty Name)';
        row['Matching DB Store Name'] = 'N/A (Empty Name)';
        row['Matching DB Store City'] = 'N/A (Empty Name)';
        row['Match Score (%)'] = 0;
        row['DB Physical Visits'] = 0;
        unmatchedCount++;
        continue;
      }

      // Phase 1: Filter DB candidates by city
      const cityCandidates = dbCandidates.filter(dbStore => {
        const normDbCity = normalizeCity(String(dbStore.city || ''));
        return normDbCity === normExcelCity || normDbCity.includes(normExcelCity) || normExcelCity.includes(normDbCity);
      });

      let bestMatch: any = null;
      let highestScore = -1;

      // Try matching in city candidates first
      if (cityCandidates.length > 0) {
        for (const candidate of cityCandidates) {
          const dbName = String(candidate.storeName || candidate.name || '').trim();
          const score = calculateNameSimilarity(excelName, dbName);
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

        for (const dbStore of dbCandidates) {
          const dbName = String(dbStore.storeName || dbStore.name || '').trim();
          const score = calculateNameSimilarity(excelName, dbName);
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

      // Determine match decision based on threshold (e.g. 30%)
      if (bestMatch && highestScore >= 0.30) {
        const percentageScore = Math.round(highestScore * 100);
        const matchedId = String(bestMatch._id);
        row['Matching DB Store ID'] = matchedId;
        row['Matching DB Store Name'] = String(bestMatch.storeName || bestMatch.name || '');
        row['Matching DB Store City'] = String(bestMatch.city || 'N/A');
        row['Match Score (%)'] = percentageScore;
        row['DB Physical Visits'] = visitCountMap.get(matchedId) || 0;
        matchedCount++;
      } else {
        row['Matching DB Store ID'] = 'N/A';
        row['Matching DB Store Name'] = 'N/A';
        row['Matching DB Store City'] = 'N/A';
        row['Match Score (%)'] = Math.round(Math.max(highestScore, 0) * 100);
        row['DB Physical Visits'] = 0;
        unmatchedCount++;
      }

      // Log progress
      if ((i + 1) % 500 === 0 || i + 1 === data.length) {
        console.log(`Processed ${i + 1}/${data.length} rows...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Store matching completed in ${duration} seconds.`);
    console.log(`Matched: ${matchedCount}, Unmatched/Low Score: ${unmatchedCount}`);

    // Get original keys to clean up the Existing and New rows
    const originalKeys = data.length > 0 ? Object.keys(data[0]).filter(k => 
      k !== 'Matching DB Store ID' && 
      k !== 'Matching DB Store Name' && 
      k !== 'Matching DB Store City' && 
      k !== 'Match Score (%)' && 
      k !== 'DB Physical Visits'
    ) : [];

    // Filter rows
    const existingAndNewRows = data
      .filter(row => {
        const dbId = row['Matching DB Store ID'];
        return dbId === 'Already Matched' || dbId === 'New Store (Excluded)';
      })
      .map(row => {
        const cleanRow: any = {};
        for (const key of originalKeys) {
          cleanRow[key] = row[key];
        }
        return cleanRow;
      });

    const missingIdRows = data.filter(row => {
      const dbId = row['Matching DB Store ID'];
      return dbId !== 'Already Matched' && dbId !== 'New Store (Excluded)';
    });

    console.log(`Summary:`);
    console.log(`- Existing/New Stores Sheet: ${existingAndNewRows.length} rows`);
    console.log(`- Missing ID Analysis Sheet: ${missingIdRows.length} rows`);

    // 1. Write the first Excel file (Store ID defined or status is 'new')
    const existingPath = path.resolve(__dirname, '../testing/Final Sheet-Sales Store Existing_And_New.xlsx');
    console.log(`Writing Existing/New Excel file to: ${existingPath}`);
    const existingWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(existingWorkbook, XLSX.utils.json_to_sheet(existingAndNewRows), 'Existing and New');
    XLSX.writeFile(existingWorkbook, existingPath);

    // 2. Write the second Excel file (Store ID missing / NA with all analysis columns)
    const analysisPath = path.resolve(__dirname, '../testing/Final Sheet-Sales Store Missing_ID_Analysis.xlsx');
    console.log(`Writing Missing ID Analysis Excel file to: ${analysisPath}`);
    const analysisWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(analysisWorkbook, XLSX.utils.json_to_sheet(missingIdRows), 'Missing ID Analysis');
    XLSX.writeFile(analysisWorkbook, analysisPath);

    console.log('Both Excel files successfully created!');

  } catch (err) {
    console.error('Error during matching execution:', err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
