import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Employee ID Unification Migration...');

  // 1. Fetch all employees that need migration (starting with admin_ or executive_)
  const employeesToMigrate = await prisma.employee.findMany({
    where: {
      OR: [
        { id: { startsWith: 'admin_' } },
        { id: { startsWith: 'executive_' } }
      ]
    },
    orderBy: { id: 'asc' }
  });

  if (employeesToMigrate.length === 0) {
    console.log('✅ No employees with admin_ or executive_ prefix found. Already unified!');
    return;
  }

  console.log(`📋 Found ${employeesToMigrate.length} employees to migrate.`);

  // 2. Generate ID Mapping Table
  const idMap = new Map<string, string>();
  let counter = 1;

  // Let's also check if any employee_XXXXX IDs already exist so we don't collide
  const existingUnified = await prisma.employee.findMany({
    where: { id: { startsWith: 'employee_' } },
    select: { id: true }
  });
  
  const usedNumbers = new Set(
    existingUnified.map(e => parseInt(e.id.replace('employee_', ''), 10)).filter(n => !isNaN(n))
  );

  for (const emp of employeesToMigrate) {
    while (usedNumbers.has(counter)) {
      counter++;
    }
    const newId = `employee_${String(counter).padStart(5, '0')}`;
    idMap.set(emp.id, newId);
    usedNumbers.add(counter);
    counter++;
  }

  console.log('🔄 Sample ID Mappings generated:');
  let count = 0;
  for (const [oldId, newId] of idMap.entries()) {
    if (count++ < 5) {
      console.log(`   ${oldId}  -->  ${newId}`);
    }
  }
  if (idMap.size > 5) {
    console.log(`   ... and ${idMap.size - 5} more.`);
  }

  // 3. Perform Migration for each employee inside a safe Transaction
  let successCount = 0;

  for (const emp of employeesToMigrate) {
    const oldId = emp.id;
    const newId = idMap.get(oldId)!;

    // Map any manager or subordinate IDs to their new corresponding IDs
    const newManagerIds = (emp.managerIds || []).map(mid => idMap.get(mid) || mid);
    const newSubordinateIds = (emp.subordinateIds || []).map(sid => idMap.get(sid) || sid);

    try {
      await prisma.$transaction(async (tx) => {
        // Step A: Temporarily change userId of old record to avoid unique constraint collision
        const tempUserId = `${emp.userId}_temp_${Date.now()}`;
        await tx.employee.update({
          where: { id: oldId },
          data: { userId: tempUserId }
        });

        // Step B: Create the new Employee record with unified ID
        await tx.employee.create({
          data: {
            id: newId,
            name: emp.name,
            contact_number: emp.contact_number,
            region: emp.region,
            designation: emp.designation,
            department: emp.department,
            userId: emp.userId, // Restore original userId on the new record
            managerIds: newManagerIds,
            subordinateIds: newSubordinateIds
          }
        });

        // Step C: Update Foreign Keys across all 8 related tables
        // 1. EmployeeStoreAssignment
        await tx.employeeStoreAssignment.updateMany({
          where: { employeeId: oldId },
          data: { employeeId: newId }
        });

        // 2. Visit (created by and reviewed by)
        await tx.visit.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });
        await tx.visit.updateMany({
          where: { reviewedByAdminId: oldId },
          data: { reviewedByAdminId: newId }
        });

        // 3. DigitalVisit
        await tx.digitalVisit.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });
        await tx.digitalVisit.updateMany({
          where: { reviewedByAdminId: oldId }, 
          data: { reviewedByAdminId: newId }
        });

        // 4. StakeholderVisit
        await tx.stakeholderVisit.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });
        await tx.stakeholderVisit.updateMany({
          where: { reviewedByAdminId: oldId },
          data: { reviewedByAdminId: newId }
        });

        // 5. VisitPlan
        await tx.visitPlan.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });

        // 6. Assigned (Tasks)
        await tx.assigned.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });

        // 7. EmployeeVisit (Admin visits to stores)
        await tx.employeeVisit.updateMany({
          where: { employeeId: oldId },
          data: { employeeId: newId }
        });

        // 8. DostChat
        await tx.dostChat.updateMany({
          where: { executiveId: oldId },
          data: { executiveId: newId }
        });

        // Step D: Delete old employee document safely
        await tx.employee.delete({
          where: { id: oldId }
        });
      });

      console.log(`✅ Successfully migrated: ${oldId} -> ${newId} (${emp.name})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate ${oldId} (${emp.name}):`, error);
      throw error; // Throwing will stop script if any transaction fails
    }
  }

  console.log(`\n🎉 Migration Completed Successfully! Total unified: ${successCount} employees.`);
}

main()
  .catch((e) => {
    console.error('Fatal Migration Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
