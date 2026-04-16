const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function testBrands() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  const store = await db.collection('Store').findOne({ storeName: 'VS-Ts(Shah Ali Banda)' });
  console.log("Store:", store.storeName);
  console.log("partnerBrandIds:", store.partnerBrandIds);
  console.log("Lengths:", store.partnerBrandIds.map(id => `"${id}" length: ${id.length}`));

  const brand = await db.collection('Brand').findOne({ _id: 'brand_003' });
  console.log("Brand 003:", brand);
  await client.close();
}

testBrands().catch(console.error);
