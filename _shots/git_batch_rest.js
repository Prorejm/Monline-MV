// Commit the assets the first batching run never reached.
//
// git_batches.py was cut off part way through, so mv_project/img/pictures,
// mv_project/audio, Monline-MV/Graphics and extracted (~4.5 GB) are still
// untracked.  This commits just those, sliced by measured size so no single
// pack is big enough for GitHub to refuse.
//
// Written for node because the bundled python lost its stdlib.
//
//   node _shots/git_batch_rest.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

// GitHub is happiest with packs well under the 2 GB postBuffer.
const MAX = 650 * 1024 * 1024;

const TARGETS = [
  'mv_project/img/pictures',
  'mv_project/audio',
  'Monline-MV/Graphics',
  'extracted'
];

const TMP = path.join(ROOT, '_shots', '_chunk.txt');

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8', maxBuffer: 1024 * 1024 * 256,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function gitQuiet(args) {
  try {
    return { code: 0, out: git(args) };
  } catch (e) {
    return { code: (e.status === undefined ? -1 : e.status),
             out: (e.stdout || '') + (e.stderr || '') };
  }
}

function log(s) { process.stdout.write(s + '\n'); }

function size(p) {
  try {
    const st = fs.statSync(p);
    if (st.isFile()) return st.size;
  } catch (e) { return 0; }
  let total = 0;
  const stack = [p];
  while (stack.length) {
    const dir = stack.pop();
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of names) {
      const full = path.join(dir, n);
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }
      if (st.isDirectory()) stack.push(full);
      else total += st.size;
    }
  }
  return total;
}

function trackedAndClean(p) {
  if (!fs.existsSync(p)) return true;
  const r = gitQuiet(['status', '--porcelain', '--untracked-files=all', '--', p]);
  return r.out.trim() === '';
}

function commitGroup(msg, paths) {
  if (!paths.length) return 0;
  fs.writeFileSync(TMP, paths.join('\0') + '\0');
  const add = gitQuiet(['add', '--pathspec-from-file=' + TMP,
                        '--pathspec-file-nul']);
  if (add.code !== 0) {
    log('  ADD FAILED ' + msg + '\n' + add.out.slice(0, 400));
    return 0;
  }
  if (gitQuiet(['diff', '--cached', '--quiet']).code === 0) {
    log('  (nothing to commit) ' + msg);
    return 0;
  }
  const c = gitQuiet(['commit', '-q', '-m', msg]);
  if (c.code !== 0) {
    log('  COMMIT FAILED ' + msg + '\n' + c.out.slice(0, 400));
    return 0;
  }
  log('  ' + msg.slice(0, 50).padEnd(50) + ' ' + git(['rev-parse', '--short', 'HEAD']).trim());
  return 1;
}

function sliceDir(msg, dir, depth) {
  let part = 0;
  let made = 0;
  const flush = (bucket) => {
    if (!bucket.length) return 0;
    part += 1;
    const n = commitGroup(msg + ' (part ' + part + ')', bucket);
    bucket.length = 0;
    return n;
  };
  let names;
  try { names = fs.readdirSync(dir).sort(); } catch (e) { return 0; }
  const bucket = [];
  let cur = 0;
  for (const n of names) {
    const full = path.join(dir, n);
    const s = size(full);
    let isDir = false;
    try { isDir = fs.statSync(full).isDirectory(); } catch (e) { continue; }
    if (s > MAX && isDir && depth < 2) {
      made += flush(bucket); cur = 0;
      log('   -> descending into ' + full + ' (' + Math.round(s / 1048576) + ' MB)');
      made += sliceDir(msg + '/' + n, full, depth + 1);
      continue;
    }
    if (bucket.length && cur + s > MAX) { made += flush(bucket); cur = 0; }
    bucket.push(full.split(path.sep).join('/'));
    cur += s;
  }
  made += flush(bucket);
  return made;
}

let total = 0;
for (const t of TARGETS) {
  log('== ' + t);
  if (trackedAndClean(t)) { log('  already committed, skipping'); continue; }
  total += sliceDir(t, t, 0);
}

log('== leftovers');
gitQuiet(['add', '-A']);
if (gitQuiet(['diff', '--cached', '--quiet']).code !== 0) {
  const c = gitQuiet(['commit', '-q', '-m', 'Remaining files']);
  if (c.code === 0) { total += 1; log('  committed leftovers'); }
  else log('  LEFTOVER COMMIT FAILED\n' + c.out.slice(0, 400));
}

try { fs.unlinkSync(TMP); } catch (e) {}
log('\nnew commits: ' + total);
log('total commits: ' + git(['rev-list', '--count', 'HEAD']).trim());
for (const line of git(['count-objects', '-vH']).split('\n')) {
  if (line.indexOf('size-pack') >= 0) log(line.trim());
}
