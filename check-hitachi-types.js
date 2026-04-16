const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function checkHitachiTypes() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  
  const storesWithHitachiType = await db.collection('Store').find({
    storeName: { $regex: /^VS-/i },
    partnerBrandIds: 'brand_003'
  }).toArray();
  
  let count = 0;
  for (const s of storesWithHitachiType) {
    const idx = s.partnerBrandIds.indexOf('brand_003');
    if (s.partnerBrandTypes && s.partnerBrandTypes[idx]) {
       count++;
    }
  }
  
  console.log(`VS stores with Hitachi assigned a type: ${count} / ${storesWithHitachiType.length}`);
  
  await client.close();
}
checkHitachiTypes().catch(console.error);
