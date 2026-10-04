# -*- coding: utf-8 -*-
"""Find every place the shipped data sets one of the Bad End achievement
switches (901-1206) and dump the surrounding text so we can reconstruct the
roster from the game itself instead of trusting the wiki."""
import json, glob, os, re, collections, io, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', 'Monline-MV', 'data')
LO, HI = 901, 1206

hits = collections.defaultdict(list)   # switch -> [(src, eventName, texts)]


def texts_of(cmds, limit=6):
    out = []
    for c in cmds or []:
        code = c.get('code')
        if code in (101, 401) and c.get('parameters'):
            # 101 = Show Text first line (face, ...), 401 = continuation
            p = c['parameters']
            txt = p[0] if code == 401 else (p[1] if len(p) > 1 else p[0])
            if isinstance(txt, str) and txt.strip():
                out.append(txt.strip())
            if len(out) >= limit:
                break
    return out


def walk(cmds, src, name):
    for c in cmds or []:
        if c.get('code') == 121:
            p = c.get('parameters') or []
            if len(p) >= 3 and p[2] == 0 and p[0] <= p[1]:
                for sid in range(p[0], p[1] + 1):
                    if LO <= sid <= HI:
                        hits[sid].append((src, name, texts_of(cmds)))


def as_list(x):
    if isinstance(x, list):
        return [e for e in x if isinstance(e, dict)]
    if isinstance(x, dict):
        return list(x.values())
    return []


def main():
    ce = json.load(open(os.path.join(ROOT, 'CommonEvents.json'), encoding='utf-8'))
    for e in as_list(ce):
        walk(e.get('list'), 'CE%s' % e.get('id'), e.get('name') or '')

    maps = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'Map*.json'))):
        base = os.path.basename(f).replace('.json', '')
        if not re.match(r'^Map\d+$', base):
            continue
        d = json.load(open(f, encoding='utf-8'))
        if not isinstance(d, dict):
            continue
        for e in as_list(d.get('events')):
            for pg in (e.get('pages') or []):
                if isinstance(pg, dict):
                    walk(pg.get('list'), base, e.get('name') or '')
        maps += 1

    troops = json.load(open(os.path.join(ROOT, 'Troops.json'), encoding='utf-8'))
    for t in as_list(troops):
        for pg in (t.get('pages') or []):
            if isinstance(pg, dict):
                walk(pg.get('list'), 'Troop%s' % t.get('id'), t.get('name') or '')

    sys.stdout.write('maps=%d\n' % maps)
    sys.stdout.write('endings set somewhere: %d\n' % len(hits))
    missing = [i for i in range(LO, HI + 1) if i not in hits]
    sys.stdout.write('endings with NO setter: %d\n' % len(missing))
    sys.stdout.write('missing ids: %s\n' % missing[:60])
    out = {}
    for sid in sorted(hits):
        out[str(sid)] = hits[sid][:3]
    dst = os.path.join(os.path.dirname(__file__), 'endings_scan.json')
    with io.open(dst, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    sys.stdout.write('wrote %s\n' % dst)


main()
