const { MongoClient } = require('mongodb');

// Connection URIs
const LOCAL_URI = 'mongodb://127.0.0.1:27017/zoppertrack?directConnection=true';
const PROD_URI = 'mongodb+srv://zoppertrack:1YplhDwwA8lL6Fq8@cluster0.zfkavqf.mongodb.net/zoppertrack?retryWrites=true&w=majority&appName=Cluster0';

async function updateDatabase(uri, label) {
  console.log(`\n--- Starting Update on ${label} ---`);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('zoppertrack');

    // 1. Update/Upsert the Nothing Brand with ID "brand_005"
    console.log('1. Checking Brand "Nothing"...');
    const existingOldBrand = await db.collection('Brand').findOne({ _id: 'nothing' });
    const existingNewBrand = await db.collection('Brand').findOne({ _id: 'brand_005' });

    if (existingOldBrand) {
      console.log(' - Found brand with old ID "nothing". Deleting old brand...');
      await db.collection('Brand').deleteOne({ _id: 'nothing' });
    }

    if (!existingNewBrand) {
      console.log(' - Creating brand "Nothing" with new ID "brand_005"...');
      await db.collection('Brand').insertOne({
        _id: 'brand_005',
        brandName: 'Nothing'
      });
      console.log(' ✅ Brand created successfully.');
    } else {
      console.log(' ⏭️ Brand "Nothing" already exists with ID "brand_005".');
    }

    // 2. Update partnerBrandIds in Store collection
    console.log('2. Updating "nothing" to "brand_005" in Store partnerBrandIds...');
    const storeUpdateResult = await db.collection('Store').updateMany(
      { partnerBrandIds: 'nothing' },
      { $set: { 'partnerBrandIds.$[elem]': 'brand_005' } },
      { arrayFilters: [{ 'elem': 'nothing' }] }
    );
    console.log(` ✅ Updated ${storeUpdateResult.modifiedCount} store records.`);

    // 3. Update brandId in CategoryBrand collection
    console.log('3. Updating "nothing" to "brand_005" in CategoryBrand...');
    const catBrandUpdateResult = await db.collection('CategoryBrand').updateMany(
      { brandId: 'nothing' },
      { $set: { brandId: 'brand_005' } }
    );
    console.log(` ✅ Updated ${catBrandUpdateResult.modifiedCount} CategoryBrand records.`);

    // 4. Update brandId in SalesRecord collection
    console.log('4. Updating "nothing" to "brand_005" in SalesRecord...');
    const salesRecordUpdateResult = await db.collection('SalesRecord').updateMany(
      { brandId: 'nothing' },
      { $set: { brandId: 'brand_005' } }
    );
    console.log(` ✅ Updated ${salesRecordUpdateResult.modifiedCount} SalesRecord records.`);

    // 5. Update brandIds in Visit collection
    console.log('5. Updating "nothing" to "brand_005" in Visit brandIds...');
    const visitUpdateResult = await db.collection('Visit').updateMany(
      { brandIds: 'nothing' },
      { $set: { 'brandIds.$[elem]': 'brand_005' } },
      { arrayFilters: [{ 'elem': 'nothing' }] }
    );
    console.log(` ✅ Updated ${visitUpdateResult.modifiedCount} Visit records.`);

    // 6. Update brandIds in AdminVisit collection
    console.log('6. Updating "nothing" to "brand_005" in AdminVisit brandIds...');
    const adminVisitUpdateResult = await db.collection('AdminVisit').updateMany(
      { brandIds: 'nothing' },
      { $set: { 'brandIds.$[elem]': 'brand_005' } },
      { arrayFilters: [{ 'elem': 'nothing' }] }
    );
    console.log(` ✅ Updated ${adminVisitUpdateResult.modifiedCount} AdminVisit records.`);

  } catch (err) {
    console.error(`❌ Error updating ${label}:`, err.message);
  } finally {
    await client.close();
    console.log(`--- Finished Update on ${label} ---`);
  }
}

async function run() {
  // Update Local DB
  await updateDatabase(LOCAL_URI, 'LOCAL DATABASE');
  // Update Prod/Atlas DB
  await updateDatabase(PROD_URI, 'PRODUCTION/ATLAS DATABASE');
}

run().catch(console.error);
