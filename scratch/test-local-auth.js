const { MongoClient } = require('mongodb');
const uri = "mongodb://zoppertrack:1YplhDwwA8lL6Fq8@127.0.0.1:27017/zoppertrack?directConnection=true&authSource=admin";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    const user = await db.collection('User').findOne({});
    console.log("Local auth connection successful. User found:", user ? user.username : "None");
  } catch (e) {
    console.error("Local auth connection error:", e);
  } finally {
    await client.close();
  }
}
main();
