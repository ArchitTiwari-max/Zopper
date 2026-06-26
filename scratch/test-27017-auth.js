const { MongoClient } = require('mongodb');
const uri = "mongodb://test_admin:Solvytech1029@127.0.0.1:27017/zoppertrack?authSource=admin&directConnection=true";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    const user = await db.collection('User').findOne({});
    console.log("Port 27017 auth connection successful. User found:", user ? user.username : "None");
  } catch (e) {
    console.error("Port 27017 auth connection error:", e);
  } finally {
    await client.close();
  }
}
main();
