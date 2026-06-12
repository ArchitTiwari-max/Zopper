import * as dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.DATABASE_URL || "";
  console.log('Connecting to:', uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const stores = await db.collection('Store').find({}).limit(10).toArray();
    console.log('Sample stores from DB:', JSON.stringify(stores, null, 2));

    // Count how many stores have a non-empty 'name' field
    const nameCount = await db.collection('Store').countDocuments({ name: { $exists: true, $ne: null } });
    console.log('Stores with "name" field:', nameCount);

    // Count how many stores have a non-empty 'storeName' field
    const storeNameCount = await db.collection('Store').countDocuments({ storeName: { $exists: true, $ne: null } });
    console.log('Stores with "storeName" field:', storeNameCount);

    // Count how many stores have a non-empty 'city' field
    const cityCount = await db.collection('Store').countDocuments({ city: { $exists: true, $ne: null } });
    console.log('Stores with "city" field:', cityCount);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
