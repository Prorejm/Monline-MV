// Which VX Ace scripts have no counterpart in the MV port?
//
// Node port of script_coverage.py (the bundled python lost its stdlib).
// For every _vxace_scripts/*.rb it pulls out the fingerprints a port is
// obliged to reproduce - $imported["KEY"] markers and class/module names -
// and greps the shipped MV javascript for them.
//
//   node _shots/script_coverage.js            # unported only
//   node _shots/script_coverage.js --all      # everything
//   node _shots/script_coverage.js 0123       # one script, with the hits
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUBY = path.join(ROOT, '_vxace_scripts');
const MV = [path.join(ROOT, 'Monline-MV', 'js', 'plugins'),
            path.join(ROOT, 'Monline-MV', 'js')];

const SKIP_JS = new Set(['plugins.js', 'main.js']);

const STOCK = new Set(['RPG', 'Graphics', 'Input', 'Cache', 'DataManager',
  'Numeric', 'String', 'Array', 'Hash', 'Math', 'Kernel']);

function read(p) { return fs.readFileSync(p, 'utf8'); }

function banner(src) {
  for (const line of src.split('\n').slice(0, 24)) {
    let s = line.trim();
    if (!s.startsWith('#')) continue;
    s = s.replace(/^#+/, '').trim();
    if (!s) continue;
    if (/^[=\-_~]/.test(s)) continue;
    if (s.indexOf('RPG Maker VX Ace') >= 0) continue;
    return s.slice(0, 78);
  }
  return '?';
}

function fingerprints(src) {
  const out = [];
  let m;
  const reImp = /\$imported\[["']([^"']+)["']\]/g;
  while ((m = reImp.exec(src))) out.push(['imported', m[1]]);
  const reCls = /^\s*(?:class|module)\s+([A-Z][A-Za-z0-9_:]*)/gm;
  while ((m = reCls.exec(src))) {
    if (STOCK.has(m[1].split('::')[0])) continue;
    out.push(['class', m[1]]);
  }
  return out;
}

const jsFiles = [];
for (const d of MV) {
  for (const f of fs.readdirSync(d).sort()) {
    if (!f.endsWith('.js')) continue;
    if (SKIP_JS.has(f) || f === 'plugins.js') continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isFile()) jsFiles.push(read(p));
  }
}
const blob = jsFiles.join('\n');

const argv = process.argv.slice(2);
const only = argv.find(a => !a.startsWith('--')) || null;
const showAll = argv.indexOf('--all') >= 0;

const rows = [];
for (const f of fs.readdirSync(RUBY).sort()) {
  if (!f.endsWith('.rb')) continue;
  if (only && !f.startsWith(only)) continue;
  const src = read(path.join(RUBY, f));
  const fps = fingerprints(src);
  const hits = [], misses = [];
  for (const [kind, name] of fps) {
    const needle = kind === 'imported' ? name : name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(needle).test(blob)) hits.push(name);
    else misses.push(name);
  }
  rows.push([f.slice(0, 4), banner(src), fps.length, hits, misses]);
}

const w = Math.max(...rows.map(r => r[1].length)) + 2;
console.log('script  ' + 'title'.padEnd(w) + '  fp  found  missing');
console.log('-'.repeat(w + 30));
let unported = 0;
for (const [num, title, total, hits, misses] of rows) {
  if (!misses.length) {
    if (showAll || only) {
      console.log(num + '  ' + title.padEnd(w) + '  ' +
        String(total).padStart(2) + '  ' + String(hits.length).padStart(5) + '  -');
    }
    continue;
  }
  unported++;
  console.log(num + '  ' + title.padEnd(w) + '  ' +
    String(total).padStart(2) + '  ' + String(hits.length).padStart(5) + '  ' +
    [...new Set(misses)].sort().slice(0, 6).join(', '));
  if (only) console.log('      found: ' + [...new Set(hits)].sort().slice(0, 20).join(', '));
}
console.log('-'.repeat(w + 30));
console.log(unported + '/' + rows.length +
  ' scripts leave at least one fingerprint unmatched');
