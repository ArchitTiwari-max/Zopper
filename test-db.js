const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check for users
    const userCount = await prisma.user.count();
    console.log(`👤 Users in database: ${userCount}`);
    
    // Check for executives
    const executiveCount = await prisma.executive.count();
    console.log(`👔 Executives in database: ${executiveCount}`);
    
    // Check for stores
    const storeCount = await prisma.store.count();
    console.log(`🏪 Stores in database: ${storeCount}`);
    
    // Check for brands
    const brandCount = await prisma.brand.count();
    console.log(`🏷️  Brands in database: ${brandCount}`);
    
    // Check for visits
    const visitCount = await prisma.visit.count();
    console.log(`📍 Visits in database: ${visitCount}`);
    
    // Check for assigned tasks
    const assignedCount = await prisma.assigned.count();
    console.log(`📋 Assigned tasks in database: ${assignedCount}`);
    
    if (userCount === 0) {
      console.log('⚠️  Warning: No users found in database. You may need to seed data.');
    }
    
    if (executiveCount === 0) {
      console.log('⚠️  Warning: No executives found in database. API endpoints may return 404.');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();