const { MongoClient } = require("mongodb");
require("dotenv").config();

async function main() {
  const uri = process.env.DATABASE_URL || "";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const storeCollection = db.collection("Store");

    // Fetch 5 sample stores
    const samples = await storeCollection.find({}).limit(5).toArray();
    console.log("Sample DB Stores:", JSON.stringify(samples, null, 2));

    // Let's find all store IDs and see what the max ID is.
    // Store IDs look like: store_000006, store_000007, etc. or something else?
    // Let's sort stores by ID in descending order.
    // Since MongoDB string sorting is alphabetical, store_XXXXXX sorting should work.
    // Wait, let's fetch all IDs starting with 'store_' to find the maximum numeric part.
    const stores = await storeCollection.find({}, { projection: { _id: 1 } }).toArray();
    let maxNum = 0;
    let maxId = "";
    stores.forEach(s => {
      const id = s._id;
      if (id.startsWith("store_")) {
        const numPart = parseInt(id.replace("store_", ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
          maxId = id;
        }
      }
    });

    console.log("Total stores in DB:", stores.length);
    console.log("Max store ID pattern in DB (numeric max):", maxId, "numeric value:", maxNum);

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main();
