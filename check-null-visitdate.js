// Script to check for Visit documents with null visitDate
// Checks Visit collection for documents where visitDate is null

const { MongoClient } = require('mongodb');

// MongoDB connection string from environment or default
const mongoUri = process.env.DATABASE_URL;
if (!mongoUri) { console.error('❌ DATABASE_URL env variable not set'); process.exit(1); }

async function checkNullVisitDates() {
  let client;
  
  try {
    console.log('🔍 Starting Visit collection check for null visitDate...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to database...');
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected successfully\n');
    
    const db = client.db();
    const visitCollection = db.collection('Visit');
    
    // Count total visits
    const totalVisits = await visitCollection.countDocuments();
    console.log(`📊 Total visits in collection: ${totalVisits}`);
    
    // Find visits with null visitDate
    console.log('🔎 Searching for visits with null visitDate...\n');
    const nullVisitDateDocs = await visitCollection.find({
      visitDate: null
    }).toArray();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Results: Found ${nullVisitDateDocs.length} visits with null visitDate`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (nullVisitDateDocs.length > 0) {
      console.log('⚠️  Documents with null visitDate:\n');
      
      nullVisitDateDocs.forEach((visit, index) => {
        console.log(`${index + 1}. Visit ID: ${visit._id}`);
        console.log(`   Executive ID: ${visit.executiveId}`);
        console.log(`   Store ID: ${visit.storeId}`);
        console.log(`   Status: ${visit.status}`);
        console.log(`   Created At: ${visit.createdAt}`);
        console.log(`   Visit Date: ${visit.visitDate}`);
        console.log('   ─────────────────────────────────────────\n');
      });
      
      // Summary statistics
      console.log('📈 Summary:');
      console.log(`   Total visits: ${totalVisits}`);
      console.log(`   Visits with null visitDate: ${nullVisitDateDocs.length}`);
      console.log(`   Percentage: ${((nullVisitDateDocs.length / totalVisits) * 100).toFixed(2)}%`);
      
    } else {
      console.log('✅ Great! No visits found with null visitDate.');
      console.log('   All visits have valid visitDate values.\n');
    }
    
  } catch (error) {
    console.error('💥 Error occurred:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the check
checkNullVisitDates();
