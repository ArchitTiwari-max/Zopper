const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function checkBrands() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('zoppertrack');
  
  const brands = await db.collection('Brand').find({}).toArray();
  console.log("All Brands in DB:");
  brands.forEach(b => console.log(` - ID: "${b._id}", Name: "${b.brandName}"`));
  
  await client.close();
}
checkBrands().catch(console.error);
