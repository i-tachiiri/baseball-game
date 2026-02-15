import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('find src functions -name "*.ts" -o -name "*.js"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let ok = true;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('any')) {
    console.error(`lint error: avoid any in ${file}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log(`lint ok: ${files.length} files checked`);
