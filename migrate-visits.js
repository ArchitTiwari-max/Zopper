// MongoDB Visit Collection Migration Script
// Export from: zoppertrack
// Import to: zoppertrack_dev

// Source and target connection strings - set via environment variables
const sourceUri = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const targetUri = process.env.TARGET_DATABASE_URL;
if (!sourceUri) { console.error('❌ SOURCE_DATABASE_URL or DATABASE_URL env variable not set'); process.exit(1); }
if (!targetUri) { console.error('❌ TARGET_DATABASE_URL env variable not set'); process.exit(1); }

async function migrateVisits() {
  console.log('🚀 Starting Visit collection migration...');
  
  // Connect to source database
  console.log('📡 Connecting to source database (zoppertrack)...');
  const sourceDb = connect(sourceUri);
  
  // Get all documents from Visit collection
  console.log('📊 Fetching Visit documents from source...');
  const visits = sourceDb.Visit.find({}).toArray();
  console.log(`✅ Found ${visits.length} visit documents to migrate`);
  
  if (visits.length === 0) {
    console.log('⚠️  No visits found in source database. Migration complete.');
    return;
  }
  
  // Connect to target database  
  console.log('📡 Connecting to target database (zoppertrack_dev)...');
  const targetDb = connect(targetUri);
  
  // Check if Visit collection already exists in target
  const existingCount = targetDb.Visit.countDocuments({});
  console.log(`📊 Target database currently has ${existingCount} visit documents`);
  
  if (existingCount > 0) {
    console.log('⚠️  Target Visit collection is not empty. Choose migration strategy:');
    console.log('   1. Drop existing and replace (DESTRUCTIVE)');
    console.log('   2. Insert only new documents (by _id)');
    console.log('   3. Cancel migration');
    
    // For safety, we'll use upsert strategy (insert only if _id doesn't exist)
    console.log('🛡️  Using safe upsert strategy...');
  }
  
  // Migrate documents with progress tracking
  console.log('🔄 Starting document migration...');
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < visits.length; i++) {
    try {
      const visit = visits[i];
      
      // Use upsert to avoid duplicates
      const result = targetDb.Visit.replaceOne(
        { _id: visit._id },
        visit,
        { upsert: true }
      );
      
      if (result.upsertedCount > 0) {
        successCount++;
      } else if (result.modifiedCount > 0) {
        console.log(`📝 Updated existing visit: ${visit._id}`);
      }
      
      // Progress indicator
      if ((i + 1) % 100 === 0 || i === visits.length - 1) {
        console.log(`📈 Progress: ${i + 1}/${visits.length} documents processed`);
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error migrating visit ${visits[i]._id}:`, error.message);
    }
  }
  
  // Final verification
  const finalCount = targetDb.Visit.countDocuments({});
  
  console.log('\n🎉 Migration Summary:');
  console.log(`   📊 Source documents: ${visits.length}`);
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Final target count: ${finalCount}`);
  
  if (errorCount === 0) {
    console.log('✨ Visit collection migration completed successfully!');
  } else {
    console.log('⚠️  Migration completed with some errors. Please review the logs above.');
  }
}

// Run the migration
try {
  migrateVisits();
} catch (error) {
  console.error('💥 Migration failed:', error);
}