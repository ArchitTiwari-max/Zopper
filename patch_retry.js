const fs = require('fs');

async function patch() {
    const file = 'src/app/api/admin/visit-report/data/route.ts';
    let content = fs.readFileSync(file, 'utf8');

    // Regex replacement for target 1
    const target1Regex = /\]\);\s*const brandMap = new Map\(brands\.map\(b => \[b\.id, b\.brandName\]\)\);\s*\/\/\s*Process visit data\s*let processedVisits = visits\.map\(\(visit\) => \{/m;
    const replacement1 = `]);
    const brandMap = new Map(brands.map(b => [b.id, b.brandName]));

    // Get previous visit dates for these stores safely
    const validStoreIds = visits.map(v => v.store?.id).filter(Boolean);
    const storeIds = Array.from(new Set(validStoreIds));
    let storeVisitDates = new Map();
    
    if (storeIds.length > 0) {
      const previousVisitsRaw = await prisma.visit.findMany({
        where: { storeId: { in: storeIds } },
        select: { storeId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      for (const pv of previousVisitsRaw) {
        if (!pv.storeId) continue;
        const existing = storeVisitDates.get(pv.storeId) || [];
        existing.push(pv.createdAt);
        storeVisitDates.set(pv.storeId, existing);
      }
    }

    // Process visit data
    let processedVisits = visits.map((visit) => {`;

    if (target1Regex.test(content)) {
        content = content.replace(target1Regex, replacement1);
        console.log('Target 1 replaced');
    } else {
        console.error('Target 1 not found');
    }

    const target2Str = `const formattedVisitDate = \`\${visitDate.getDate().toString().padStart(2, '0')}/\${(visitDate.getMonth() + 1).toString().padStart(2, '0')}/\${visitDate.getFullYear()}\`;`;

    if (content.includes(target2Str)) {
        const idx = content.indexOf(target2Str) + target2Str.length;
        const insertCode = `\n
      // Get previous visit date
      let prevVisitDateStr = null;
      if (visit.store?.id) {
        const dates = storeVisitDates.get(visit.store.id) || [];
        const thisTime = visit.createdAt.getTime();
        const prevDates = dates.filter(d => d.getTime() < thisTime);
        if (prevDates.length > 0) {
          const prevDate = prevDates[0];
          prevVisitDateStr = \`\${prevDate.getDate().toString().padStart(2, '0')}/\${(prevDate.getMonth() + 1).toString().padStart(2, '0')}/\${prevDate.getFullYear()}\`;
        }
      }\n`;
        content = content.substring(0, idx) + insertCode + content.substring(idx);
        console.log('Target 2 replaced');

        // Also add 'previousVisitDate: prevVisitDateStr,' in return object
        const returnTarget = `visitDate: formattedVisitDate,`;
        if (content.includes(returnTarget)) {
            content = content.replace(returnTarget, `visitDate: formattedVisitDate,\n        previousVisitDate: prevVisitDateStr,`);
            console.log('Target 3 replaced');
        }
    } else {
        console.error('Target 2 not found');
    }

    fs.writeFileSync(file, content);
    console.log('done patching!');
}

patch();
