const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Common Indian holidays for 2025 (you can modify these as needed)
const holidays2025 = [
  { date: '2025-01-01', name: 'New Year\'s Day' },
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-03-13', name: 'Holi' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-10-02', name: 'Gandhi Jayanti' },
  { date: '2025-10-31', name: 'Diwali' },
  { date: '2025-12-25', name: 'Christmas Day' }
];

async function initHolidays() {
  console.log('Initializing holidays...');
  
  try {
    for (const holiday of holidays2025) {
      const existingHoliday = await prisma.holiday.findFirst({
        where: {
          date: new Date(holiday.date + 'T00:00:00.000Z')
        }
      });
      
      if (!existingHoliday) {
        await prisma.holiday.create({
          data: {
            date: new Date(holiday.date + 'T00:00:00.000Z'),
            name: holiday.name,
            description: `${holiday.name} - National Holiday`,
            isRecurring: true
          }
        });
        console.log(`✓ Added holiday: ${holiday.name} (${holiday.date})`);
      } else {
        console.log(`- Holiday already exists: ${holiday.name} (${holiday.date})`);
      }
    }
    
    console.log('\n✅ Holiday initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing holidays:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initHolidays();