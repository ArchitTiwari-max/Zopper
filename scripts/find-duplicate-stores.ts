import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

// Noise words to ignore during token comparisons
const noiseWords = new Set([
  "br", "branch", "up", "sales", "co", "company", "pvt", "ltd", "limited",
  "and", "of", "the", "in", "at", "with", "on", "for", "to", "a", "an", "by",
  "ms", "m", "s", "electronics", "electrical", "electricals", "electro",
  "appliances", "home", "store", "stores", "showroom", "agency", "agencies",
  "enterprise", "enterprises", "retail", "retailer", "retailers", "distributor",
  "distributors", "trader", "traders", "trading", "associate", "associates",
  "centre", "center", "services", "service", "world", "zone"
]);

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
  if (!name) return "";
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bvs\b/g, "vijay sales")
    .replace(/\brdc\b/g, "raj nagar dc")
    .replace(/\brd\b/g, "reliance digital")
    .replace(/\belectroworld\b/g, "electro world")
    .replace(/\bindrapuram\b/g, "indirapuram")
    .replace(/\bsec\b/g, "sector")
    .replace(/\bsect\b/g, "sector")
    .replace(/\bghazibad\b/g, "ghaziabad")
    .replace(/\bbareily\b/g, "bareilly")
    .replace(/\bgurgaon\b/g, "gurugram")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Token-based Jaccard similarity with advanced word/noise filtering
function jaccardSimilarity(s1: string, s2: string): number {
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

function getTokens(s: string): Set<string> {
  const norm = normalizeStoreName(s);
  return new Set(
    norm.split(/\s+/)
      .filter(t => t.length > 1 && !noiseWords.has(t))
  );
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
  if (!city) return "";
  return city.toLowerCase()
    .replace(/\s+/g, "")
    .replace("ghazibad", "ghaziabad")
    .replace("bareily", "bareilly")
    .replace("gurgaon", "gurugram")
    .trim();
}

interface DuplicateResult {
  isDuplicate: boolean;
  matchType: string;
  score: number;
}

function checkIsDuplicate(storeA: any, storeB: any): DuplicateResult {
  const nameA = storeA.storeName;
  const nameB = storeB.storeName;
  
  const normA = normalizeStoreName(nameA);
  const normB = normalizeStoreName(nameB);
  
  const cleanA = cleanString(normA);
  const cleanB = cleanString(normB);
  
  const cityA = storeA.city || "";
  const cityB = storeB.city || "";
  const normCityA = normalizeCity(cityA);
  const normCityB = normalizeCity(cityB);
  
  const sameCity = normCityA === normCityB;
  
  // Rule 1: Exact Name Match
  if (cleanA === cleanB && cleanA.length > 0) {
    if (sameCity) {
      return { isDuplicate: true, matchType: "Exact Name & City Match", score: 100 };
    } else {
      return { isDuplicate: true, matchType: "Exact Name Match (Different City)", score: 100 };
    }
  }
  
  // Optimization: check token overlap. If no common tokens, score is 0.
  const tokensA = getTokens(nameA);
  const tokensB = getTokens(nameB);
  
  let hasOverlap = false;
  for (const t of tokensA) {
    if (tokensB.has(t)) {
      hasOverlap = true;
      break;
    }
  }
  
  if (!hasOverlap) {
    return { isDuplicate: false, matchType: "None", score: 0 };
  }
  
  // Calculate fuzzy similarity
  const score = calculateNameSimilarity(nameA, nameB);
  const scorePercentage = Math.round(score * 100);
  
  // Rule 2: Fuzzy match in same city (threshold 82%)
  if (sameCity && score >= 0.82) {
    return { isDuplicate: true, matchType: "Fuzzy Match (Same City)", score: scorePercentage };
  }
  
  // Rule 3: Fuzzy match in different city (threshold 88%)
  if (!sameCity && score >= 0.88) {
    return { isDuplicate: true, matchType: "Fuzzy Match (Different City)", score: scorePercentage };
  }
  
  return { isDuplicate: false, matchType: "None", score: scorePercentage };
}

async function run() {
  try {
    console.log("🚀 Starting Duplicate Store Scan...");
    console.log("📡 Fetching all stores from database with activity counts...");

    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: {
            visits: true,
            digitalVisits: true,
            salesRecords: true,
            executiveStores: true,
          }
        }
      }
    });

    console.log(`✅ Fetched ${stores.length} stores.`);

    if (stores.length === 0) {
      console.log("⚠️ No stores found in the database.");
      return;
    }

    // Map to include activity scores and individual counts
    const mappedStores = stores.map(store => {
      const visits = store._count.visits;
      const digitalVisits = store._count.digitalVisits;
      const salesRecords = store._count.salesRecords;
      const assignments = store._count.executiveStores;
      const activityScore = visits + digitalVisits + salesRecords + assignments;
      
      return {
        id: store.id,
        storeName: store.storeName,
        city: store.city || "",
        fullAddress: store.fullAddress || "",
        visits,
        digitalVisits,
        salesRecords,
        assignments,
        activityScore,
      };
    });

    // Sort by activity score descending, and then by ID alphabetically
    console.log("📊 Sorting stores by activity level to determine canonical originals...");
    mappedStores.sort((a, b) => {
      if (b.activityScore !== a.activityScore) {
        return b.activityScore - a.activityScore;
      }
      return a.id.localeCompare(b.id);
    });

    const duplicateIds = new Set<string>();
    const duplicateRecords: any[] = [];

    console.log("🔍 Scanning for duplicate stores...");
    const startTime = Date.now();

    for (let i = 0; i < mappedStores.length; i++) {
      const storeA = mappedStores[i];
      if (duplicateIds.has(storeA.id)) {
        continue;
      }

      // Compare with all subsequent less-active stores
      for (let j = i + 1; j < mappedStores.length; j++) {
        const storeB = mappedStores[j];
        if (duplicateIds.has(storeB.id)) {
          continue;
        }

        const matchResult = checkIsDuplicate(storeA, storeB);
        if (matchResult.isDuplicate) {
          duplicateIds.add(storeB.id);
          duplicateRecords.push({
            "Store ID": storeB.id,
            "Store Name": storeB.storeName,
            "City": storeB.city,
            "Full Address": storeB.fullAddress,
            "Visits Count": storeB.visits,
            "Digital Visits Count": storeB.digitalVisits,
            "Sales Records Count": storeB.salesRecords,
            "Assignments Count": storeB.assignments,
            "Original Store ID": storeA.id,
            "Original Store Name": storeA.storeName,
            "Original Store City": storeA.city,
            "Original Store Address": storeA.fullAddress,
            "Original Visits Count": storeA.visits,
            "Original Digital Visits Count": storeA.digitalVisits,
            "Original Sales Records Count": storeA.salesRecords,
            "Original Assignments Count": storeA.assignments,
            "Match Type": matchResult.matchType,
            "Match Score (%)": matchResult.score,
          });
        }
      }

      if ((i + 1) % 500 === 0) {
        console.log(`   Processed ${i + 1}/${mappedStores.length} stores...`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Duplicate scan completed in ${duration} seconds.`);
    console.log(`📊 Found ${duplicateRecords.length} duplicate store entries out of ${mappedStores.length} total stores.`);

    // Write results to Excel
    const filename = "duplicate_stores_report.xlsx";
    const filepath = path.join(process.cwd(), filename);
    console.log(`📁 Writing duplicate stores report to ${filename}...`);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(duplicateRecords);

    // Auto-fit column widths
    if (duplicateRecords.length > 0) {
      const maxWidth = 55;
      const colWidths = Object.keys(duplicateRecords[0]).map(key => ({
        wch: Math.min(
          Math.max(
            key.length,
            ...duplicateRecords.map(row => String(row[key] || "").length)
          ),
          maxWidth
        )
      }));
      worksheet["!cols"] = colWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Duplicate Stores");
    XLSX.writeFile(workbook, filepath);

    console.log("\n🎉 Process Completed Successfully!");
    console.log(`   📁 Excel saved to: ${filepath}`);
    console.log(`   📊 Total Duplicate Records: ${duplicateRecords.length}`);

  } catch (err) {
    console.error("❌ An error occurred during execution:", err);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Disconnected from database.");
  }
}

run();
