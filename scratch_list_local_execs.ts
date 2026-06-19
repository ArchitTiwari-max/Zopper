import { MongoClient } from 'mongodb';

const LOCAL_URL = "mongodb://localhost:27017/zoppertrack?directConnection=true";

async function main() {
  const client = new MongoClient(LOCAL_URL);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    const execs = await db.collection('Executive').find({}).toArray();

    execs.forEach(e => {
      console.log(`${e._id} : ${e.name}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
