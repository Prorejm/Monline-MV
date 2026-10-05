// Push the batch commits to GitHub one at a time.
//
// Each push only carries the objects the remote does not have yet, so an 8 GB
// tree goes up as ~1 GB packs instead of one pack GitHub refuses.
//
// Written for node because the bundled python lost its stdlib.
//
//   node _shots/push_commits.js <token> [owner/repo]
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const TOKEN = process.argv[2] || '';
const REPO = process.argv[3] || 'Prorejm/Monline-MV';
const IDLE_LIMIT = 240;          // 240 * 20s = 80 quiet minutes before giving up

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8', maxBuffer: 1024 * 1024 * 256,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function gitQuiet(args) {
  try { return { code: 0, out: git(args) }; }
  catch (e) {
    return { code: (e.status === undefined ? -1 : e.status),
             out: (e.stdout || '') + (e.stderr || '') };
  }
}

function log(s) { process.stdout.write(s + '\n'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  gitQuiet(['remote', 'remove', 'origin']);
  const added = gitQuiet(['remote', 'add', 'origin',
    'https://' + TOKEN + '@github.com/' + REPO + '.git']);
  if (added.code !== 0) { log('remote add failed: ' + added.out); process.exit(2); }

  // Resume, do not restart.  Pushing an ancestor of the remote tip is a
  // backwards move and GitHub rejects it as non-fast-forward, so find out where
  // the remote already is and carry on from the commit after it.
  let startAt = 0;
  const probe = gitQuiet(['ls-remote', 'origin', 'refs/heads/main']);
  const remoteTip = probe.out.trim().split(/\s+/)[0] || '';
  if (remoteTip) {
    const shas = git(['rev-list', '--reverse', 'HEAD']).trim().split(/\s+/);
    const at = shas.indexOf(remoteTip);
    if (at >= 0) {
      startAt = at + 1;
      log('remote already has ' + startAt + '/' + shas.length +
          ' commits, resuming at ' + (startAt + 1));
    } else {
      log('remote tip ' + remoteTip.slice(0, 8) +
          ' is not in local history - pushing everything');
    }
  }

  let pushed = 0;
  let idle = 0;
  while (true) {
    const shas = git(['rev-list', '--reverse', 'HEAD']).trim().split(/\s+/);
    const todo = shas.slice(startAt);
    if (!todo.length) {
      idle += 1;
      if (idle >= IDLE_LIMIT) break;
      log('waiting for more commits... (pushed ' + pushed + ')');
      await sleep(20000);
      continue;
    }
    idle = 0;
    const sha = todo[0];
    let done = false;
    for (let attempt = 1; attempt <= 5 && !done; attempt++) {
      const r = gitQuiet(['push', 'origin', sha + ':refs/heads/main']);
      if (r.code === 0) { done = true; break; }
      log('  ' + sha.slice(0, 8) + ' try ' + attempt + ' failed: ' +
          r.out.trim().slice(0, 200));
      await sleep(15000);
    }
    if (!done) { log('STOPPED at ' + sha); process.exit(1); }
    startAt += 1;
    pushed += 1;
    log('[' + startAt + '/' + shas.length + '] ' + sha.slice(0, 8) + ' pushed');
  }
  log('ALL DONE - ' + pushed + ' commits pushed');
})();
