import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS, resolveDatasetPath, simulationRefs, chartFilePath } from '../src/utils/datasets.js';
import { adaptContract, adaptChart, adaptSimulation } from '../src/utils/adapters.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', 'public', 'data');
const CORE = ['kpis', 'charts', 'insights'];
let failed = false;

function readJson(rel) {
  const full = path.join(dataDir, rel);
  if (!fs.existsSync(full)) return { state: 'MISSING' };
  try {
    return { state: 'OK', value: JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '')) };
  } catch (err) {
    return { state: 'INVALID', message: 'not valid JSON' };
  }
}

function line(state, name, rel, note) {
  console.log(state.padEnd(12) + name.padEnd(22) + rel + (note ? '  ' + note : ''));
}

function evaluate(name, rel, adapt) {
  const file = readJson(rel);
  if (file.state !== 'OK') {
    line(file.state, name, rel, file.message || '');
    return file.state === 'INVALID' ? 'INVALID' : 'MISSING';
  }
  if (file.value && file.value.status === 'skipped') {
    line('UNAVAILABLE', name, rel, 'skipped: ' + (file.value.reason || 'no reason given'));
    return 'UNAVAILABLE';
  }
  try {
    adapt(file.value);
    line('OK', name, rel, '');
    return 'OK';
  } catch (err) {
    line('INVALID', name, rel, err && err.message);
    return 'INVALID';
  }
}

const contractFile = readJson('frontend_contract.json');
if (contractFile.state !== 'OK') {
  console.error('The contract file is missing or unreadable. Run the backend export, then npm run check.');
  process.exit(1);
}
let contract;
try {
  contract = adaptContract(contractFile.value);
} catch (err) {
  console.error('The contract is invalid: ' + (err && err.message));
  process.exit(1);
}
console.log('Project: ' + contract.project.name + '  (schema ' + contract.schemaVersion + ')');
console.log('');

const results = {};
for (const [name, def] of Object.entries(DATASETS)) {
  const rel = resolveDatasetPath(contract, def).replace(/^\/data\//, '');
  results[name] = evaluate(name, rel, def.adapt);
}

const chartsFile = readJson(resolveDatasetPath(contract, DATASETS.charts).replace(/^\/data\//, ''));
if (chartsFile.state === 'OK' && chartsFile.value && chartsFile.value.status !== 'skipped') {
  const entries = Array.isArray(chartsFile.value) ? chartsFile.value : (chartsFile.value.items || chartsFile.value.charts || []);
  for (const entry of entries) {
    const rel = chartFilePath(entry);
    if (rel) {
      const state = evaluate('chart ' + (entry.id || '?'), rel, adaptChart);
      if (state === 'INVALID') failed = true;
    }
  }
}

for (const ref of simulationRefs(contract).files) {
  const state = evaluate('simulation ' + ref.id, ref.file, adaptSimulation);
  if (state === 'INVALID') failed = true;
}

const leak = /([A-Za-z]:\\|\/Users\/|\/home\/)/;
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.json') && leak.test(fs.readFileSync(full, 'utf8'))) {
      console.error('LEAK        ' + path.relative(dataDir, full) + ' contains an absolute local path');
      failed = true;
    }
  }
};
walk(dataDir);

for (const [name, state] of Object.entries(results)) {
  if (state === 'INVALID') failed = true;
  if (CORE.includes(name) && state !== 'OK') failed = true;
}
console.log('');
if (failed) {
  console.error('Data check failed. Fix the lines marked INVALID or MISSING above, then run npm run check again.');
  process.exit(1);
}
console.log('Data check passed.');
