# -*- coding: utf-8 -*-
"""Commit the assets the first batching run never reached.

git_batches.py was cut off part way through, so mv_project/img/pictures,
mv_project/audio, Monline-MV/Graphics and extracted (~4.5 GB) are still
untracked.  This commits just those, sliced by measured size so no single
pack is big enough for GitHub to refuse.

Nothing is pushed here - see push_commits.py.
"""
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)

# GitHub is happiest with packs well under the 2 GB postBuffer.
MAX = 650 * 1024 * 1024

TARGETS = [
    'mv_project/img/pictures',
    'mv_project/audio',
    'Monline-MV/Graphics',
    'extracted',
]

TMP = os.path.join(ROOT, '_shots', '_chunk.txt')
PART = [0]


def git(*args, **kw):
    return subprocess.run(['git'] + list(args), capture_output=True,
                          text=True, encoding='utf-8', errors='replace', **kw)


def log(s):
    sys.stdout.write(s + '\n')
    sys.stdout.flush()


def size(path):
    if os.path.isfile(path):
        try:
            return os.path.getsize(path)
        except OSError:
            return 0
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def tracked_and_clean(path):
    """True when nothing under path still needs committing."""
    if not os.path.exists(path):
        return True
    r = git('status', '--porcelain', '--untracked-files=all', '--', path)
    return r.stdout.strip() == ''


def commit_group(msg, paths):
    if not paths:
        return 0
    with open(TMP, 'wb') as fh:
        fh.write('\0'.join(paths).encode('utf-8'))
        fh.write(b'\0')
    r = git('add', '--pathspec-from-file=' + TMP, '--pathspec-file-nul')
    if r.returncode != 0:
        log('  ADD FAILED %s\n%s' % (msg, (r.stderr or '')[:400]))
        return 0
    if git('diff', '--cached', '--quiet').returncode == 0:
        log('  (nothing to commit) %s' % msg)
        return 0
    r = git('commit', '-q', '-m', msg)
    if r.returncode != 0:
        log('  COMMIT FAILED %s\n%s' % (msg, (r.stderr or '')[:400]))
        return 0
    sha = git('rev-parse', '--short', 'HEAD').stdout.strip()
    log('  %-50s %s' % (msg[:50], sha))
    return 1


def flush(msg, bucket):
    if not bucket:
        return 0
    PART[0] += 1
    made = commit_group('%s (part %d)' % (msg, PART[0]), bucket)
    del bucket[:]
    return made


def slice_dir(msg, path, depth=0):
    """Commit path's children in size-bounded groups, recursing into hogs."""
    PART[0] = 0
    try:
        names = sorted(os.listdir(path))
    except OSError:
        return 0
    made = 0
    bucket = []
    cur = 0
    for n in names:
        p = os.path.join(path, n)
        s = size(p)
        if s > MAX and os.path.isdir(p) and depth < 2:
            made += flush(msg, bucket)
            cur = 0
            log('   -> descending into %s (%d MB)' % (p, s // 1048576))
            made += slice_dir('%s/%s' % (msg, n), p, depth + 1)
            continue
        if bucket and cur + s > MAX:
            made += flush(msg, bucket)
            cur = 0
        bucket.append(p)
        cur += s
    made += flush(msg, bucket)
    return made


def main():
    total = 0
    for t in TARGETS:
        log('== %s' % t)
        if tracked_and_clean(t):
            log('  already committed, skipping')
            continue
        total += slice_dir(t, t)

    log('== leftovers')
    git('add', '-A')
    if git('diff', '--cached', '--quiet').returncode != 0:
        git('commit', '-q', '-m', 'Remaining files')
        total += 1
        log('  committed leftovers')

    if os.path.exists(TMP):
        os.remove(TMP)
    log('\nnew commits: %d' % total)
    log('total commits: %s' % git('rev-list', '--count', 'HEAD').stdout.strip())
    for line in git('count-objects', '-vH').stdout.split('\n'):
        if 'size-pack' in line:
            log(line.strip())


main()
