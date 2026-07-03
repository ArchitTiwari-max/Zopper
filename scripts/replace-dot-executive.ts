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

console.log('🏁 Starting replacements of .executive. with .employee. in property paths...');

let modifiedFilesCount = 0;

walkDir(srcDir, (filePath) => {
  // Exclude node_modules, .git, or specific files we edited already
  if (filePath.includes('node_modules') || filePath.includes('.git')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.replace(/\.executive\./g, '.employee.');

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✅ Refactored: ${path.relative(srcDir, filePath)}`);
    modifiedFilesCount++;
  }
});

console.log(`🎉 Finished! Modified ${modifiedFilesCount} files.`);
