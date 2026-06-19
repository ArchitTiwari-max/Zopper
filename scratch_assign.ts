import { MongoClient } from 'mongodb';

const DB_URL = "mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0";

const mappings = [
  { manager: 'executive_00005', subordinates: ['executive_00018','executive_00036','executive_00034','executive_00045'] },
  { manager: 'executive_00026', subordinates: ['executive_00027','executive_00039','executive_00041','executive_00042','executive_00032','executive_00029','executive_00028','executive_00035','executive_00038'] },
  { manager: 'executive_00007', subordinates: ['executive_00027','executive_00041','executive_00039','executive_00038','executive_00035'] },
  { manager: 'executive_00006', subordinates: ['executive_00027','executive_00041','executive_00039','executive_00038','executive_00035','executive_00049','executive_00046'] }
];

async function main() {
  console.log('Starting exact assignment mapping with MongoDB driver...');

  const managerToSubs = new Map<string, string[]>();
  const subToManagers = new Map<string, string[]>();

  for (const { manager, subordinates } of mappings) {
    managerToSubs.set(manager, subordinates);
    for (const sub of subordinates) {
      if (!subToManagers.has(sub)) subToManagers.set(sub, []);
      subToManagers.get(sub)!.push(manager);
    }
  }

  const client = new MongoClient(DB_URL);
  await client.connect();
  const db = client.db();

  // Clear existing mappings
  await db.collection('Executive').updateMany({}, { $set: { manager_ids: [], subordinate_ids: [] } });
  console.log('Cleared all previous manager/subordinate mappings.');

  for (const manager of managerToSubs.keys()) {
    const exactSubs = managerToSubs.get(manager) || [];
    await db.collection('Executive').updateOne(
      { _id: manager },
      { $set: { subordinate_ids: exactSubs } }
    );
    console.log(`Manager ${manager} set to exactly ${exactSubs.length} subordinates: ${exactSubs.join(', ')}`);
  }

  for (const sub of subToManagers.keys()) {
    const exactManagers = subToManagers.get(sub) || [];
    await db.collection('Executive').updateOne(
      { _id: sub },
      { $set: { manager_ids: exactManagers } }
    );
    console.log(`Subordinate ${sub} set to exactly ${exactManagers.length} managers: ${exactManagers.join(', ')}`);
  }

  console.log('Assignment completed.');
  await client.close();
}

main().catch(console.error);
