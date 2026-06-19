import { MongoClient } from 'mongodb';

const DB_URL = "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  const client = new MongoClient(DB_URL);
  await client.connect();
  const db = client.db();

  const execs = await db.collection('Executive').find({}).toArray();

  execs.forEach(e => {
    console.log(`${e._id} : ${e.name}`);
  });

  await client.close();
}

main().catch(console.error);
