import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/zoppertrack?directConnection=true";

async function main() {
  const client = new MongoClient(DB_URL);
  await client.connect();
  const db = client.db();

  const executives = await db.collection('Executive').find({}).toArray();
  const assignments = await db.collection('ExecutiveStoreAssignment').find({}).toArray();
  const stores = await db.collection('Store').find({}, { projection: { _id: 1, storeName: 1, city: 1, state: 1 } }).toArray();

  // Build store lookup by _id string
  const storeMap = new Map(stores.map(s => [s._id.toString(), s]));

  // Build assignment lookup: executiveId -> storeIds[]
  const execStoreMap = new Map<string, string[]>();
  for (const a of assignments) {
    const existing = execStoreMap.get(a.executiveId) ?? [];
    existing.push(a.storeId);
    execStoreMap.set(a.executiveId, existing);
  }

  console.log("=== EXECUTIVE STORE CITIES ===");
  for (const e of executives) {
    const storeIds = execStoreMap.get(String(e._id)) ?? [];
    const validStores = storeIds.map(id => storeMap.get(id)).filter(Boolean) as typeof stores;
    const cities = [...new Set(validStores.map(s => s.city).filter(Boolean))];
    const states = [...new Set(validStores.map(s => s.state).filter(Boolean))];
    const orphaned = storeIds.length - validStores.length;
    const orphanedStr = orphaned > 0 ? ` (${orphaned} orphaned)` : '';
    console.log(
      `${String(e._id).padEnd(20)} | ${String(e.name).padEnd(30)} | Region: ${String(e.region ?? 'null').padEnd(15)} | Cities: ${JSON.stringify(cities).padEnd(40)} | States: ${JSON.stringify(states)} | Stores: ${validStores.length}${orphanedStr}`
    );
  }

  await client.close();
}

main().catch(console.error);
