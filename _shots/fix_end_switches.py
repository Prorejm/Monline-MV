# -*- coding: utf-8 -*-
"""Repair the handful of Bad End events that write the wrong achievement switch.

Monline marks the end of a bad end with a literal banner command, e.g.

    code401 '\\{\\{\\{ Ending C31 - Once Bitten'
    code121 [906, 906, 0]        <- should be the switch named ACH: End C31
    code355 ['global_save']

Several endings were copy-pasted and never had their switch id updated, so
they all light up switch 906 (ACH: End A6).  This rewrites only that one
command - the marker immediately after the banner - to the canonical switch.

Run with --apply to write, otherwise it prints the plan.
"""
import json, glob, os, re, sys, io, shutil, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', 'Monline-MV', 'data'))
OTHER = os.path.abspath(os.path.join(HERE, '..', 'mv_project', 'data'))
BAK = os.path.abspath(os.path.join(HERE, '_bak_endsw'))
RX = re.compile(r'Ending\s*([A-F])\s*(\d+)\s*[-–]\s*(.+)')
APPLY = '--apply' in sys.argv


def canon():
    s = json.load(open(os.path.join(ROOT, 'System.json'), encoding='utf-8'))['switches']
    by_code = {}
    for i, n in enumerate(s):
        if not n:
            continue
        m = re.match(r'^ACH:\s*End\s*([A-F])\s*(\d+)\s*$', n.strip())
        if m:
            by_code['%s%d' % (m.group(1), int(m.group(2)))] = i
    assigned = set(by_code.values())
    orphan = [i for i in range(901, 1207) if i not in assigned]
    game = json.load(open(os.path.join(HERE, 'endings_game.json'), encoding='utf-8'))
    for code in sorted(game, key=lambda c: (c[0], int(c[1:]))):
        if code not in by_code and orphan:
            by_code[code] = orphan.pop(0)
    return s, by_code


def iter_lists():
    """yield (file, eventLabel, cmds) for every editable command list"""
    p = os.path.join(ROOT, 'CommonEvents.json')
    d = json.load(open(p, encoding='utf-8'))
    for e in d:
        if isinstance(e, dict):
            yield p, 'CE%s(%s)' % (e.get('id'), e.get('name') or ''), e.get('list') or []
    for f in sorted(glob.glob(os.path.join(ROOT, 'Map*.json'))):
        base = os.path.basename(f)[:-5]
        if not re.match(r'^Map\d+$', base):
            continue
        d = json.load(open(f, encoding='utf-8'))
        if not isinstance(d, dict):
            continue
        for e in (d.get('events') or []):
            if not isinstance(e, dict):
                continue
            for pi, pg in enumerate(e.get('pages') or []):
                if isinstance(pg, dict):
                    yield f, '%s ev%s(%s) p%d' % (base, e.get('id'), e.get('name') or '', pi), pg.get('list') or []


def main():
    switches, by_code = canon()
    plan = []
    for fpath, label, cmds in iter_lists():
        for i, c in enumerate(cmds):
            if c.get('code') not in (101, 401):
                continue
            p = c.get('parameters') or []
            txt = p[1] if c.get('code') == 101 and len(p) > 1 else (p[0] if p else '')
            if not isinstance(txt, str):
                continue
            m = RX.search(txt)
            if not m:
                continue
            code = '%s%d' % (m.group(1), int(m.group(2)))
            want = by_code.get(code)
            if want is None:
                continue
            # the marker is the first single-id switch-ON within 4 commands after
            for j in range(i + 1, min(len(cmds), i + 5)):
                d2 = cmds[j]
                if d2.get('code') != 121:
                    continue
                q = d2.get('parameters') or []
                if len(q) >= 3 and q[0] == q[1] and q[2] == 0:
                    if q[0] != want:
                        plan.append((fpath, label, j, code, q[0], want))
                    break
                break

    sys.stdout.write('planned rewrites: %d\n' % len(plan))
    for fpath, label, j, code, got, want in plan:
        sys.stdout.write('  %-28s %-4s [%d] %s -> %s  (now %r, want %r)\n'
                         % (label, code, j, got, want,
                            switches[got] if got < len(switches) else '?',
                            switches[want] if want < len(switches) else '?'))
    if not APPLY:
        sys.stdout.write('\n(dry run, pass --apply to write)\n')
        return

    # backup
    if not os.path.isdir(BAK):
        os.makedirs(BAK)
    touched = sorted(set(p[0] for p in plan))
    for f in touched:
        shutil.copy2(f, os.path.join(BAK, os.path.basename(f)))
    sys.stdout.write('\nbacked up %d files to %s\n' % (len(touched), BAK))

    # plan entries carry (file, label, cmdIndex, code, oldSwitch, newSwitch).
    # Re-walk each touched file in the exact same order, keyed by the command
    # list's identity, and patch the indexed command in place.
    by_file = collections.defaultdict(list)
    for fpath, label, j, code, got, want in plan:
        by_file[fpath].append((label, j, want))

    for fpath, edits in by_file.items():
        pending = collections.defaultdict(dict)
        for label, j, want in edits:
            pending[label][j] = want
        n = 0
        for fp, label, cmds in iter_lists():
            if fp != fpath:
                continue
            fix = pending.get(label)
            if not fix:
                continue
            for j, want in fix.items():
                cmds[j]['parameters'][0] = want
                cmds[j]['parameters'][1] = want
                n += 1
        # iter_lists() re-reads from disk each time, so reload -> mutate -> write
        # has to happen against one shared document.  Do it explicitly instead.
        d = json.load(open(fpath, encoding='utf-8'))
        seen = 0
        def walk_apply(container_getter):
            nonlocal seen
            pass
        # rebuild the same traversal against `d`
        def lists_of(doc):
            if fpath.endswith('CommonEvents.json'):
                for e in doc:
                    if isinstance(e, dict):
                        yield 'CE%s(%s)' % (e.get('id'), e.get('name') or ''), e.get('list') or []
            else:
                for e in (doc.get('events') or []):
                    if not isinstance(e, dict):
                        continue
                    for pi, pg in enumerate(e.get('pages') or []):
                        if isinstance(pg, dict):
                            yield ('%s ev%s(%s) p%d'
                                   % (os.path.basename(fpath)[:-5], e.get('id'),
                                      e.get('name') or '', pi)), pg.get('list') or []
        for label, cmds in lists_of(d):
            fix = pending.get(label)
            if not fix:
                continue
            for j, want in fix.items():
                cmds[j]['parameters'][0] = want
                cmds[j]['parameters'][1] = want
                seen += 1
        with io.open(fpath, 'w', encoding='utf-8') as fh:
            json.dump(d, fh, ensure_ascii=False)
        sys.stdout.write('  %s: %d edits (verified %d)\n'
                         % (os.path.basename(fpath), n, seen))
        if seen != len(edits):
            sys.stdout.write('  !! MISMATCH, aborting\n')
            return
    sys.stdout.write('done\n')


main()
