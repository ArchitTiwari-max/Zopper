const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function truncate(str, maxLen = 30000) {
  if (!str) return '';
  if (str.length > maxLen) {
    return str.slice(0, maxLen - 50) + `... [TRUNCATED, TOTAL LENGTH: ${str.length}]`;
  }
  return str;
}

async function main() {
  console.log("Fetching all stores to prevent relationship inconsistency crashes...");
  const allStores = await prisma.store.findMany({
    select: {
      id: true,
      storeName: true
    }
  });
  
  const storeMap = new Map(allStores.map(s => [s.id, s.storeName]));
  console.log(`Loaded ${storeMap.size} stores for reference.`);

  console.log("Fetching active executives...");
  
  // Active executives are those where the associated user isActive is true
  const executives = await prisma.executive.findMany({
    where: {
      user: {
        isActive: true
      }
    },
    include: {
      user: true,
      manager: true,
      subordinates: true,
      executiveStores: true // Fetching raw assignments to avoid crash on missing Store docs
    }
  });

  console.log(`Found ${executives.length} active executives.`);

  if (executives.length === 0) {
    console.log("No active executives found in the database.");
    return;
  }

  const rows = executives.map(exec => {
    const assignedStores = exec.executiveStores
      .map(es => storeMap.get(es.storeId) || `Unknown Store (${es.storeId})`)
      .join(', ');
    const subordinateNames = exec.subordinates.map(sub => sub.name).join(', ');

    return {
      'Executive ID': exec.id,
      'Name': exec.name,
      'Contact Number': exec.contact_number,
      'Region': exec.region || 'N/A',
      'Email': exec.user.email,
      'Username': exec.user.username,
      'Is Active': exec.user.isActive ? 'Yes' : 'No',
      'Manager Name': exec.manager ? exec.manager.name : 'N/A',
      'Manager Contact': exec.manager ? exec.manager.contact_number : 'N/A',
      'Subordinates Count': exec.subordinates.length,
      'Subordinates': truncate(subordinateNames || 'None'),
      'Assigned Stores Count': exec.executiveStores.length,
      'Assigned Stores': truncate(assignedStores || 'None')
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto column widths
  const colWidths = Object.keys(rows[0] || {}).map(key => {
    const maxLen = Math.max(
      key.length,
      ...rows.map(r => String(r[key] || '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }; // min width 10, max width 50, padding 2
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Active Executives');

  const outputPath = path.join(__dirname, 'exports', 'active_executives.xlsx');
  
  // Ensure exports directory exists
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  // Write file
  XLSX.writeFile(wb, outputPath);
  console.log(`Saved active executives list to ${outputPath}`);
}

main()
  .catch(e => {
    console.error("Error running script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
