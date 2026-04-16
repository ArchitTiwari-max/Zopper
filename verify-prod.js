const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function verifyProd() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  
  const missing = await db.collection('Store').find({ 
    storeName: { $regex: /vs/i },
    partnerBrandIds: { $ne: 'brand_003' }
  }).toArray();
  
  console.log("Missing stores:", missing.map(m => m.storeName));
  
  await client.close();
}
verifyProd().catch(console.error);
