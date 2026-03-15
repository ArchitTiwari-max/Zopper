// migrate-visits-mongodb.js
// Direct MongoDB client: copies createdAt -> visitDate where visitDate is null

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/zoppertrack?directConnection=true';
const DB_NAME = 'zoppertrack';

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db(DB_NAME);
  const visits = db.collection('Visit');

  // 1. Total visits in collection
  const totalCount = await visits.countDocuments({});
  console.log(`Total visits in collection: ${totalCount}`);

  // 2. Count null visitDate docs
  const nullCount = await visits.countDocuments({ visitDate: null });
  console.log(`Visits with null visitDate: ${nullCount}`);

  if (nullCount === 0) {
    console.log('Nothing to migrate. Exiting.');
    await client.close();
    return;
  }

  // 2. Bulk update: set visitDate = createdAt where visitDate is null
  const result = await visits.updateMany(
    { visitDate: null },
    [{ $set: { visitDate: '$createdAt' } }]
  );

  console.log(`\n✅ Migration complete!`);
  console.log(`   Matched:  ${result.matchedCount}`);
  console.log(`   Modified: ${result.modifiedCount}`);

  // 3. Verify
  const remaining = await visits.countDocuments({ visitDate: null });
  console.log(`   Remaining null visitDate: ${remaining}`);

  await client.close();
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
