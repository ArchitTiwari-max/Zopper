const { MongoClient } = require("mongodb");
require("dotenv").config();

async function main() {
  const uri = process.env.DATABASE_URL || "";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const storeCollection = db.collection("Store");

    // Find if store_003204 exists
    const store3204 = await storeCollection.findOne({ _id: "store_003204" });
    console.log("store_003204 exists in DB:", !!store3204);

    // Let's query stores with IDs starting with store_0032
    const stores32 = await storeCollection.find({ _id: /^store_0032/ }).toArray();
    console.log("Total stores with IDs starting with store_0032:", stores32.length);
    console.log("List of existing store_0032* IDs:", stores32.map(s => s._id).sort());

    // Let's also check if store_003205 exists specifically
    const store3205 = await storeCollection.findOne({ _id: "store_003205" });
    console.log("store_003205 exists in DB:", !!store3205);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
