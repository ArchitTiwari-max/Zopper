import { MongoClient } from 'mongodb';

const ATLAS_URL = "mongodb://127.0.0.1:27017/zoppertrack?directConnection=true";

async function main() {
  const client = new MongoClient(ATLAS_URL);
  try {
    await client.connect();
    const db = client.db('zoppertrack');
    const executives = db.collection('Executive');

    const exec5 = await executives.findOne({ _id: 'executive_00005' });
    console.log('executive_00005 raw document:', JSON.stringify(exec5, null, 2));

    const exec18 = await executives.findOne({ _id: 'executive_00018' });
    console.log('executive_00018 raw document:', JSON.stringify(exec18, null, 2));

    const allExecs = await executives.find({}).toArray();
    console.log('All executives count:', allExecs.length);
    for (const e of allExecs) {
      if ((e.subordinate_ids && e.subordinate_ids.length > 0) || (e.manager_ids && e.manager_ids.length > 0)) {
        console.log(`ID: ${e._id}, Name: ${e.name}, Manager IDs: ${JSON.stringify(e.manager_ids)}, Subordinate IDs: ${JSON.stringify(e.subordinate_ids)}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
