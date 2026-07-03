import * as fs from 'fs';
import * as path from 'path';

const projectDir = path.join(__dirname, '..');

// Helper to replace text in a file
function replaceInFile(relativePath: string, replacements: { from: RegExp | string; to: string }[]) {
  const filePath = path.join(projectDir, relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${relativePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  for (const rep of replacements) {
    content = content.replace(rep.from, rep.to);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Refactored: ${relativePath}`);
  }
}

// 1. Fix ReferenceError in visitform/route.ts
replaceInFile('src/app/api/executive/visitform/route.ts', [
  { from: 'const [execVisitsRaw, adminVisitsRaw]', to: 'const [execVisitsRaw, employeeVisitsRaw]' }
]);

// 2. Global replacements for reviewedByAdmin and executiveId_storeId
const globalFiles = [
  'src/app/api/executive/digital-visit/route.ts',
  'src/app/api/executive/digital-visits/data/route.ts',
  'src/app/api/executive/visits/data/route.ts',
  'src/app/api/executive/stakeholder-visit/route.ts',
  'src/app/api/executive/subordinate-visits/route.ts',
  'src/app/api/executive/subordinate-visits/export/route.ts',
  'src/app/api/admin/digital-report/[id]/mark-reviewed/route.ts',
  'src/app/api/admin/stakeholder-visit-report/data/route.ts',
  'src/app/api/admin/digital-report/data/route.ts',
  'src/app/api/admin/stakeholder-visit-report/[id]/mark-reviewed/route.ts',
  'src/app/api/admin/admin-visit-report/[id]/mark-reviewed/route.ts',
  'src/app/api/admin/visit-report/data/route.ts',
  'src/app/api/admin/visit-report/[id]/mark-reviewed/route.ts'
];

for (const relFile of globalFiles) {
  replaceInFile(relFile, [
    { from: /\breviewedByAdmin\b/g, to: 'reviewedByEmployee' },
    { from: /\bexecutiveId_storeId\b/g, to: 'employeeId_storeId' }
  ]);
}

// 3. Fix employeeStoreAssignment query parameters (executiveId -> employeeId) in targeted files
const assignmentFiles = [
  'src/lib/optimized-store-import.ts',
  'src/querryRunner/stores/store.ts',
  'src/app/api/executive/rag-analytics/route.ts',
  'src/app/api/executive/stores/rag-status/route.ts',
  'src/app/api/executive/stores/rag-summary/route.ts',
  'src/app/api/admin/stores/data/route.ts',
  'src/app/api/executive/store/flag/route.ts',
  'src/app/api/executive/visitform/route.ts',
  'src/app/api/executive/digital-visit/route.ts',
  'src/querryRunner/stores/mergeDuplicateStores.ts'
];

for (const relFile of assignmentFiles) {
  replaceInFile(relFile, [
    { from: /\bexecutiveId_storeId\b/g, to: 'employeeId_storeId' },
    { from: /\bexecutiveId\b\s*:/g, to: 'employeeId:' } // Only changes field name inside queries
  ]);
}

console.log('🎉 Refactoring script finished!');
