const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function checkTypes() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  
  const sample = await db.collection('Store').findOne({ storeName: { $regex: /vs/i } });
  console.log("Store:", sample.storeName);
  console.log("partnerBrandIds:", sample.partnerBrandIds);
  console.log("partnerBrandTypes:", sample.partnerBrandTypes);
  
  await client.close();
}
checkTypes().catch(console.error);
