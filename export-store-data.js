// MongoDB Store Collection Export Script
// Exports all store data from the database to Excel file

const { MongoClient } = require('mongodb');
const XLSX = require('xlsx');
const path = require('path');

// MongoDB connection string from environment or default
const mongoUri = process.env.DATABASE_URL;
if (!mongoUri) { console.error('❌ DATABASE_URL env variable not set'); process.exit(1); }

async function exportStoreData() {
  let client;
  
  try {
    console.log('🚀 Starting Store collection export...');
    
    // Connect to MongoDB
    console.log('📡 Connecting to database...');
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const storeCollection = db.collection('Store');
    
    // Get all stores
    console.log('📊 Fetching Store documents...');
    const stores = await storeCollection.find({}).toArray();
    console.log(`✅ Found ${stores.length} store documents`);
    
    if (stores.length === 0) {
      console.log('⚠️  No stores found in database.');
      return;
    }
    
    // Transform data for Excel export
    const excelData = stores.map(store => ({
      'Store ID': store._id,
      'Store Name': store.storeName,
      'City': store.city,
      'Full Address': store.fullAddress || '',
      'Partner Brand IDs': store.partnerBrandIds?.join(', ') || '',
      'Partner Brand Types': store.partnerBrandTypes?.join(', ') || '',
      'Number of Brands': store.partnerBrandIds?.length || 0
    }));
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Auto-size columns
    const maxWidth = 50;
    const colWidths = Object.keys(excelData[0] || {}).map(key => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...excelData.map(row => String(row[key] || '').length)
        ),
        maxWidth
      )
    }));
    worksheet['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stores');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `store_export_${timestamp}.xlsx`;
    const filepath = path.join(process.cwd(), filename);
    
    // Write to file
    console.log(`� Wriating data to ${filename}...`);
    XLSX.writeFile(workbook, filepath);
    
    console.log('\n🎉 Export Summary:');
    console.log(`   📊 Total stores exported: ${stores.length}`);
    console.log(`   📁 File location: ${filepath}`);
    console.log('\n✨ Store data export completed successfully!');
    
    // Display sample store info
    if (stores.length > 0) {
      console.log('\n📋 Sample Store Data:');
      const sample = stores[0];
      console.log(`   Store Name: ${sample.storeName}`);
      console.log(`   City: ${sample.city}`);
      console.log(`   Partner Brands: ${sample.partnerBrandIds?.length || 0}`);
    }
    
  } catch (error) {
    console.error('💥 Export failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the export
exportStoreData();
