const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function verify() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  
  const stores = await db.collection('Store').find({
    storeName: { $regex: /VS/i }
  }).toArray();
  
  const missing = stores.filter(s => !s.partnerBrandIds || !s.partnerBrandIds.includes('brand_003'));
  
  console.log(`Total VS stores (case-insensitive 'VS'): ${stores.length}`);
  console.log(`Stores missing Hitachi: ${missing.length}`);
  if (missing.length > 0) {
    console.log("Missing stores tags:", missing.map(m => m.storeName));
  }
  
  await client.close();
}
verify().catch(console.error);
