/**
 * seed-local-db.js
 * Run this after every local DB reset to restore brand data.
 * Usage: node scripts/seed-local-db.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017/zoppertrack?directConnection=true';

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

    // ── Step 1: Ensure all brands exist ──────────────────────────────
    console.log('\n[1/3] Seeding brands...');
    for (const brand of BRANDS_TO_SEED) {
      const existing = await db.collection('Brand').findOne({ _id: brand._id });
      if (!existing) {
        await db.collection('Brand').insertOne(brand);
        console.log(`  ✅ Created ${brand._id} => ${brand.brandName}`);
      } else {
        console.log(`  ⏭️  ${brand._id} => ${brand.brandName} already exists`);
      }
    }

    // ── Step 2: Add Hitachi (brand_003) to all VS- stores ────────────
    console.log('\n[2/3] Adding Hitachi to VS stores...');
    const vsWithoutHitachi = await db.collection('Store').find({
      storeName: { $regex: /^VS-/i },
      partnerBrandIds: { $ne: 'brand_003' }
    }).toArray();

    if (vsWithoutHitachi.length === 0) {
      console.log('  ⏭️  All VS stores already have Hitachi');
    } else {
      const storeIds = vsWithoutHitachi.map(s => s._id);
      const r = await db.collection('Store').updateMany(
        { _id: { $in: storeIds } },
        { $push: { partnerBrandIds: 'brand_003' } }  // do NOT push null into partnerBrandTypes
      );
      console.log(`  ✅ Added Hitachi to ${r.modifiedCount} VS stores`);
    }

    // ── Step 3: Clean null from partnerBrandTypes ─────────────────────
    console.log('\n[3/3] Cleaning null from partnerBrandTypes...');
    const clean = await db.collection('Store').updateMany(
      { partnerBrandTypes: null },
      { $pull: { partnerBrandTypes: null } }
    );
    console.log(`  ✅ Cleaned ${clean.modifiedCount} stores`);

    // ── Summary ───────────────────────────────────────────────────────
    const vsTotal = await db.collection('Store').countDocuments({ storeName: { $regex: /^VS-/i } });
    const vsBoth  = await db.collection('Store').countDocuments({ storeName: { $regex: /^VS-/i }, 'partnerBrandIds.1': { $exists: true } });
    console.log(`\n✅ Done! ${vsBoth}/${vsTotal} VS stores now have both Samsung + Hitachi`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
