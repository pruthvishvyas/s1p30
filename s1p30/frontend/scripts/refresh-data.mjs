import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const source = path.resolve(frontendRoot, '..', 'backend', 'output');
const target = path.resolve(frontendRoot, 'public', 'data');

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

if (fs.existsSync(path.join(source, 'frontend_contract.json'))) {
  const normalized = target.split(path.sep).join('/');
  if (!normalized.endsWith('frontend/public/data')) fail(['Refusing to replace an unexpected folder: ' + target]);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  let count = 0;
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else count += 1;
    }
  };
  walk(target);
  let stamp = 'unknown';
  try {
    stamp = JSON.parse(fs.readFileSync(path.join(target, 'frontend_contract.json'), 'utf8').replace(/^\uFEFF/, '')).generated_at || 'unknown';
  } catch { /* the check step reports unreadable contracts */ }
  console.log('Data copied: ' + count + ' files (backend output written ' + stamp + ')');
} else if (fs.existsSync(path.join(target, 'frontend_contract.json'))) {
  console.log('Using the existing data copy in public/data');
} else {
  fail([
    'No data found. Run the backend first: python main.py, then python export_for_frontend.py.',
    'Then run this command again.',
  ]);
}
