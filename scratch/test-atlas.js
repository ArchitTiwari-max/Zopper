const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    const user = await db.collection('User').findOne({});
    console.log("Atlas connection successful. User found:", user ? user.username : "None");
  } catch (e) {
    console.error("Atlas connection error:", e);
  } finally {
    await client.close();
  }
}
main();
