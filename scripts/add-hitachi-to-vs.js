/**
 * Script: add-hitachi-to-vs.js
 * Adds brand_003 (Hitachi) to all VS- prefix stores in local MongoDB
 * Run: node scripts/add-hitachi-to-vs.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017/zoppertrack?directConnection=true';
const HITACHI_BRAND_ID = 'brand_003';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('zoppertrack');

    // Verify Hitachi brand exists
    const hitachi = await db.collection('Brand').findOne({ _id: HITACHI_BRAND_ID });
    if (!hitachi) {
      console.error('❌ Hitachi brand (brand_003) not found in DB!');
      process.exit(1);
    }
    console.log('✅ Hitachi brand found:', hitachi.brandName);

    // Find all VS stores that don't already have brand_003
    const vsStores = await db.collection('Store').find({
      storeName: { $regex: /^VS-/i },
      partnerBrandIds: { $ne: HITACHI_BRAND_ID }
    }).toArray();

    console.log(`\n📦 VS stores missing Hitachi: ${vsStores.length}`);

    if (vsStores.length === 0) {
      console.log('✅ All VS stores already have Hitachi!');
      return;
    }

    // Preview first 5
    vsStores.slice(0, 5).forEach(s => {
      console.log(`  - ${s.storeName} (current brands: ${JSON.stringify(s.partnerBrandIds)})`);
    });
    if (vsStores.length > 5) console.log(`  ... and ${vsStores.length - 5} more`);

    // Update all: push brand_003 and null type (for partnerBrandTypes parallel array)
    const storeIds = vsStores.map(s => s._id);
    // NOTE: Do NOT push null into partnerBrandTypes — Prisma enum arrays reject null.
    // Leaving types array shorter than ids array is fine; backend shows "Not Categorized" for missing entries.
    const result = await db.collection('Store').updateMany(
      { _id: { $in: storeIds } },
      {
        $push: {
          partnerBrandIds: HITACHI_BRAND_ID
          // partnerBrandTypes intentionally NOT modified — Hitachi shows as "Not Categorized"
        }
      }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} VS stores with Hitachi brand!`);

    // Verify a sample
    const sample = await db.collection('Store').findOne({ _id: vsStores[0]._id });
    console.log(`\n🔍 Verification sample - ${sample.storeName}:`);
    console.log(`   partnerBrandIds: ${JSON.stringify(sample.partnerBrandIds)}`);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
