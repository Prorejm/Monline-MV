# -*- coding: utf-8 -*-
"""Push the batched history to GitHub one commit at a time.

    python _shots/git_push.py <github-token> [owner/repo]

Every commit here is at most ~1 GB, so pushing them in order keeps each pack
small enough that GitHub accepts it.  A single push of the whole tree would be
one 8 GB pack and gets refused / throttled.
"""
import os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)


def git(*args):
    return subprocess.run(['git'] + list(args), capture_output=True,
                          text=True, encoding='utf-8', errors='replace')


def main():
    if len(sys.argv) < 2:
        sys.stdout.write('usage: python _shots/git_push.py <token> [owner/repo]\n')
        return 2
    token = sys.argv[1].strip()
    repo = sys.argv[2] if len(sys.argv) > 2 else 'Prorejm/Monline-MV'

    url = 'https://%s@github.com/%s.git' % (token, repo)
    r = git('remote', 'set-url', 'origin', url)
    if r.returncode != 0:
        git('remote', 'add', 'origin', url)

    shas = git('rev-list', '--reverse', 'HEAD').stdout.split()
    sys.stdout.write('%d commits to push\n' % len(shas))
    pushed = 0
    for i, sha in enumerate(shas, 1):
        for attempt in range(3):
            r = git('push', 'origin', '%s:refs/heads/main' % sha)
            if r.returncode == 0:
                pushed += 1
                sys.stdout.write('  [%2d/%2d] %s ok\n' % (i, len(shas), sha[:8]))
                break
            sys.stdout.write('  [%2d/%2d] %s attempt %d failed: %s\n'
                             % (i, len(shas), sha[:8], attempt + 1,
                                (r.stderr or '').strip()[:200]))
        else:
            sys.stdout.write('\nstopped at %s\n' % sha)
            return 1
    sys.stdout.write('\npushed %d/%d commits to https://github.com/%s\n'
                     % (pushed, len(shas), repo))
    return 0


sys.exit(main())
