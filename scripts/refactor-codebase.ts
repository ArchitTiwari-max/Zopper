import * as fs from 'fs';
import * as path from 'path';

const srcDir = path.join(__dirname, '../src');

function walkDir(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      callback(filePath);
    }
  }
}

const replacements = [
  // 1. Prisma Query Models (except model definitions/maps)
  { from: /prisma\.executive\./g, to: 'prisma.employee.' },
  { from: /prisma\.admin\./g, to: 'prisma.employee.' },
  { from: /prisma\.executiveStoreAssignment\./g, to: 'prisma.employeeStoreAssignment.' },
  { from: /prisma\.adminVisit\./g, to: 'prisma.employeeVisit.' },

  // 2. User Payload Object Accessors (with safety options)
  { from: /user\?.executive\?/g, to: 'user?.employee?' },
  { from: /user\?.admin\?/g, to: 'user?.employee?' },
  { from: /user\.executive/g, to: 'user.employee' },
  { from: /user\.admin/g, to: 'user.employee' },

  // 3. Nested Include / Select statements in Prisma queries
  { from: /executive:\s*true/g, to: 'employee: true' },
  { from: /admin:\s*true/g, to: 'employee: true' },
  { from: /\bexecutive\b:\s*\{/g, to: 'employee: {' },
  { from: /\breviewedByAdmin\b:\s*\{/g, to: 'reviewedByEmployee: {' },
  { from: /\badmin\b:\s*\{/g, to: 'employee: {' },
  
  // 4. Relation arrays on Store and User/Employee models
  { from: /\.executiveStores/g, to: '.employeeStores' },
  { from: /\.adminVisits/g, to: '.employeeVisits' },
  { from: /executiveStores:\s*\{/g, to: 'employeeStores: {' },
  { from: /adminVisits:\s*\{/g, to: 'employeeVisits: {' }
];

console.log('🏁 Starting codebase refactoring of old Executive/Admin references...');

let modifiedFilesCount = 0;

walkDir(srcDir, (filePath) => {
  // Exclude node_modules, .git, or specific files we edited already
  if (filePath.includes('node_modules') || filePath.includes('.git')) return;
  if (filePath.includes('api/auth/verify-session/route.ts')) return;
  if (filePath.includes('api/auth/verify-otp/route.ts')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;

  for (const replacement of replacements) {
    newContent = newContent.replace(replacement.from, replacement.to);
  }

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✅ Refactored: ${path.relative(srcDir, filePath)}`);
    modifiedFilesCount++;
  }
});

console.log(`🎉 Finished refactoring! Modified ${modifiedFilesCount} files.`);
