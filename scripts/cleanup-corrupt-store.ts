import { MongoClient } from 'mongodb';

async function main() {
  const MONGO_URI = 'mongodb://localhost:27017/zoppertrack?directConnection=true';
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    
    // Remove the bad store from my first manual try
    await db.collection('Store').deleteOne({ _id: "store_004583" });
    await db.collection('ExecutiveStoreAssignment').deleteOne({ storeId: "store_004583" });
    
    // Just in case any other store has 'Not Categorized' inside partnerBrandTypes
    await db.collection('Store').updateMany(
      { partnerBrandTypes: "Not Categorized" },
      { $pull: { partnerBrandTypes: "Not Categorized" } }
    );
    
    console.log("Cleanup complete!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
