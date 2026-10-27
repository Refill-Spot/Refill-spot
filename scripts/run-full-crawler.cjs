const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const all = JSON.parse(fs.readFileSync('logs/crawler-full-manifest.json', 'utf8'));
const summaries = [];
for (let i = 0; i < all.length; i += 20) {
  const batch = Math.floor(i / 20) + 1;
  const manifest = path.join(root, `logs/crawler-full-batch-${batch}.json`);
  const report = path.join(root, `logs/crawler-full-batch-${batch}-report.json`);
  fs.writeFileSync(manifest, JSON.stringify(all.slice(i, i + 20)));
  const result = spawnSync('C:/refill-spot/refill-spot-crawler/venv/Scripts/python.exe', [
    'scripts/collect_staging.py', '--manifest', manifest,
    '--checkpoint', path.join(root, 'logs/crawler-full-checkpoint.json'),
    '--output', path.join(root, 'logs/crawler-full-staging.json'),
    '--report', report, '--limit', '20', '--gap', '3', '--confirm-source-permission',
  ], { cwd: 'C:/refill-spot/refill-spot-crawler', encoding: 'utf8', timeout: 2600000, maxBuffer: 2000000 });
  if (result.error || ![0, 1].includes(result.status) || !fs.existsSync(report)) {
    console.log(JSON.stringify({ batch, error: 'batch_failed_or_timed_out', checkpointPreserved: true }));
    process.exitCode = 1;
    break;
  }
  const data = JSON.parse(fs.readFileSync(report, 'utf8'));
  summaries.push({ batch, attempted: data.attempted, succeeded: data.succeeded, resumed: data.resumed, errors: data.errors, stopped: data.stopped });
  fs.writeFileSync('logs/crawler-full-progress.json', JSON.stringify({ eligible: all.length, summaries }, null, 2));
  console.log(JSON.stringify(summaries.at(-1)));
  if (data.stopped && data.stopped !== 'limit') {
    process.exitCode = 1;
    break;
  }
}
const checkpoint = 'logs/crawler-full-checkpoint.json';
if (fs.existsSync(checkpoint)) {
  const saved = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
  const counts = {};
  for (const row of Object.values(saved.records)) counts[row.status] = (counts[row.status] || 0) + 1;
  const result = { eligible: all.length, processed: Object.keys(saved.records).length, pending: all.length - Object.keys(saved.records).length, held: 3, counts, productionWrites: 0 };
  fs.writeFileSync('logs/crawler-full-summary.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
