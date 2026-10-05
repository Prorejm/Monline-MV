# -*- coding: utf-8 -*-
"""Push the batch commits to GitHub one at a time.

Each push only carries the objects the remote does not have yet, so an 8 GB
tree goes up as ~1 GB packs instead of one pack GitHub refuses.

    python _shots/push_commits.py <token> <owner/repo>
"""
import os, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)
TOKEN = sys.argv[1] if len(sys.argv) > 1 else ''
REPO = sys.argv[2] if len(sys.argv) > 2 else 'Prorejm/Monline-MV'


def git(*a):
    return subprocess.run(['git'] + list(a), capture_output=True,
                          text=True, encoding='utf-8', errors='replace')


def log(s):
    sys.stdout.write(s + '\n')
    sys.stdout.flush()


def main():
    git('remote', 'remove', 'origin')
    r = git('remote', 'add', 'origin',
            'https://%s@github.com/%s.git' % (TOKEN, REPO))
    if r.returncode != 0:
        log('remote add failed: ' + r.stderr)
        return 2

    # Resume, do not restart.  Pushing an ancestor of the remote tip is a
    # backwards move and GitHub rejects it as non-fast-forward, so find out
    # where the remote already is and carry on from the commit after it.
    start_at = 0
    probe = git('ls-remote', 'origin', 'refs/heads/main')
    remote_tip = probe.stdout.split()[0] if probe.stdout.strip() else ''
    if remote_tip:
        shas = git('rev-list', '--reverse', 'HEAD').stdout.split()
        if remote_tip in shas:
            start_at = shas.index(remote_tip) + 1
            log('remote already has %d/%d commits, resuming at %d'
                % (start_at, len(shas), start_at + 1))
        else:
            log('remote tip %s is not in local history - pushing everything'
                % remote_tip[:8])

    total_ok = 0
    idle_rounds = 0
    while True:
        shas = git('rev-list', '--reverse', 'HEAD').stdout.split()
        todo = shas[start_at:]
        if not todo:
            idle_rounds += 1
            if idle_rounds >= 40:
                break
            log('waiting for more commits... (pushed %d)' % total_ok)
            time.sleep(20)
            continue
        idle_rounds = 0
        sha = todo[0]
        ok = False
        for attempt in range(4):
            r = git('push', 'origin', '%s:refs/heads/main' % sha)
            if r.returncode == 0:
                ok = True
                break
            log('  %s try %d failed: %s'
                % (sha[:8], attempt + 1, (r.stderr or '').strip()[:200]))
            time.sleep(10)
        if not ok:
            log('STOPPED at %s' % sha)
            return 1
        start_at += 1
        total_ok += 1
        log('[%d/%d] %s pushed' % (start_at, len(shas), sha[:8]))
    log('ALL DONE - %d commits pushed' % total_ok)
    return 0


sys.exit(main())
