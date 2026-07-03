import * as fs from 'fs';
import * as path from 'path';

const projectDir = path.join(__dirname, '..');

function replaceInFile(relativePath: string, replacements: { from: RegExp; to: string }[]) {
  const filePath = path.join(projectDir, relativePath);
  if (!fs.existsSync(filePath)) return;
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

// 1. Refactor src/app/api/executive/digital-visit/route.ts
replaceInFile('src/app/api/executive/digital-visit/route.ts', [
  // Revert incorrect employeeId back to executiveId in queries (Visit, DigitalVisit)
  { from: /\bemployeeId:\s*executive\.id/g, to: 'executiveId: executive.id' },
  // Fix compound input properties (executiveId inside employeeId_storeId should be employeeId)
  { from: /\bemployeeId_storeId:\s*\{\s*executiveId:\s*executive\.id/g, to: 'employeeId_storeId: { employeeId: executive.id' },
  // Fix v.executive reference to v.employee since we fetch employee
  { from: /\bv\.executive\?/g, to: 'v.employee?' }
]);

// 2. Refactor src/app/api/executive/visitform/route.ts
replaceInFile('src/app/api/executive/visitform/route.ts', [
  // Revert incorrect employeeId back to executiveId in queries (Visit, DigitalVisit, VisitPlan)
  { from: /\bemployeeId:\s*executive\.id/g, to: 'executiveId: executive.id' },
  // Fix compound input properties (executiveId inside employeeId_storeId should be employeeId)
  { from: /\bemployeeId_storeId:\s*\{\s*executiveId:\s*executive\.id/g, to: 'employeeId_storeId: { employeeId: executive.id' },
  // Fix v.executive reference to v.employee since we fetch employee
  { from: /\bv\.executive\b/g, to: 'v.employee' }
]);

console.log('🎉 Final query fix script execution complete!');
