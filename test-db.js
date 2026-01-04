import { MongoClient } from "mongodb";

async function testMongoConnection() {
  const uri =
    "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";

  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();

    // Simple ping to verify connection
    await client.db().command({ ping: 1 });

    console.log("✅ MongoDB connection successful!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

testMongoConnection();
