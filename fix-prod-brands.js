const { MongoClient } = require('mongodb');

// PRODUCTION CONNECTION STRING
const MONGO_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

const BRANDS_TO_SEED = [
  { _id: 'brand_001', brandName: 'Godrej' },
  { _id: 'brand_002', brandName: 'Samsung' },
  { _id: 'brand_003', brandName: 'Hitachi' },
  { _id: 'brand_004', brandName: 'Haier' },
  { _id: 'brand_010', brandName: 'Havells' },
];

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('zoppertrack');

    console.log('--- PRODUCTION BRAND FIX START ---');

    // 1. Ensure Brands exist
    console.log('\n[1/4] Checking Brands...');
    for (const b of BRANDS_TO_SEED) {
      const exists = await db.collection('Brand').findOne({ _id: b._id });
      if (!exists) {
        await db.collection('Brand').insertOne(b);
        console.log(` ✅ Created brand: ${b.brandName}`);
      } else {
        console.log(` ⏭️ ${b.brandName} exists`);
      }
    }

    // 2. Add Hitachi to VS stores
    console.log('\n[2/4] Ensuring Hitachi is in all VS stores...');
    const vsWithoutHitachi = await db.collection('Store').find({
      storeName: { $regex: /^VS-/i },
      partnerBrandIds: { $ne: 'brand_003' }
    }).toArray();

    if (vsWithoutHitachi.length > 0) {
      const ids = vsWithoutHitachi.map(s => s._id);
      await db.collection('Store').updateMany(
        { _id: { $in: ids } },
        { $push: { partnerBrandIds: 'brand_003' } }
      );
      console.log(` ✅ Added Hitachi to ${vsWithoutHitachi.length} stores`);
    } else {
      console.log(' ⏭️ All VS stores already have Hitachi');
    }

    // 3. Clean nulls from partnerBrandTypes (Prisma Killer)
    console.log('\n[3/4] Removing null values from partnerBrandTypes across ALL stores...');
    const r1 = await db.collection('Store').updateMany(
      { partnerBrandTypes: { $elemMatch: { $eq: null } } },
      { $pull: { partnerBrandTypes: null } }
    );
    console.log(` ✅ Cleaned nulls from ${r1.modifiedCount} stores`);

    const r2 = await db.collection('Store').updateMany(
      { partnerBrandTypes: null },
      { $set: { partnerBrandTypes: [] } }
    );
    console.log(` ✅ Resetted null arrays to empty in ${r2.modifiedCount} stores`);

    // 4. Verification
    const count = await db.collection('Store').countDocuments({ storeName: { $regex: /^VS-/i } });
    const countWithHitachi = await db.collection('Store').countDocuments({ 
       storeName: { $regex: /^VS-/i },
       partnerBrandIds: 'brand_003'
    });
    console.log(`\nVerification: VS Stores = ${count}, VS with Hitachi = ${countWithHitachi}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.close();
    console.log('\n--- FINISHED ---');
  }
}

run();
