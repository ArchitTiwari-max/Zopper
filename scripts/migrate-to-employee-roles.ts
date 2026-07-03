import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔄 Starting data migration to unified Employee and UserRole schema...');

    // 1. Create or get default Roles
    console.log('🔑 Ensuring default roles exist...');
    
    let adminRole = await prisma.userRole.findUnique({
      where: { name: 'ADMIN' }
    });
    if (!adminRole) {
      adminRole = await prisma.userRole.create({
        data: {
          name: 'ADMIN',
          permissions: ['ACCESS_ADMIN_PORTAL']
        }
      });
      console.log('✅ Created UserRole: ADMIN');
    } else {
      console.log('ℹ️ UserRole ADMIN already exists');
    }

    let salesExecRole = await prisma.userRole.findUnique({
      where: { name: 'SALES_EXECUTIVE' }
    });
    if (!salesExecRole) {
      salesExecRole = await prisma.userRole.create({
        data: {
          name: 'SALES_EXECUTIVE',
          permissions: ['ACCESS_EXECUTIVE_PORTAL']
        }
      });
      console.log('✅ Created UserRole: SALES_EXECUTIVE');
    } else {
      console.log('ℹ️ UserRole SALES_EXECUTIVE already exists');
    }

    // 2. Migrate User roles links
    console.log('👥 Migrating user role relations...');
    const users = await prisma.user.findMany();
    let usersUpdated = 0;

    for (const user of users) {
      const targetRoleId = user.role === 'ADMIN' ? adminRole.id : salesExecRole.id;
      
      if (user.roleId !== targetRoleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            roleId: targetRoleId
          }
        });
        usersUpdated++;
      }
    }
    console.log(`✅ Updated ${usersUpdated}/${users.length} users with new roleId links`);

    // 3. Migrate Admins to Employees
    console.log('🏢 Migrating Admins to Employee profile records...');
    const admins = await prisma.admin.findMany();
    let adminsMigrated = 0;

    for (const admin of admins) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { id: admin.id }
      });

      if (!existingEmployee) {
        await prisma.employee.create({
          data: {
            id: admin.id, // Keep the exact same ID so Visit references remain intact!
            name: admin.name,
            contact_number: admin.contact_number,
            region: admin.region,
            designation: 'Operations Admin',
            department: 'Operations',
            userId: admin.userId
          }
        });
        adminsMigrated++;
      }
    }
    console.log(`✅ Migrated ${adminsMigrated}/${admins.length} Admins to Employees`);

    // 4. Migrate Executives to Employees
    console.log('💼 Migrating Executives to Employee profile records...');
    const executives = await prisma.executive.findMany();
    let executivesMigrated = 0;

    for (const exec of executives) {
      const existingEmployee = await prisma.employee.findUnique({
        where: { id: exec.id }
      });

      if (!existingEmployee) {
        await prisma.employee.create({
          data: {
            id: exec.id, // Keep the exact same ID so Visit and hierarchy references remain intact!
            name: exec.name,
            contact_number: exec.contact_number,
            region: exec.region,
            designation: 'Relationship Manager',
            department: 'Sales',
            userId: exec.userId,
            managerIds: exec.managerIds,
            subordinateIds: exec.subordinateIds
          }
        });
        executivesMigrated++;
      }
    }
    console.log(`✅ Migrated ${executivesMigrated}/${executives.length} Executives to Employees`);

    console.log('🎉 Database migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
