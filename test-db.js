import { MongoClient } from "mongodb";

async function removeAssignedStoreIdsField() {
  const uri = "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(); // Uses DB from connection string

    const result = await db.collection("Executive").updateMany(
      {},
      { $unset: { assignedStoreIds: "" } }
    );

    console.log(`Removed assignedStoreIds from ${result.modifiedCount} executives.`);
  } catch (error) {
    console.error("Error removing assignedStoreIds field:", error);
  } finally {
    await client.close();
  }
}

removeAssignedStoreIdsField();
