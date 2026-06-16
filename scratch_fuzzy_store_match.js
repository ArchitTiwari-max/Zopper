/**
 * scratch_fuzzy_store_match.js
 *
 * Fuzzy-matches store names from the Excel sheet against store names in MongoDB.
 * Outputs a ranked CSV with match %, best DB match, and city for review.
 *
 * Usage:
 *   node scratch_fuzzy_store_match.js
 *
 * Output:
 *   scratch_fuzzy_match_results.csv   — full results sorted by match %
 *   scratch_fuzzy_unmatched.csv       — stores with match < threshold (default 60%)
 */

const XLSX = require('xlsx');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const EXCEL_FILE = path.join(__dirname, 'Final Sheet-Sales Store (1).xlsx');
const MATCH_THRESHOLD = 60; // % below which we flag as "unmatched"

// Uses Atlas URL if local is down
const DB_URL = process.env.DATABASE_URL || 
  'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'zoppertrack';

// ─── Fuzzy Logic: Normalized Levenshtein Similarity ──────────────────────────
// Returns 0–100 (100 = identical)
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.round((1 - dist / maxLen) * 100);
}

// Token-based similarity: splits on spaces, matches word sets
function tokenSimilarity(a, b) {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

// Combined score: weighted blend of Levenshtein + token overlap
function fuzzyScore(excelName, dbName) {
  const a = excelName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const b = dbName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const lev = similarity(a, b);
  const tok = tokenSimilarity(a, b);
  return Math.round(lev * 0.4 + tok * 0.6); // token overlap weighs more
}

// Find best match for a given excel name from the DB list
function findBestMatch(excelName, dbStores) {
  let best = { score: 0, dbName: '', dbId: '', dbCity: '' };
  for (const s of dbStores) {
    const score = fuzzyScore(excelName, s.storeName);
    if (score > best.score) {
      best = { score, dbName: s.storeName, dbId: s.id, dbCity: s.city || '' };
    }
  }
  return best;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read Excel
  console.log('📖 Reading Excel file...');
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Find header row index (look for "Store Name")
  let headerIdx = 0;
  let storeNameCol = 1; // default col index
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const idx = rows[i].indexOf('Store Name');
    if (idx !== -1) { headerIdx = i; storeNameCol = idx; break; }
  }

  const excelStores = rows
    .slice(headerIdx + 1)
    .map(row => ({
      excelName: (row[storeNameCol] || '').toString().trim(),
      excelCity: (row[4] || '').toString().trim(),   // City col
      excelState: (row[5] || '').toString().trim(),  // State col
    }))
    .filter(r => r.excelName.length > 0);

  console.log(`✅ ${excelStores.length} store names read from Excel`);

  // 2. Fetch DB stores
  console.log('🔌 Connecting to MongoDB...');
  const client = new MongoClient(DB_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const dbStores = await db.collection('Store').find({}, {
    projection: { _id: 1, storeName: 1, city: 1 }
  }).toArray();
  await client.close();

  const normalizedDB = dbStores.map(s => ({
    id: s._id.toString(),
    storeName: s.storeName || '',
    city: s.city || '',
  }));
  console.log(`✅ ${normalizedDB.length} store names fetched from DB`);

  // 3. Run fuzzy matching
  console.log('🔍 Running fuzzy match...');
  const results = [];

  for (let i = 0; i < excelStores.length; i++) {
    const excel = excelStores[i];
    const match = findBestMatch(excel.excelName, normalizedDB);

    results.push({
      excelName: excel.excelName,
      excelCity: excel.excelCity,
      excelState: excel.excelState,
      matchScore: match.score,
      dbName: match.dbName,
      dbCity: match.dbCity,
      dbId: match.dbId,
      status: match.score >= MATCH_THRESHOLD ? 'MATCHED' : 'UNMATCHED',
    });

    if ((i + 1) % 100 === 0) process.stdout.write(`  ${i + 1}/${excelStores.length}\r`);
  }

  // Sort by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  // 4. Write CSV outputs
  const csvHeader = 'Excel Store Name,Excel City,Excel State,Match %,DB Store Name,DB City,DB Store ID,Status\n';
  const toRow = r =>
    `"${r.excelName}","${r.excelCity}","${r.excelState}",${r.matchScore},"${r.dbName}","${r.dbCity}","${r.dbId}","${r.status}"`;

  const allCsv = csvHeader + results.map(toRow).join('\n');
  fs.writeFileSync(path.join(__dirname, 'scratch_fuzzy_match_results.csv'), allCsv);

  const unmatched = results.filter(r => r.status === 'UNMATCHED');
  const unmatchedCsv = csvHeader + unmatched.map(toRow).join('\n');
  fs.writeFileSync(path.join(__dirname, 'scratch_fuzzy_unmatched.csv'), unmatchedCsv);

  // 5. Summary
  const matched = results.filter(r => r.status === 'MATCHED');
  const perfect = results.filter(r => r.matchScore === 100);
  console.log('\n');
  console.log('══════════════════════════════════════════════');
  console.log('  FUZZY MATCH SUMMARY');
  console.log('══════════════════════════════════════════════');
  console.log(`  Excel stores       : ${results.length}`);
  console.log(`  DB stores          : ${normalizedDB.length}`);
  console.log(`  Perfect matches    : ${perfect.length} (100%)`);
  console.log(`  Matched (≥${MATCH_THRESHOLD}%)     : ${matched.length} (${Math.round(matched.length/results.length*100)}%)`);
  console.log(`  Unmatched (<${MATCH_THRESHOLD}%)   : ${unmatched.length}`);
  console.log('──────────────────────────────────────────────');
  console.log(`  📄 Full results  → scratch_fuzzy_match_results.csv`);
  console.log(`  ⚠️  Unmatched    → scratch_fuzzy_unmatched.csv`);
  console.log('══════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
