const { MongoClient } = require('mongodb');

async function main() {
  const uri = "mongodb://localhost:27017/zoppertrack?directConnection=true";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to localhost MongoDB.");
    const db = client.db();
    const count = await db.collection('Store').countDocuments();
    console.log(`Stores on localhost: ${count}`);
  } catch (e) {
    console.error("Localhost connection failed:", e.message);
  } finally {
    await client.close();
  }
}

main();
