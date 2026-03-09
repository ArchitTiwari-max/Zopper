/**
 * Migration: Add visitDate field to all visits
 * Direct MongoDB update
 */

const { MongoClient } = require('mongodb');

async function migrate() {
  const client = new MongoClient('mongodb://localhost:27017/?directConnection=true');
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db('zoppertrack');
    const visits = db.collection('Visit');
    
    console.log('📊 Checking visits...');
    const total = await visits.countDocuments();
    console.log(`Total visits: ${total}`);
    
    const withoutVisitDate = await visits.countDocuments({
      visitDate: { $exists: false }
    });
    console.log(`Visits without visitDate field: ${withoutVisitDate}\n`);
    
    if (withoutVisitDate === 0) {
      console.log('✅ All visits already have visitDate field.');
      return;
    }
    
    console.log('🔄 Adding visitDate field...');
    const result = await visits.updateMany(
      { visitDate: { $exists: false } },
      [{ $set: { visitDate: '$createdAt' } }]
    );
    
    console.log(`✅ Migration completed!`);
    console.log(`📝 Matched: ${result.matchedCount}`);
    console.log(`📝 Modified: ${result.modifiedCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
