# -*- coding: utf-8 -*-
"""Map each still-unported VX Ace call name back to the script that defines it.

Without this we would be inventing behaviour; with it every port has a mother
script to read.  Ruby is snake_case, so each JS/camel name is searched in
several spellings.
"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, '_vxace_scripts')

NAMES = [
    'setSelfSwitch', 'global_save', 'global_load', 'log_window', 'combine_choices',
    'equip_armor_by_etype', 'zoom_event_sprite', 'zoom_player_sprite', 'weather',
    'set_symbols', 'chain_commands', 'remove_equip', 'Set_Coord', 'Clear_Coord',
    'snooze_bar', 'remove_bar', 'get_shop', 'price_good', 'setAllSelf', 'blinds',
    'get_hp_percent', 'TargetQTE', 'MashQTE', 'TriggerQTE', 'TimingQTE',
    'reflect_sprite', 'gain_armor', 'char_effects',
]


def to_snake(n):
    # Set_Coord -> set_coord ; setSelfSwitch -> set_self_switch
    s = re.sub(r'(?<!^)(?=[A-Z])', '_', n).lower()
    s = s.replace('__', '_')
    return s


def candidates(n):
    out = {n, n.lower(), to_snake(n)}
    out.add(n.replace('_', ''))
    out.add(to_snake(n).replace('_', ''))
    return [c for c in out if c]


def load():
    files = {}
    for f in sorted(os.listdir(SCRIPTS)):
        if f.endswith('.rb'):
            files[f] = io.open(os.path.join(SCRIPTS, f), encoding='utf-8', errors='replace').read()
    return files


DEF_PATS = [
    r'\bdef\s+self\.{c}\b',
    r'\bdef\s+{c}\b',
    r'\bclass\s+{c}\b',
    r'\bmodule\s+{c}\b',
    r'\b{c}\s*=\s*',
]


def main():
    files = load()
    for n in NAMES:
        hits = {}
        for c in candidates(n):
            for pat in DEF_PATS:
                rx = re.compile(pat.format(c=re.escape(c)))
                for fn, txt in files.items():
                    m = rx.search(txt)
                    if m:
                        hits.setdefault(fn, []).append(c)
        if hits:
            # prefer the file with the most distinct spellings matched
            best = sorted(hits.items(), key=lambda kv: -len(set(kv[1])))[:3]
            print('%-22s -> %s' % (n, ', '.join('%s(%s)' % (f, '/'.join(sorted(set(cs)))) for f, cs in best)))
        else:
            print('%-22s -> NOT FOUND in any .rb' % n)


if __name__ == '__main__':
    main()
