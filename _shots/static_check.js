// Static validation of the Ruby -> JS bridge, without a browser.
//   node static_check.js
//
// Loads MonlineRubyBridge.js in a stub environment, then runs every distinct
// script payload found in the project data through MonlineRuby.translate() and
// tries to compile the result with `new Function` - the exact same step the
// plugin performs at runtime.  Anything that fails to compile is a snippet
// whose event would silently do nothing, so we want the list empty.
const fs = require('fs');
const path = require('path');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const PLUGIN = path.join(ROOT, 'js/plugins/MonlineRubyBridge.js');
const DATA = path.join(ROOT, 'data');

// ---------------------------------------------------------------- stub env
function stubClass(name, methods) {
    const C = function() {};
    C.name = name;
    methods.forEach(m => { C.prototype[m] = function() {}; });
    return C;
}
const protoMethods = ['processMoveCommand', 'updateStop', 'setImage', 'setDirection',
    'moveSpeed', 'setMoveSpeed', 'isDashing', 'locate', 'jump', 'moveTowardCharacter',
    'moveAwayFromCharacter', 'turnTowardCharacter', 'requestAnimation', 'requestBalloon',
    'eventId', 'update'];

const g = globalThis;
g.window = g;
g.Game_Character = stubClass('Game_Character', protoMethods);
g.Game_Event = stubClass('Game_Event', protoMethods);
g.Game_Player = stubClass('Game_Player', protoMethods);
g.Game_Interpreter = stubClass('Game_Interpreter', protoMethods.concat(['currentCommand', 'nextEventCode', 'command355']));
g.Game_Action = stubClass('Game_Action', ['evalDamageFormula']);
g.Scene_Base = stubClass('Scene_Base', ['create', 'start', 'update', 'stop', 'terminate']);
// The bridge installs Game_Actor#changeEquipBySlot (the VX Ace 0-based slot
// counterpart of MV's changeEquipById) at load time, so the class has to exist.
g.Game_Actor = stubClass('Game_Actor', ['equipSlots', 'changeEquipById', 'changeEquip']);
// The bridge aliases DataManager.makeSaveContents / extractSaveContents for the
// Custom Database registry, so the manager must exist before the plugin loads.
g.DataManager = {
    makeSaveContents: function() { return {}; },
    extractSaveContents: function() {}
};
// required by Object.defineProperty inside the plugin
g.Game_Character.prototype.constructor = g.Game_Character;
g.Game_Event.prototype = Object.create(g.Game_Character.prototype);
g.Game_Player.prototype = Object.create(g.Game_Character.prototype);
g.Game_Interpreter.prototype.constructor = g.Game_Interpreter;

// -------------------------------------------------------------- load plugin
const src = fs.readFileSync(PLUGIN, 'utf8');
try {
    // eslint-disable-next-line no-eval
    (0, eval)(src);
} catch (e) {
    console.error('PLUGIN LOAD FAILED: ' + e.message + '\n' + e.stack);
    process.exit(2);
}
const MR = g.MonlineRuby;
if (!MR) { console.error('MonlineRuby global missing'); process.exit(2); }
console.log('plugin loaded, translate() ready\n');

// ------------------------------------------------------------- collect data
function collect() {
    const move = new Map(), ev = new Map();
    const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json'));
    for (const f of files) {
        const base = f.slice(0, -5);
        if (base === 'System' || base === 'Tilesets') continue;
        let d;
        try { d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { continue; }
        const lists = [];
        if (d && Array.isArray(d.events)) {
            d.events.forEach(e => {
                if (!e || !Array.isArray(e.pages)) return;
                e.pages.forEach(pg => { if (pg && Array.isArray(pg.list)) lists.push(pg.list); });
            });
        } else if (Array.isArray(d)) {
            d.forEach(o => { if (o && Array.isArray(o.list)) lists.push(o.list); });
        }
        for (const list of lists) {
            for (let i = 0; i < list.length; i++) {
                const cmd = list[i];
                if (!cmd) continue;
                const p = cmd.parameters || [];
                if (cmd.code === 355 && typeof p[0] === 'string') {
                    // JOIN the 655 continuations exactly like command355 does.
                    let script = p[0] + '\n';
                    while (i + 1 < list.length && list[i + 1] && list[i + 1].code === 655) {
                        i++;
                        script += (list[i].parameters || [])[0] + '\n';
                    }
                    ev.set(script, (ev.get(script) || 0) + 1);
                } else if (cmd.code === 111 && p[0] === 12 && typeof p[1] === 'string') {
                    ev.set('[[COND]] ' + p[1], (ev.get('[[COND]] ' + p[1]) || 0) + 1);
                } else if (cmd.code === 122 && p[3] === 4 && typeof p[4] === 'string') {
                    ev.set('[[VAR]] ' + p[4], (ev.get('[[VAR]] ' + p[4]) || 0) + 1);
                } else if (cmd.code === 205 && p[1] && Array.isArray(p[1].list)) {
                    for (const s of p[1].list) {
                        if (s && s.code === 45) {
                            const v = (s.parameters || [])[0];
                            if (typeof v === 'string') move.set(v, (move.get(v) || 0) + 1);
                        }
                    }
                }
            }
        }
    }
    return { move, ev };
}

const { move, ev } = collect();
console.log('distinct snippets: moveroute-45=' + move.size + '  event-355=' + ev.size + '\n');

// ------------------------------------------------------------- compile pass
// Ruby tokens inside *string literals* are legitimate - translate() only
// rewrites code segments, so dialogue such as "@shop" or "does it include?"
// must survive verbatim.  Strip literals and comments before looking for
// leftovers, otherwise the report is pure noise.
function stripStrings(code) {
    let out = '', i = 0;
    const n = code.length;
    while (i < n) {
        const ch = code[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            const q = ch;
            i++;
            while (i < n) {
                if (code[i] === '\\') { i += 2; continue; }
                if (code[i] === q) { i++; break; }
                i++;
            }
            out += '""';
            continue;
        }
        if (ch === '/' && code[i + 1] === '/') {
            while (i < n && code[i] !== '\n') i++;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

const RESIDUAL = [
    [/\bnil\b/, 'nil'],
    [/=>/, 'hash-rocket'],
    [/#\{/, 'interpolation'],
    [/\bdo\s*\|/, 'block'],
    [/\bunless\b/, 'unless'],
    [/@[a-zA-Z_]\w*/, 'ivar'],
    [/\.include\?/, 'include?'],
    [/(^|[^\w.])(def|end)\s/, 'def/end'],
    [/[^:]\btrue\b\s*=>/, 'hash']
];

function check(map, label) {
    let ok = 0;
    const fails = [];
    const residual = new Map();
    for (const [snippet, count] of map) {
        const exprMode = snippet.startsWith('[[COND]] ') || snippet.startsWith('[[VAR]] ');
        const body = exprMode ? snippet.slice(9) : snippet;
        let code;
        try { code = MR.translate(body); } catch (e) {
            fails.push({ snippet, count, err: 'translate: ' + e.message }); continue;
        }
        for (const [rx, name] of RESIDUAL) {
            if (rx.test(stripStrings(code))) {
                residual.set(name, (residual.get(name) || 0) + 1);
            }
        }
        try {
            const wrap = exprMode ? 'return (' + code + ');' : code + '\n';
            // eslint-disable-next-line no-new-func
            new Function('__self', '__scope', 'with(__scope){\n' + wrap + '\n}');
            ok++;
        } catch (e) {
            // mirror evalExpr's repair fallback so the report reflects runtime
            try {
                const fixed = MR.repairBalance(code);
                const wrap2 = exprMode ? 'return (' + fixed + ');' : fixed + '\n';
                // eslint-disable-next-line no-new-func
                new Function('__self', '__scope', 'with(__scope){\n' + wrap2 + '\n}');
                ok++;
                residual.set('repaired', (residual.get('repaired') || 0) + 1);
            } catch (e2) {
                fails.push({ snippet, count, err: e.message, code });
            }
        }
    }
    console.log('=== ' + label + ' ===');
    console.log('  compile OK  : ' + ok + ' / ' + map.size);
    console.log('  compile FAIL: ' + fails.length);
    fails.sort((a, b) => b.count - a.count);
    fails.slice(0, 25).forEach(f => {
        console.log('    x' + String(f.count).padStart(4) + '  ' + f.err);
        console.log('           ruby: ' + f.snippet.replace(/\n/g, '\\n').slice(0, 120));
        console.log('           js  : ' + (f.code || '').replace(/\n/g, '\\n').slice(0, 120));
    });
    console.log('  residual ruby tokens: ' + (residual.size ? [...residual].map(([k, v]) => k + ':' + v).join(', ') : 'none'));
    console.log('');
    return fails.length;
}

const f1 = check(move, 'MOVEROUTE-45');
const f2 = check(ev, 'EVENT-355');
console.log('TOTAL COMPILE FAILURES: ' + (f1 + f2));
process.exit(f1 + f2 ? 1 : 0);
