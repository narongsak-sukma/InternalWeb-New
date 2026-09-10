/**
 * QA tooling — render .omc/reports/e2e-results.json as a markdown verdict table
 * for the v2 walkthrough report. Usage: node tests/gen-report.mjs [results.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, '.omc', 'reports', 'e2e-results.json');
const r = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const icon = { PASS: 'PASS', FLAKY: 'FLAKY', FAIL: '**FAIL**', SKIPPED: 'SKIP' };
let section = '';
const lines = [];
for (const x of r.results) {
  if (x.section !== section) {
    section = x.section;
    lines.push(`\n### ${section}\n`);
    lines.push('| ID | Check | Verdict | Evidence |');
    lines.push('|---|---|---|---|');
  }
  const ev = (x.evidence || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220);
  lines.push(`| ${x.id} | ${x.name.replace(/\|/g, '\\|')} | ${icon[x.status] || x.status} | ${ev} |`);
}
console.log(lines.join('\n'));
console.log(`\n**Counts:** ${JSON.stringify(r.counts)}`);
