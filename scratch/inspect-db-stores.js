require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.DATABASE_URL || "";
  console.log('Connecting to database via:', uri);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const stores = await db.collection('Store').find({}).limit(5).toArray();
    console.log('Sample stores (first 5):', JSON.stringify(stores, null, 2));

    const withName = await db.collection('Store').countDocuments({ name: { $exists: true, $ne: null } });
    console.log('Stores with "name" field:', withName);

    const withStoreName = await db.collection('Store').countDocuments({ storeName: { $exists: true, $ne: null } });
    console.log('Stores with "storeName" field:', withStoreName);

    const withCity = await db.collection('Store').countDocuments({ city: { $exists: true, $ne: null } });
    console.log('Stores with "city" field:', withCity);

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
