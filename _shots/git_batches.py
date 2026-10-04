# -*- coding: utf-8 -*-
"""Commit the Monline MV port in batches.

The tree is ~8 GB / 36k files.  A single pack that size is refused or heavily
throttled by GitHub, so the history is cut into ~1 GB commits that can be
pushed one at a time.  Nothing is pushed here - see git_push.py for that.
"""
import os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)


def git(*args, **kw):
    return subprocess.run(['git'] + list(args), capture_output=True,
                          text=True, encoding='utf-8', errors='replace', **kw)


def commit(msg, paths, fromfile=None):
    if fromfile:
        r = git('add', '--pathspec-from-file=' + fromfile, '--pathspec-file-nul')
    else:
        r = git('add', '--', *paths)
    if r.returncode != 0:
        sys.stdout.write('  ADD FAILED %s\n%s\n' % (msg, r.stderr[:400]))
        return False
    chk = git('diff', '--cached', '--quiet')
    if chk.returncode == 0:
        sys.stdout.write('  (nothing to commit) %s\n' % msg)
        return True
    if fromfile:
        r = git('commit', '-q', '-m', msg)
    else:
        r = git('commit', '-q', '-m', msg)
    if r.returncode != 0:
        sys.stdout.write('  COMMIT FAILED %s\n%s\n' % (msg, r.stderr[:400]))
        return False
    sha = git('rev-parse', '--short', 'HEAD').stdout.strip()
    sys.stdout.write('  %-52s %s\n' % (msg[:52], sha))
    return True


def chunk_commit(msg, folder, parts):
    """Split one directory's immediate children across N commits."""
    if not os.path.isdir(folder):
        return
    names = sorted(os.listdir(folder))
    if not names:
        return
    size = (len(names) + parts - 1) // parts
    tmp = os.path.join(ROOT, '_shots', '_chunk.txt')
    for i in range(parts):
        group = names[i * size:(i + 1) * size]
        if not group:
            continue
        with open(tmp, 'wb') as fh:
            fh.write('\0'.join(os.path.join(folder, n) for n in group).encode('utf-8'))
            fh.write(b'\0')
        commit('%s (part %d/%d)' % (msg, i + 1, parts), None, fromfile=tmp)
    if os.path.exists(tmp):
        os.remove(tmp)


def main():
    sys.stdout.write('== metadata, tools, original Ruby, probes\n')
    root_files = [f for f in os.listdir('.') if os.path.isfile(f) and f != '.gitignore']
    commit('Port tooling, conversion scripts and docs',
           ['.gitignore'] + root_files)
    for d in ('_vxace_scripts', '_shots', 'vxace_data_backup'):
        if os.path.isdir(d):
            commit('Original VX Ace Ruby scripts (0000-0274)' if d == '_vxace_scripts'
                   else ('Browser probes, unit checks and smoke harness' if d == '_shots'
                         else 'Original VX Ace data backup'), [d])

    for proj in ('Monline-MV', 'mv_project'):
        sys.stdout.write('== %s : code and database\n' % proj)
        commit('%s: engine shims and the ported plugins' % proj,
               [os.path.join(proj, 'js')])
        commit('%s: converted MV database (510 maps)' % proj,
               [os.path.join(proj, 'data')])
        commit('%s: project files, fonts, icon' % proj,
               [os.path.join(proj, p) for p in
                ('index.html', 'package.json', 'Game.rpgproject', 'fonts', 'icon')
                if os.path.exists(os.path.join(proj, p))])

        sys.stdout.write('== %s : image sheets\n' % proj)
        img = os.path.join(proj, 'img')
        for d in sorted(os.listdir(img)) if os.path.isdir(img) else []:
            p = os.path.join(img, d)
            if not os.path.isdir(p):
                continue
            if d == 'pictures':
                continue
            commit('%s img/%s' % (proj, d), [p])

        sys.stdout.write('== %s : event pictures\n' % proj)
        chunk_commit('%s img/pictures' % proj, os.path.join(img, 'pictures'), 3)

        sys.stdout.write('== %s : audio\n' % proj)
        au = os.path.join(proj, 'audio')
        if os.path.isdir(au):
            for d in sorted(os.listdir(au)):
                p = os.path.join(au, d)
                if os.path.isdir(p):
                    commit('%s audio/%s' % (proj, d), [p])

    sys.stdout.write('== Monline-MV/Graphics (VX Ace source art)\n')
    g = os.path.join('Monline-MV', 'Graphics')
    if os.path.isdir(g):
        for d in sorted(os.listdir(g)):
            p = os.path.join(g, d)
            if not os.path.isdir(p):
                continue
            if d == 'Pictures':
                continue
            commit('Monline-MV Graphics/%s' % d, [p])
        chunk_commit('Monline-MV Graphics/Pictures', os.path.join(g, 'Pictures'), 3)

    sys.stdout.write('== extracted VX Ace assets\n')
    ex = 'extracted'
    if os.path.isdir(ex):
        for d in sorted(os.listdir(ex)):
            p = os.path.join(ex, d)
            if os.path.isdir(p):
                chunk_commit('extracted/%s' % d, p,
                             3 if d == 'Graphics' else 1)

    sys.stdout.write('== leftovers\n')
    git('add', '-A')
    if git('diff', '--cached', '--quiet').returncode != 0:
        git('commit', '-q', '-m', 'Remaining files')
        sys.stdout.write('  committed leftovers\n')

    n = git('rev-list', '--count', 'HEAD').stdout.strip()
    sz = git('count-objects', '-vH').stdout
    sys.stdout.write('\ncommits: %s\n' % n)
    for line in sz.split('\n'):
        if 'size-pack' in line:
            sys.stdout.write('%s\n' % line.strip())


main()
