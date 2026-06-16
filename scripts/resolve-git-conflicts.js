const fs = require('fs');
const path = require('path');

// 1. Resolve src/app/api/executive/store/data/route.ts
const file1 = path.resolve('src/app/api/executive/store/data/route.ts');
if (fs.existsSync(file1)) {
  let content = fs.readFileSync(file1, 'utf8').replace(/\r\n/g, '\n');
  
  const search1 = `<<<<<<< HEAD
          storeBrands: {
            select: {
              brandId: true,
              brandType: true
            }
          },
=======
          partnerBrandIds: true,
          partnerBrandTypes: true,
          priority: true,
>>>>>>> 943c984119627f55c5b8e6661f819919385b9565`;

  const replace1 = `          storeBrands: {
            select: {
              brandId: true,
              brandType: true
            }
          },
          priority: true,`;

  const search2 = `<<<<<<< HEAD
            storeBrands: {
              select: {
                brandId: true,
                brandType: true
              }
            }
=======
            partnerBrandIds: true,
            partnerBrandTypes: true,
            priority: true,
>>>>>>> 943c984119627f55c5b8e6661f819919385b9565`;

  const replace2 = `            storeBrands: {
              select: {
                brandId: true,
                brandType: true
              }
            },
            priority: true,`;

  if (content.includes(search1) && content.includes(search2)) {
    content = content.replace(search1, replace1);
    content = content.replace(search2, replace2);
    fs.writeFileSync(file1, content, 'utf8');
    console.log("Resolved conflicts in executive store data route successfully!");
  } else {
    console.error("Conflict blocks not found in executive store data route!");
  }
} else {
  console.error("executive store data route file not found!");
}

// 2. Resolve src/app/api/admin/stores/data/route.ts
const file2 = path.resolve('src/app/api/admin/stores/data/route.ts');
if (fs.existsSync(file2)) {
  let content = fs.readFileSync(file2, 'utf8').replace(/\r\n/g, '\n');

  const search3 = `<<<<<<< HEAD
        storeBrands: {
          select: {
            brandId: true,
            brandType: true
          }
        },
=======
        partnerBrandIds: true,
        partnerBrandTypes: true,
        priority: true,
>>>>>>> 943c984119627f55c5b8e6661f819919385b9565`;

  const replace3 = `        storeBrands: {
          select: {
            brandId: true,
            brandType: true
          }
        },
        priority: true,`;

  if (content.includes(search3)) {
    content = content.replace(search3, replace3);
    fs.writeFileSync(file2, content, 'utf8');
    console.log("Resolved conflicts in admin stores data route successfully!");
  } else {
    console.error("Conflict blocks not found in admin stores data route!");
  }
} else {
  console.error("admin stores data route file not found!");
}
