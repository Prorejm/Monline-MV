# -*- coding: utf-8 -*-
"""Census of VX Ace script-call names that still have no real MV port.

For each name we know the bridge/shim can see, count how many times the
converted data actually references it.  This is the priority list for the
remaining port: a name used 600 times matters more than one used twice.
"""
import io, os, re, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'Monline-MV', 'data')
PLUG = os.path.join(ROOT, 'Monline-MV', 'js', 'plugins')

# names the shim stubs (or the bridge knows) that may still be unported
NAMES = [
    'global_save', 'global_load', 'log_window', 'chain_commands', 'combine_choices',
    'zoom_event_sprite', 'zoom_player_sprite', 'reflect_sprite', 'weather',
    'get_shop', 'price_good', 'hide_good', 'disable_good', 'gain_armor',
    'remove_equip', 'equip_armor_by_etype', 'get_hp_percent', 'remove_bar',
    'snooze_bar', 'set_symbols', 'setAllSelf', 'setSelfSwitch',
    'Clear_Coord', 'Set_Coord', 'char_effects',
    'MashQTE', 'TargetQTE', 'TriggerQTE', 'TimingQTE',
    'lock_pick', 'picture_monopoly', 'icon_scroll', 'weather_stop',
]


def data_text():
    buf = []
    for f in sorted(os.listdir(DATA)):
        if not f.endswith('.json'):
            continue
        try:
            buf.append(io.open(os.path.join(DATA, f), encoding='utf-8').read())
        except Exception:
            pass
    return '\n'.join(buf)


def plugin_files():
    """Map plugin file -> text, excluding the shim (which only plants no-ops)."""
    out = {}
    for f in sorted(os.listdir(PLUG)):
        if not f.endswith('.js') or f == 'MonlineShim.js':
            continue
        try:
            out[f] = io.open(os.path.join(PLUG, f), encoding='utf-8').read()
        except Exception:
            pass
    return out


def is_ported(name, files):
    """Real port = assigned/defined by a plugin other than MonlineShim.

    Counting MonlineShim would make every stub look 'ported': it defines each
    missing global as `function(){}` precisely so the game does not crash.
    """
    pats = [
        r'window\.' + re.escape(name) + r'\s*=',
        r'^\s*function\s+' + re.escape(name) + r'\s*\(',
        r'^\s*' + re.escape(name) + r'\s*:\s*function',
        r'Game_\w+\.prototype\.' + re.escape(name) + r'\s*=',
        # the Ruby bridge installs its helpers on the `F` scope object, which
        # becomes the `with(__scope)` target at eval time.  `F.setSelfSwitch =`
        # is just as real a port as `window.setSelfSwitch =`.
        r'\bF\.' + re.escape(name) + r'\s*=',
        # Scene/Window ports arrive as accessor properties
        r"Object\.defineProperty\([^)]*'" + re.escape(name) + r"'",
    ]
    for fn, txt in files.items():
        for p in pats:
            if re.search(p, txt, re.M):
                return fn
    return None


def main():
    dtext = data_text()
    files = plugin_files()
    rows = []
    for n in NAMES:
        cnt = len(re.findall(r'\b' + re.escape(n) + r'\b', dtext))
        where = is_ported(n, files)
        rows.append((n, cnt, where))
    rows.sort(key=lambda r: -r[1])
    print('%-22s %6s  %s' % ('name', 'refs', 'real port (or MISSING)'))
    print('-' * 62)
    tot = 0
    miss = []
    for n, c, where in rows:
        print('%-22s %6d  %s' % (n, c, where if where else '*** MISSING ***'))
        if not where:
            tot += c
            miss.append((n, c))
    print('-' * 62)
    print('still unported: %d names, %d refs' % (len(miss), tot))
    for n, c in miss:
        print('   %-22s %6d' % (n, c))


if __name__ == '__main__':
    main()
