//=============================================================================
// MonlineRubyBridge.js
// VX Ace -> MV port: the Ruby compatibility layer.
//=============================================================================
/*:
 * @plugindesc Ruby compatibility layer for the VX Ace port (stops all script crashes).
 * @author Monline port
 *
 * @help
 * ===========================================================================
 * WHY THIS PLUGIN EXISTS
 * ===========================================================================
 * The VX Ace project drove huge parts of its logic from two places that carry
 * *Ruby source code* into the data files:
 *
 *   1. Event command 355 / 655  -> Game_Interpreter.command355()
 *   2. Move-route command 45    -> Game_Character.processMoveCommand()
 *
 * RPG Maker MV 1.6.3 evaluates both with a bare `eval()`:
 *
 *   // rpg_objects.js:7092
 *   case gc.ROUTE_SCRIPT:
 *       eval(params[0]);          // <-- NO try/catch
 *       break;
 *
 * so any Ruby-only token (`self_switch("A", true)`, `$game_variables[123]`,
 * `@map_id`, `:Succ`, ...) throws a ReferenceError that unwinds all the way to
 * SceneManager.catchException -> SceneManager.stop().  The engine then sits
 * frozen on "Loading Error / Retry" - what the user experienced as
 * "点开就崩" (crash the moment you open it).
 *
 * This plugin fixes it on three levels:
 *
 *   A. SAFETY   - `processMoveCommand` (code 45) is wrapped in try/catch, so a
 *                 move-route script can never stop the game again.
 *   B. TRANSLATE- Ruby syntax is rewritten to JS: `@ivar` -> `__self.ivar`,
 *                 `:sym` -> `"sym"`, `nil` -> `null`, `.include?(` -> `.includes(`.
 *   C. SEMANTICS- A Ruby-style global bridge ($game_variables[123] reads/writes
 *                 real MV variables) plus real implementations of the ~20
 *                 custom VX Ace methods that carry actual game logic
 *                 (self switches, NPC movement, transfers). Purely cosmetic
 *                 systems (light, fog, camera, map effects) get safe no-ops
 *                 and are listed in MonlineRuby.pending for Phase 2.
 *
 * Diagnostic: `MonlineRuby.report()` returns every script that still failed,
 * with its source and error.  Used by the headless smoke test.
 * ===========================================================================
 */

var MonlineRuby;

(function() {
    'use strict';

    var MR = {
        version: '1.0.0',
        stats: { move: 0, event: 0, failedMove: 0, failedEvent: 0, translated: 0 },
        errors: [],
        pending: {},          // custom name -> call count (stubbed, not yet ported)
        current: null         // character currently running a move route
    };
    MonlineRuby = MR;
    window.MonlineRuby = MR;

    var MAX_ERRORS = 300;
    var errorGroups = {};        // message -> { n, samples: [{kind, src}] }

    function recordError(kind, src, e) {
        if (kind === 'move') { MR.stats.failedMove++; } else { MR.stats.failedEvent++; }
        var msg = (e && (e.name + ': ' + e.message)) || String(e);
        var slot = errorGroups[msg];
        if (!slot) {
            slot = errorGroups[msg] = { n: 0, samples: [] };
            MR.errors.push({ kind: kind, src: String(src).slice(0, 400), err: msg });
        }
        slot.n++;
        if (slot.samples.length < 3) {
            slot.samples.push({ kind: kind, src: String(src).slice(0, 300) });
        }
        if (MR.errors.length > MAX_ERRORS) { MR.errors.pop(); }
    }
    MR.recordError = recordError;

    //-------------------------------------------------------------------------
    // 1) Ruby core-library polyfills
    //-------------------------------------------------------------------------
    function defGetter(proto, name, fn) {
        try {
            Object.defineProperty(proto, name, {
                get: fn, set: function() {}, configurable: true
            });
        } catch (e) { /* already defined by the engine - keep the engine's */ }
    }
    function defAccessor(proto, name, get, set) {
        try {
            Object.defineProperty(proto, name, {
                get: get, set: set, configurable: true
            });
        } catch (e) { /* ignore */ }
    }

    if (!String.prototype.chars) {
        String.prototype.chars = function() { return this.split(''); };
    }
    if (!Array.prototype.first) { defGetter(Array.prototype, 'first', function() { return this[0]; }); }
    if (!Array.prototype.last) { defGetter(Array.prototype, 'last', function() { return this[this.length - 1]; }); }
    if (!Array.prototype.size) { defGetter(Array.prototype, 'size', function() { return this.length; }); }
    if (!String.prototype.size) { defGetter(String.prototype, 'size', function() { return this.length; }); }
    if (!Array.prototype.include) { Array.prototype.include = function(v) { return this.indexOf(v) >= 0; }; }
    if (!Array.prototype.compact) { Array.prototype.compact = function() { return this.filter(function(v) { return v != null; }); }; }
    if (!String.prototype.toInt) { String.prototype.toInt = function() { return parseInt(this, 10) || 0; }; }
    if (!String.prototype.toFloat) { String.prototype.toFloat = function() { return parseFloat(this) || 0; }; }
    if (!Number.prototype.toInt) { Number.prototype.toInt = function() { return parseInt(this, 10) || 0; }; }
    if (!Number.prototype.toFloat) { Number.prototype.toFloat = function() { return this.valueOf(); }; }
    if (!Number.prototype.clamp && typeof Number !== 'undefined') { /* MV already provides it */ }

    // Ruby Fiber.  MV's interpreter is update()-driven instead of coroutine
    // driven, so the `Fiber.yield while <cond>` idiom the scripts use for
    // "carry on next frame" has no direct counterpart; a no-op is the honest
    // degradation (the interpreter already advances one command per update).
    // Defining it matters for a second reason: without it the name resolves
    // through the scope proxy to an auto-stub *function*, whose `.yield`
    // property is undefined - so `Fiber.yield` would work by luck today and
    // throw the moment anything calls it.
    if (typeof window.Fiber === 'undefined') {
        window.Fiber = {
            yield: function() { return null; },
            new: function(block) {
                return {
                    resume: function() { if (typeof block === 'function') { block(); } return null; },
                    alive: function() { return false; },
                    isAlive: function() { return false; }
                };
            }
        };
    }

    // VX Ace: change_equip_by_id(slot_id, item_id) - 0-based slot, equips[0]
    // is the weapon.  MV: changeEquipById(etypeId, itemId) - 1-based equip
    // type.  The translate pass renames Ace's call to this method so the two
    // numbering schemes cannot be confused.
    if (!Game_Actor.prototype.changeEquipBySlot) {
        Game_Actor.prototype.changeEquipBySlot = function (slotId, itemId) {
            var slots = this.equipSlots();
            if (slotId < 0 || slotId >= slots.length) { return; }
            this.changeEquipById(slots[slotId], itemId || 0);
        };
    }

    //-------------------------------------------------------------------------
    // 2) Ruby -> JS source translation
    //-------------------------------------------------------------------------
    var SYMBOL_RX = /(^|[\(\[\{,=]\s*):([A-Za-z_]\w*[!?]?)/g;
    var HASH_KEY_RX = /(^|[\(\[\{,]\s*):([A-Za-z_]\w*[!?]?)\s*=>/g;
    var STR_HASH_KEY_RX = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*=>/g;
    var NIL_RX = /(^|[^\w.$@])nil(?![?\w])/g;
    var IVAR_RX = /@([a-zA-Z_]\w*)/g;
    var SELF_RX = /(^|[^\w.$@"':])self(?![?\w])/g;

    /**
     * Apply `fn` to every segment of `src` that is NOT inside a string
     * literal.  Dialogue / message strings must survive untouched, otherwise a
     * text line containing "@" or "nil" would be mangled.
     *
     * Ruby also allows string literals to span lines; JavaScript does not, so
     * embedded newlines are escaped while copying the literal.
     */
    function mapCode(src, fn) {
        var out = '', buf = '', i = 0, n = src.length;
        while (i < n) {
            var ch = src.charAt(i);
            if (ch === '"' || ch === "'") {
                if (buf) { out += fn(buf); buf = ''; }
                var quote = ch, lit = ch;
                i++;
                while (i < n) {
                    var c = src.charAt(i);
                    if (c === '\\') { lit += c + (src.charAt(i + 1) || ''); i += 2; continue; }
                    if (c === '\n') { lit += '\\n'; i++; continue; }   // multi-line Ruby string
                    if (c === '\r') { lit += '\\r'; i++; continue; }
                    lit += c; i++;
                    if (c === quote) { break; }
                }
                out += lit;
            } else {
                buf += ch; i++;
            }
        }
        if (buf) { out += fn(buf); }
        return out;
    }
    MR.mapCode = mapCode;

    /**
     * Given the index just past a receiver expression, walk backwards over a
     * balanced `[...]`/`(...)` chain and return where the receiver starts.
     * Used to rewrite Ruby suffixes like `.abs` and `.nil?` that need the whole
     * receiver wrapped:  (a - b).abs  ->  Math.abs(a - b)
     */
    function receiverStart(src, end) {
        var i = end - 1, depth = 0, sawAny = false;
        while (i >= 0) {
            var ch = src.charAt(i);
            if (ch === ')' || ch === ']') { depth++; i--; sawAny = true; continue; }
            if (ch === '(' || ch === '[') {
                if (depth === 0) { break; }
                depth--; i--; continue;
            }
            if (depth > 0) { i--; continue; }
            if (/[\w$@.]/.test(ch)) { i--; sawAny = true; continue; }
            break;
        }
        return sawAny ? i + 1 : -1;
    }

    /** Rewrite every `SUFFIX` occurrence via render(receiverSource). */
    function rewriteSuffix(src, suffix, render) {
        var out = '', i = 0;
        for (;;) {
            var at = src.indexOf(suffix, i);
            if (at < 0) { out += src.slice(i); break; }
            var after = src.charAt(at + suffix.length);
            // ".abs" must not match inside ".absolute"
            if (/[\w?]/.test(after)) {
                out += src.slice(i, at + suffix.length);
                i = at + suffix.length;
                continue;
            }
            var start = receiverStart(src, at);
            if (start < 0) {
                out += src.slice(i, at + suffix.length);
                i = at + suffix.length;
                continue;
            }
            out += src.slice(i, start) + render(src.slice(start, at));
            i = at + suffix.length;
        }
        return out;
    }

    function splitTopLevelComma(s) {
        var out = [], buf = '', depth = 0, quote = null;
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            if (quote) {
                buf += ch;
                if (ch === '\\') { buf += s.charAt(++i); continue; }
                if (ch === quote) { quote = null; }
                continue;
            }
            if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
            if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
            if (ch === ')' || ch === ']' || ch === '}') { depth--; buf += ch; continue; }
            if (ch === ',' && depth === 0) { out.push(buf); buf = ''; continue; }
            buf += ch;
        }
        out.push(buf);
        return out;
    }

    /**
     * Index of the last top-level occurrence of `word` used as a Ruby modifier
     * keyword (`stmt if cond`), i.e. surrounded by whitespace, outside string
     * literals and outside brackets.  -1 when there is none.
     */
    function topLevelWordIndex(s, word) {
        var depth = 0, quote = null, found = -1, i = 0, n = s.length;
        var wl = word.length;
        while (i < n) {
            var ch = s.charAt(i);
            if (quote) {
                if (ch === '\\') { i += 2; continue; }
                if (ch === quote) { quote = null; }
                i++;
                continue;
            }
            if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
            if (ch === '(' || ch === '[' || ch === '{') { depth++; i++; continue; }
            if (ch === ')' || ch === ']' || ch === '}') { depth--; i++; continue; }
            if (depth === 0 && s.substr(i, wl) === word
                    && i > 0 && /\s/.test(s.charAt(i - 1))
                    && i + wl < n && /\s/.test(s.charAt(i + wl))) {
                found = i;
                i += wl;
                continue;
            }
            i++;
        }
        return found;
    }

    // Lines that are already control flow / block syntax must never be read as
    // a statement with a trailing modifier.
    var MODIFIER_SKIP_RX = /^[ \t]*(\}|\)|else\b|elsif\b|if\b|unless\b|while\b|until\b|case\b|when\b|end\b|switch\b|default\s*:|break\b|return\b|next\b)/;

    /** `stmt if cond` -> `if (cond) { stmt }`;  `stmt unless cond` -> negated */
    function modifierIf(line) {
        if (MODIFIER_SKIP_RX.test(line)) { return line; }
        var at = topLevelWordIndex(line, 'if');
        var negate = false;
        var atU = topLevelWordIndex(line, 'unless');
        if (atU > at) { at = atU; negate = true; }
        if (at < 0) { return line; }
        var indent = (line.match(/^[ \t]*/) || [''])[0];
        var stmt = line.slice(0, at).trim();
        var cond = line.slice(at + (negate ? 6 : 2)).trim();
        if (!stmt || !cond) { return line; }
        // A ternary in the statement means we mis-parsed; leave it alone.
        if (/\?/.test(stmt)) { return line; }
        return indent + 'if (' + (negate ? '!(' + cond + ')' : cond) + ') { ' + stmt + ' }';
    }

    // A whole line that consists of nothing but a dotted access is a *method
    // call* in Ruby - there are no property reads.  VX Ace writes the
    // parameterless ones without parentheses:
    //
    //     light.clear                                       70
    //     map_effects.clear                                110
    //     SceneManager.scene.log_window.wait_and_clear      88
    //     Fiber.yield                                       11
    //
    // Translated literally these become pure property reads, so JavaScript
    // evaluates them and throws the result away: the command silently does
    // nothing (a light that should have been switched off stays lit).  The
    // rule is safe because a bare dotted chain is never a valid statement in
    // JavaScript either, and a statement containing a string, an operator or a
    // call never matches.
    var BARE_CALL_RX = /^([ \t]*)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)[ \t]*$/;

    function bareCall(line) {
        var m = BARE_CALL_RX.exec(line);
        return m ? m[1] + m[2] + '()' : line;
    }
    MR.bareCall = bareCall;

    /**
     * Ruby `case EXPR / when a, b / ... / end` -> JavaScript `switch`.
     * Only engaged when the snippet really contains a case/when block, so the
     * line-oriented rewrite can never touch ordinary code.
     */
    function rewriteCase(src) {
        if (!/(^|\n)[ \t]*case[ \t]/.test(src)) { return src; }
        if (!/(^|\n)[ \t]*when[ \t]/.test(src)) { return src; }
        var lines = src.split('\n'), out = [], inCase = false, pending = false, m;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if ((m = line.match(/^([ \t]*)case[ \t]+(.+?)[ \t]*$/))) {
                out.push(m[1] + 'switch (' + m[2] + ') {');
                inCase = true; pending = false; continue;
            }
            if (inCase && (m = line.match(/^([ \t]*)when[ \t]+(.+?)[ \t]*$/))) {
                if (pending) { out.push('break;'); }
                out.push(m[1] + splitTopLevelComma(m[2]).map(function(v) {
                    return 'case ' + v.trim() + ':';
                }).join(' '));
                pending = false; continue;
            }
            if (inCase && /^[ \t]*else[ \t]*$/.test(line)) {
                if (pending) { out.push('break;'); }
                out.push('default:'); pending = false; continue;
            }
            if (inCase && /^[ \t]*end[ \t]*$/.test(line)) {
                if (pending) { out.push('break;'); }
                out.push('}'); inCase = false; pending = false; continue;
            }
            if (inCase && line.trim()) {
                out.push(modifierIf(line)); pending = true; continue;
            }
            out.push(line);
        }
        return out.join('\n');
    }
    MR.rewriteCase = rewriteCase;

    /**
     * The converted data contains a handful of unbalanced parenthesis typos
     * (e.g. `(a - b).abs) <= 2`).  Those branches never worked in the original
     * engine either, but we would rather evaluate them than skip the event:
     * drop any closer that has nothing to close and append anything left open.
     */
    function repairBalance(code) {
        var stack = [], out = '', quote = null;
        for (var i = 0; i < code.length; i++) {
            var ch = code.charAt(i);
            if (quote) {
                if (ch === '\\') { out += ch + code.charAt(++i); continue; }
                out += ch;
                if (ch === quote) { quote = null; }
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') { quote = ch; out += ch; continue; }
            if (ch === '(' || ch === '[' || ch === '{') { stack.push(ch); out += ch; continue; }
            if (ch === ')' || ch === ']' || ch === '}') {
                if (stack.length === 0) { continue; }
                stack.pop(); out += ch; continue;
            }
            out += ch;
        }
        var pairs = { '(': ')', '[': ']', '{': '}' };
        for (var j = stack.length - 1; j >= 0; j--) { out += pairs[stack[j]]; }
        return out;
    }
    MR.repairBalance = repairBalance;

    /**
     * Ruby passes an implicit trailing Hash when a call ends with `:k => v`
     * pairs.  After the symbol rewrite those pairs look like `"k": v`, so we
     * wrap any argument list that contains such a pair in `{ ... }`.
     */
    function wrapHashArgs(src) {
        var out = '', stack = [], inStr = null, i = 0, n = src.length;
        while (i < n) {
            var ch = src.charAt(i);
            if (inStr) {
                if (ch === '\\') { out += src.substr(i, 2); i += 2; continue; }
                out += ch; i++;
                if (ch === inStr) { inStr = null; }
                continue;
            }
            if (ch === '"' || ch === "'") { inStr = ch; out += ch; i++; continue; }
            if (ch === '(' || ch === '[') {
                stack.push({ ch: ch, idx: out.length });
                out += ch; i++; continue;
            }
            if (ch === ')' || ch === ']') {
                var open = stack.pop();
                out += ch; i++;
                if (open && open.ch === '(') {
                    var inner = out.slice(open.idx + 1, out.length - 1);
                    // never re-wrap something that is already an object literal
                    if (inner.trim().charAt(0) !== '{'
                        && /"[A-Za-z_]\w*"\s*:/.test(inner)) {
                        out = out.slice(0, open.idx + 1) + '{' + inner + '}'
                            + out.slice(out.length - 1);
                    }
                }
                continue;
            }
            out += ch; i++;
        }
        return out;
    }
    MR.wrapHashArgs = wrapHashArgs;

    MR.translate = function(src, options) {
        var s = String(src);
        // Expression contexts (a conditional-branch or Control-Variable script
        // operand, i.e. command 111 type 12 / 122 type 4) are values, not
        // statements: `$game_party.battle_members.size` there is a *read* of
        // the array length and must not grow a call.
        var isExpression = !!(options && options.expression);

        // Ruby line continuation: a backslash immediately before a newline.
        s = s.replace(/(^|[^\\])\\[ \t]*\r?\n/g, '$1 ');

        // keyword hash pairs first, so the generic symbol rule cannot touch
        // the `:key` half of `:key => value`
        s = mapCode(s, function(c) {
            return c.replace(HASH_KEY_RX, function(m, lead, name) { return lead + '"' + name + '":'; })
                    .replace(STR_HASH_KEY_RX, '$1:');
        });

        s = mapCode(s, function(c) {
            var t = c;
            // ---- Ruby -> MV object-model fixes -------------------------
            // $game_map.events[id] is a Hash lookup in Ruby; MV wants event(id)
            t = t.replace(/\$game_map\.events\[([^\]]*)\]/g, '$gameMap.event($1)');
            t = t.replace(/\$game_map\.events(?!\s*[\[(])/g, '$gameMap.events()');
            // VX Ace's SceneManager.call(C) switches scene; MV spells it goto().
            // This is NOT cosmetic: `SceneManager` is a *function object* in MV
            // (function SceneManager() { throw ... }), so the untranslated
            // `SceneManager.call(C)` silently resolves to Function.prototype.call
            // and re-invokes the static-class guard, throwing
            // "This is a static class" instead of opening anything.
            t = t.replace(/\bSceneManager\.call\s*\(/g, 'SceneManager.goto(');
            // Ruby snake_case attributes that are methods in MV
            var ATTRS = {
                region_id: 'regionId',
                in_battle: 'inBattle',
                battle_members: 'battleMembers',
                equips: 'equips',
                direction: 'direction',
                character_name: 'characterName',
                character_index: 'characterIndex'
            };
            Object.keys(ATTRS).forEach(function(k) {
                // Do NOT rewrite an assignment target.  MV's counterparts are
                // methods, so `$game_player.move_speed = 4` would become
                // `moveSpeed() = 4` - which parses in sloppy mode but throws
                // "Invalid left-hand side in assignment" at run time and kills
                // the whole script.  move_speed is deliberately absent from
                // ATTRS; it has a real prototype accessor instead.
                var re = new RegExp('\\.' + k + '(?![\\w(])(?![ \\t]*[+\\-*/%&|^]?=(?!=))', 'g');
                t = t.replace(re, '.' + ATTRS[k] + '()');
            });
            // ---- VX Ace plain fields whose MV spelling is camelCase -------
            // These are ordinary properties on both sides (`RPG::Weapon#icon_index`
            // vs `RPG.UsableItem#iconIndex`), so renaming fixes reads *and*
            // writes.  Left alone, `a.icon_index = 11897` silently creates a
            // dead property and the icon never changes - the game rewrites 97
            // database icons this way.
            var FIELDS = {
                icon_index: 'iconIndex',
                animation_id: 'animationId',
                tp_gain: 'tpGain',
                data_id: 'dataId',
                currency_unit: 'currencyUnit'
            };
            Object.keys(FIELDS).forEach(function(k) {
                t = t.replace(new RegExp('\\.' + k + '\\b', 'g'), '.' + FIELDS[k]);
            });
            // ---- Audio: VX Ace Audio.bgm_play() -> MV Audio.bgmPlay() -------
            var AUDIO = {
                bgm_play: 'bgmPlay', bgm_stop: 'bgmStop', bgm_fade: 'bgmFadeOut',
                bgs_play: 'bgsPlay', bgs_stop: 'bgsStop', bgs_fade: 'bgsFadeOut',
                me_play: 'mePlay', me_stop: 'meStop', me_fade: 'meFadeOut',
                se_play: 'sePlay', se_stop: 'stopSE'
            };
            Object.keys(AUDIO).forEach(function(k) {
                // either a call, or a bare method reference (`Audio.me_stop`)
                t = t.replace(new RegExp('\\bAudio\\.' + k + '\\b(?=\\s*\\()', 'g'),
                    'Audio.' + AUDIO[k]);
                t = t.replace(new RegExp('\\bAudio\\.' + k + '\\b(?!\\s*\\()', 'g'),
                    'Audio.' + AUDIO[k] + '()');
            });
            // ---- VX Ace equips: slot index vs MV equip type id -------------
            // VX Ace's `change_equip_by_id(slot_id, item_id)` takes a 0-based
            // SLOT index (equips[0] is the weapon).  MV's
            // `changeEquipById(etypeId, itemId)` takes a 1-based EQUIP TYPE,
            // so the same number means different things - slot 1 is the shield
            // in Ace but the weapon in MV.  Rename to a method that takes the
            // Ace slot, so the 15 call sites in the event data behave.
            t = t.replace(/\.change_equip_by_id\s*\(/g, '.changeEquipBySlot(');
            // ---- `X.instance_eval("ruby")` -> evaluate with X as `self` -----
            // VX Ace uses this to poke at a character from another event:
            //     $game_map.events[3].instance_eval("@move_speed += 0.5")
            // The receiver would otherwise be lost, so it is passed explicitly.
            t = t.replace(
                /([\w$]+(?:\.[\w$]+)*(?:\([^()]*\))?(?:\[[^\]]*\])*)\.instance_eval\s*\(/g,
                '__instanceEval($1, ');
            // Ruby predicate methods with a receiver:  x.nil?  ->  isNil(x)
            t = rewriteSuffix(t, '.nil?', function(r) { return 'isNil(' + r + ')'; });
            t = rewriteSuffix(t, '.abs', function(r) { return 'Math.abs(' + r + ')'; });
            // ---- generic Ruby syntax -----------------------------------
            // word operators
            t = t.replace(/(^|[^\w.])and(?![\w])/g, '$1&&');
            t = t.replace(/(^|[^\w.])or(?![\w])/g, '$1||');
            t = t.replace(/(^|[^\w.])not(?![\w])/g, '$1!');
            // Ruby module namespace:  Tidloc::Set_Coord(..) -> Tidloc.Set_Coord(..)
            //                          RPG::BaseItem::Feature -> RPG.BaseItem.Feature
            // One pass only rewrites the *first* `::` of a nested constant
            // (the /g scan resumes after the match), so repeat until stable.
            for (var ns = 0; ns < 6 && t.indexOf('::') >= 0; ns++) {
                t = t.replace(/([A-Za-z_][\w.]*)::([A-Za-z_]\w*)/g, '$1.$2');
            }
            // Ruby core method sugar (before the generic `name?(` rule)
            t = t.replace(/\.include\?\(/g, '.includes(');
            t = t.replace(/\.is_a\?\(/g, '.isA(');
            t = t.replace(/\.kind_of\?\(/g, '.isA(');
            t = t.replace(/\.to_s\b/g, '.toString');
            t = t.replace(/\.to_i\b/g, '.toInt');
            t = t.replace(/\.to_f\b/g, '.toFloat');
            // any remaining predicate call:  isSelfSwitch?(..) -> isSelfSwitch(..)
            // (a space is required before `?` in a ternary, so this is safe)
            t = t.replace(/([A-Za-z_]\w*)\?(?=\s*\()/g, '$1');
            // remaining symbols used as values:  foo(:Succ)  ->  foo("Succ")
            t = t.replace(SYMBOL_RX, function(m, lead, name) {
                return lead + '"' + name.replace(/[!?]$/, '') + '"';
            });
            // instance variables / self -> properties of the running object
            t = t.replace(IVAR_RX, '__self.$1');
            t = t.replace(SELF_RX, '$1__self');
            // nil
            t = t.replace(NIL_RX, '$1null');
            // bare parameterless method call as a whole statement (see bareCall)
            if (!isExpression) {
                t = t.split('\n').map(bareCall).join('\n');
            }
            return t;
        });

        // Ruby case/when blocks -> JavaScript switch
        s = rewriteCase(s);

        // Ruby modifier-if / modifier-unless work in *any* statement position.
        // rewriteCase happens to run them for lines inside a case block, which
        // is why the 130 `$game_actors[1].name = "Abigal" if $game_actors[1]`
        // lines compiled - but a trailing `if` anywhere else used to be a
        // SyntaxError, and one SyntaxError silently kills the entire 355 block.
        // The rewrite is string-aware, so dialogue such as
        // `text = "come back if you can"` is left untouched.
        s = s.split('\n').map(modifierIf).join('\n');

        // wrap implicit trailing hashes into object literals
        s = wrapHashArgs(s);

        // Ruby string interpolation  "#{expr}"  ->  JS string concatenation.
        // This is the only pass that intentionally rewrites inside strings.
        if (s.indexOf('#{') >= 0) {
            s = s.replace(/"((?:[^"\\]|\\.)*)"/g, function(m, body) {
                if (body.indexOf('#{') < 0) { return m; }
                var parts = body.split(/#\{([^}]*)\}/g);
                var out = '';
                for (var i = 0; i < parts.length; i++) {
                    if (i % 2 === 1) { out += '" + (' + parts[i] + ') + "'; }
                    else { out += parts[i].replace(/"/g, '\\"'); }
                }
                return '"' + out + '"';
            });
        }
        MR.stats.translated++;
        return s;
    };

    //-------------------------------------------------------------------------
    // 3) Auto-vivifying stand-in for unknown Ruby globals ($Rope, $Dominic...)
    //-------------------------------------------------------------------------
    var TO_PRIM = (typeof Symbol !== 'undefined' && Symbol.toPrimitive) || '@@toPrimitive';

    function omnipotent(label) {
        if (!window.Proxy) {
            var plain = function() {};
            plain.__rubyStub = label;
            return plain;
        }
        var target = function() { return omnipotent(label + '()'); };
        var handler = {
            get: function(t, k) {
                if (k === TO_PRIM) { return function(hint) { return hint === 'number' ? 0 : ''; }; }
                if (k === 'toString' || k === 'valueOf') { return function() { return ''; }; }
                if (k === Symbol.iterator) { return function() { return { next: function() { return { done: true }; } }; }; }
                if (k === 'inspect' || k === '__rubyStub') { return label; }
                if (typeof k === 'symbol') { return undefined; }
                if (!(k in t)) { t[k] = omnipotent(label + '.' + k); }
                return t[k];
            },
            set: function(t, k, v) { t[k] = v; return true; },
            has: function() { return true; },
            apply: function() { return omnipotent(label + '()'); },
            construct: function() { return omnipotent('new ' + label); }
        };
        return new Proxy(target, handler);
    }
    MR.omnipotent = omnipotent;

    //-------------------------------------------------------------------------
    // 4) Ruby global variable bridge
    //-------------------------------------------------------------------------
    function numericProxy(getArray, label) {
        // $game_variables[123] / $game_variables[123] = x
        if (!window.Proxy) { return getArray(); }
        return new Proxy({}, {
            get: function(t, k) {
                if (typeof k === 'symbol') { return undefined; }
                var arr = getArray();
                var n = parseInt(k, 10);
                if (isNaN(n)) { return arr[k]; }
                var v = arr[n];
                return v == null ? 0 : v;
            },
            set: function(t, k, v) {
                var arr = getArray();
                var n = parseInt(k, 10);
                if (!isNaN(n)) { arr[n] = v; } else { arr[k] = v; }
                return true;
            },
            has: function() { return true; }
        });
    }

    function actorProxy() {
        if (!window.Proxy) { return $gameActors; }
        return new Proxy({}, {
            get: function(t, k) {
                if (typeof k === 'symbol') { return undefined; }
                var n = parseInt(k, 10);
                if (!isNaN(n)) { return $gameActors.actor(n); }
                var v = $gameActors[k];
                return typeof v === 'function' ? v.bind($gameActors) : v;
            },
            set: function() { return true; },
            has: function() { return true; }
        });
    }

    function selfSwitchProxy() {
        // $game_self_switches[[mapId, eventId, 'A']]
        if (!window.Proxy) { return {}; }
        return new Proxy({}, {
            get: function(t, k) {
                if (typeof k === 'symbol') { return undefined; }
                var parts = String(k).split(',');
                if (parts.length === 3) {
                    return $gameSelfSwitches.value([parseInt(parts[0], 10), parseInt(parts[1], 10), parts[2]]) === true;
                }
                return undefined;
            },
            set: function(t, k, v) {
                var parts = String(k).split(',');
                if (parts.length === 3) {
                    $gameSelfSwitches.setValue([parseInt(parts[0], 10), parseInt(parts[1], 10), parts[2]], v);
                }
                return true;
            },
            has: function() { return true; }
        });
    }

    // lazy bridge table:  rubyGlobalName -> function returning the MV object
    var GLOBAL_BRIDGE = {
        game_variables: function() { return numericProxy(function() { return $gameVariables._data; }, 'vars'); },
        game_switches: function() { return numericProxy(function() { return $gameSwitches._data; }, 'switches'); },
        game_self_switches: function() { return selfSwitchProxy(); },
        game_actors: function() { return actorProxy(); },
        game_player: function() { return $gamePlayer; },
        game_party: function() { return $gameParty; },
        game_map: function() { return $gameMap; },
        game_screen: function() { return $gameScreen; },
        game_system: function() { return $gameSystem; },
        game_message: function() { return $gameMessage; },
        game_troop: function() { return $gameTroop; },
        game_temp: function() { return $gameTemp; },
        game_interpreter: function() { return MR.current; },
        data_items: function() { return $dataItems; },
        data_weapons: function() { return $dataWeapons; },
        data_armors: function() { return $dataArmors; },
        data_skills: function() { return $dataSkills; },
        data_classes: function() { return $dataClasses; },
        data_actors: function() { return $dataActors; },
        data_enemies: function() { return $dataEnemies; },
        data_troops: function() { return $dataTroops; },
        data_states: function() { return $dataStates; },
        data_tilesets: function() { return $dataTilesets; },
        data_system: function() { return $dataSystem; },
        data_mapinfos: function() { return $dataMapInfos; },
        data_common_events: function() { return $dataCommonEvents; }
    };
    MR.GLOBAL_BRIDGE = GLOBAL_BRIDGE;

    //-------------------------------------------------------------------------
    // 5) Custom VX Ace method implementations
    //-------------------------------------------------------------------------
    var F = {};   // the scope registry

    function ctxChar() { return MR.current; }

    function evIdOf(c) {
        if (!c) { return 0; }
        if (typeof c.eventId === 'function') { return c.eventId(); }
        return c._eventId || 0;
    }

    // ---- 5a. self switches (the single most used custom API: 1900+ calls) ----
    F.self_switch = function(letter, value) {
        var c = ctxChar();
        var id = evIdOf(c);
        if (!id) { return false; }
        $gameSelfSwitches.setValue([$gameMap.mapId(), id, String(letter)], value === undefined ? true : !!value);
        return true;
    };
    F.setSelfSwitch = function(mapId, eventId, letter, value) {
        mapId = parseInt(mapId, 10);
        eventId = parseInt(eventId, 10);
        if (isNaN(mapId)) { mapId = $gameMap.mapId(); }
        if (isNaN(eventId)) { return false; }
        if (typeof value === 'undefined') { value = (String(letter) === 'true'); }
        $gameSelfSwitches.setValue([mapId, eventId, String(letter)], !!value);
        return true;
    };
    F.setAllSelf = function(letter, value) {
        var mapId = $gameMap.mapId();
        var events = $gameMap.events() || [];
        for (var i = 0; i < events.length; i++) {
            var id = evIdOf(events[i]);
            if (id) { $gameSelfSwitches.setValue([mapId, id, String(letter)], !!value); }
        }
        return true;
    };
    F.get_self_switch = function(mapId, eventId, letter) {
        return $gameSelfSwitches.value([mapId, eventId, String(letter)]) === true;
    };
    // Ruby `x.nil?`
    F.isNil = function(v) { return v === null || v === undefined; };

    // ---- 5b. move-route motion / appearance ----
    function targetEvent(id) {
        id = parseInt(id, 10);
        if (id === -1 || id === 0) { return $gamePlayer; }
        return $gameMap.event(id);
    }

    F.set_char = function(name /*, a, b, c */) {
        var c = ctxChar();
        if (!c || typeof c.setImage !== 'function') { return false; }
        if (c._origImage === undefined) {
            c._origImage = c._characterName;
            c._origIndex = c._characterIndex;
        }
        // Signature seen in the data: set_char(name, index, pattern, direction)
        // Only the sheet name/index are reliable, so apply those and use any
        // argument that looks like a facing (2/4/6/8) as the direction.
        var args = Array.prototype.slice.call(arguments, 1);
        var index = 0, dir = 0;
        for (var i = 0; i < args.length; i++) {
            var v = parseInt(args[i], 10);
            if (isNaN(v)) { continue; }
            if (dir === 0 && (v === 2 || v === 4 || v === 6 || v === 8)) { dir = v; }
            else if (i === 0 || (index === 0 && v >= 0 && v <= 7)) { index = v; }
        }
        c.setImage(String(name), index);
        if (dir) { c.setDirection(dir); }
        return true;
    };
    F.restore_char = function() {
        var c = ctxChar();
        if (!c || c._origImage === undefined) { return false; }
        c.setImage(c._origImage, c._origIndex);
        c._origImage = undefined;
        return true;
    };
    F.char_level = function() { return true; };            // cosmetic zoom, Phase 2
    F.jump_to = function(x, y) {
        var c = ctxChar();
        if (!c) { return false; }
        c.locate(parseInt(x, 10), parseInt(y, 10));
        if (typeof c.setRMoveSpeed === 'function') { /* no-op */ }
        return true;
    };
    F.jump_to_char = function(id) {
        var c = ctxChar(), t = targetEvent(id);
        if (!c || !t) { return false; }
        c.locate(t.x, t.y);
        return true;
    };
    F.jump_forward = function(n) {
        var c = ctxChar();
        if (!c) { return false; }
        n = parseInt(n, 10) || 1;
        var dx = (c.direction === 6 ? n : c.direction === 4 ? -n : 0);
        var dy = (c.direction === 2 ? n : c.direction === 8 ? -n : 0);
        if (c.jump) { c.jump(dx, dy); }
        return true;
    };
    F.move_toward_xy = function(x, y) {
        var c = ctxChar();
        if (!c) { return false; }
        c.moveTowardCharacter({ x: parseInt(x, 10), y: parseInt(y, 10) });
        return true;
    };
    F.move_toward_event = function(id) {
        var c = ctxChar(), t = targetEvent(id);
        if (!c || !t) { return false; }
        c.moveTowardCharacter(t);
        return true;
    };
    F.move_away_from_event = function(id) {
        var c = ctxChar(), t = targetEvent(id);
        if (!c || !t) { return false; }
        c.moveAwayFromCharacter(t);
        return true;
    };
    F.turn_toward_event = function(id) {
        var c = ctxChar(), t = targetEvent(id);
        if (!c || !t) { return false; }
        c.turnTowardCharacter(t);
        return true;
    };
    // find_path + chase_leader: MV has no built-in A*; move one step toward the
    // goal each frame, which reproduces the visible behaviour (NPC approaches).
    F.find_path = function(x, y /*, n */) {
        var c = ctxChar();
        if (!c) { return false; }
        c._pathTarget = { x: parseInt(x, 10), y: parseInt(y, 10) };
        c._chaseLeader = false;
        return true;
    };
    F.chase_leader = function(on) {
        var c = ctxChar();
        if (!c) { return false; }
        c._chaseLeader = (on === undefined ? true : !!on);
        c._pathTarget = null;
        return true;
    };
    F.wait = function(a, b) {
        var c = ctxChar();
        if (!c) { return false; }
        var n = Math.max(parseInt(a, 10) || 0, parseInt(b, 10) || 0);
        c._waitCount = n;
        return true;
    };
    F.anim = function(id) {
        var c = ctxChar();
        if (c && c.requestAnimation) { c.requestAnimation(parseInt(id, 10)); }
        return true;
    };
    F.balloon = function(id) {
        var c = ctxChar();
        if (c && c.requestBalloon) { c.requestBalloon(parseInt(id, 10)); }
        return true;
    };
    F.repeat = function() { return true; };        // move-list loop, Phase 2
    F.end_repeat = function() { return true; };
    F.setSelfSwitchChar = F.self_switch;

    // Drive find_path / chase_leader from the update loop.
    //
    // IMPORTANT: never intercept while a move route is forcing, otherwise
    // advanceMoveRouteIndex() would never run and the route would soft-lock.
    var _updateStop = Game_Character.prototype.updateStop;
    Game_Character.prototype.updateStop = function() {
        if (!this._moveRouteForcing && (this._chaseLeader || this._pathTarget)) {
            var t = this._pathTarget || { x: $gamePlayer.x, y: $gamePlayer.y };
            if (this.x !== t.x || this.y !== t.y) {
                this.moveTowardCharacter(t);
                return;
            }
            // arrived
            this._pathTarget = null;
            this._chaseLeader = false;
        }
        return _updateStop.call(this);
    };

    // ---- 5c. event-side game logic ----
    F.fadeout = function(d) { $gameScreen.startFadeOut((parseInt(d, 10) || 8) * 2); return true; };
    F.fadein = function(d) { $gameScreen.startFadeIn((parseInt(d, 10) || 8) * 2); return true; };
    // Ruby `isSelfSwitch?(mapId, eventId, letter)` used by 111 script conditions
    F.isSelfSwitch = function(mapId, eventId, letter) {
        mapId = parseInt(mapId, 10);
        eventId = parseInt(eventId, 10);
        if (isNaN(mapId)) { mapId = $gameMap.mapId(); }
        return $gameSelfSwitches.value([mapId, eventId, String(letter)]) === true;
    };

    F.get_hp_percent = function(actorId) {
        var a = $gameActors.actor(parseInt(actorId, 10) || 1);
        if (!a || !a.mhp) { return 0; }
        return Math.round(100 * a.hp / a.mhp);
    };
    F.gain_armor = function(id) {
        var it = $dataArmors[parseInt(id, 10)];
        if (it) { $gameParty.gainItem(it, 1); }
        return true;
    };
    F.gain_good = F.gain_armor;
    F.equip_armor_by_etype = function(actorId, etypeId, armorId) {
        var a = $gameActors.actor(parseInt(actorId, 10) || 1);
        if (!a) { return false; }
        var slot = a.equipSlots().indexOf(parseInt(etypeId, 10));
        var it = $dataArmors[parseInt(armorId, 10)];
        if (slot >= 0 && it) { a.changeEquip(slot, it); }
        return true;
    };
    F.remove_equip = function(actorId, etypeId) {
        var a = $gameActors.actor(parseInt(actorId, 10) || 1);
        if (!a) { return false; }
        var slot = a.equipSlots().indexOf(parseInt(etypeId, 10));
        if (slot >= 0) { a.changeEquip(slot, null); }
        return true;
    };
    // 0195.rb TH_UtilsChangeEquips.  The weapon counterpart of
    // equip_armor_by_etype - Monline uses it once, on map 122.
    F.equip_weapon_by_etype = function(actorId, etypeId, weaponId) {
        var a = $gameActors.actor(parseInt(actorId, 10) || 1);
        if (!a) { return false; }
        var slot = a.equipSlots().indexOf(parseInt(etypeId, 10));
        var it = $dataWeapons[parseInt(weaponId, 10)];
        if (slot >= 0 && it) { a.changeEquip(slot, it); }
        return true;
    };
    F.equip_weapon_by_wtype = function() { return true; };

    // `X.instance_eval("@move_speed += 0.5")`: run the snippet with X bound as
    // `self`.  The translator rewrites the receiver into the first argument
    // (see MR.translate), because a free function call would lose it.
    F.__instanceEval = function(obj, src) {
        if (!obj || typeof src !== 'string') { return obj; }
        var prev = MR.current;
        MR.current = obj;
        try {
            MR.evalScript(src, obj, 'event');
        } catch (e) {
            recordError('event', src, e);
        }
        MR.current = prev;
        return obj;
    };
    // Ruby also calls the block-less form `instance_eval` on self/strings.
    F.instance_eval = function(src) { return F.__instanceEval(ctxChar(), src); };

    // ---- 5d. Ruby-side utilities the scripts expect ----
    F.puts = function() { return true; };
    F.print = function() { return true; };
    F.p = function() { return true; };
    F.rand = function(n) { return n ? Math.randomInt(parseInt(n, 10)) : Math.random(); };
    F.srand = function() { return true; };

    //-------------------------------------------------------------------------
    // 5e. Custom Database (Hime's "Custom Database", VX Ace script 0176)
    //-------------------------------------------------------------------------
    // The game rewrites database rows while it runs and then asks Hime's
    // module to persist them:
    //
    //     a = $data_armors[159]
    //     a.name        = "Rags"
    //     a.description = "This gettup makes you look poor as shit, ..."
    //     CustomData.update_armor(a)
    //
    // 280 calls across 78 map files + the common events depend on this, so
    // `CustomData` must exist or every one of them throws
    // "CustomData.update_armor is not a function" and the event dies.
    //
    // The module does two things worth reproducing:
    //   1. the mutation itself (free: MV hands out the *same* database object,
    //      so assigning `a.name` already affects the live row), and
    //   2. a parallel registry ($custom_armors ...) that DataManager merges
    //      back over the database when a save is loaded, because both engines
    //      reload the database from Data/ on every boot and would otherwise
    //      lose the edits.
    var CUSTOM_KINDS = {
        actor: 'actors', class: 'classes', skill: 'skills', item: 'items',
        weapon: 'weapons', armor: 'armors', enemy: 'enemies',
        state: 'states', troop: 'troops', mapinfo: 'mapinfos'
    };
    var customSets = {};

    function customSet(rubyName) {
        if (!customSets[rubyName]) { customSets[rubyName] = {}; }
        return customSets[rubyName];
    }
    /** The live MV database array/object for a plural ruby name. */
    function customDataset(rubyName) {
        var resolver = GLOBAL_BRIDGE['data_' + rubyName];
        var ds = resolver ? resolver() : null;
        if (ds == null && typeof window['$data' + rubyName.charAt(0).toUpperCase()
                + rubyName.slice(1)] !== 'undefined') {
            ds = window['$data' + rubyName.charAt(0).toUpperCase() + rubyName.slice(1)];
        }
        return ds || null;
    }

    var CustomData = {
        // Ruby: hash.length / array.size -- both are 1-based with [0] = nil in
        // VX Ace, and MV keeps the same shape, so `length` matches exactly.
        add_object: function(customset, dataset, obj) {
            if (!obj) { return 0; }
            var id = dataset ? dataset.length : 1;
            obj.id = id;
            if (customset) { customset[id] = obj; }
            if (dataset) { dataset.push(obj); }        // Ruby `dataset << obj`
            return id;
        },
        update_object: function(customset, dataset, obj) {
            if (!obj) { return false; }
            var id = obj.id;
            if (customset) { customset[id] = obj; }
            if (dataset) { dataset[id] = obj; }
            return true;
        }
    };

    Object.keys(CUSTOM_KINDS).forEach(function(kind) {
        var rubyName = CUSTOM_KINDS[kind];
        CustomData['add_' + kind] = function(obj) {
            return CustomData.add_object(customSet(rubyName),
                customDataset(rubyName), obj);
        };
        CustomData['update_' + kind] = function(obj) {
            return CustomData.update_object(customSet(rubyName),
                customDataset(rubyName), obj);
        };
    });

    /** Re-apply every registered edit over the freshly loaded database. */
    function mergeCustomIntoDatabase() {
        Object.keys(customSets).forEach(function(rubyName) {
            var ds = customDataset(rubyName);
            var set = customSets[rubyName];
            if (!ds || !set) { return; }
            Object.keys(set).forEach(function(id) { ds[id] = set[id]; });
        });
    }

    // VX Ace: DataManager.make_save_contents / extract_save_contents.
    var _makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        var contents = _makeSaveContents.call(this);
        var snapshot = {};
        Object.keys(customSets).forEach(function(k) { snapshot[k] = customSets[k]; });
        contents.__monlineCustomData = snapshot;
        return contents;
    };
    var _extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _extractSaveContents.call(this, contents);
        var snap = contents && contents.__monlineCustomData;
        if (snap) {
            Object.keys(snap).forEach(function(k) { customSets[k] = snap[k] || {}; });
        }
        mergeCustomIntoDatabase();
    };

    F.CustomData = CustomData;
    window.CustomData = CustomData;
    MR.CustomData = CustomData;
    MR.mergeCustomIntoDatabase = mergeCustomIntoDatabase;

    // The scripts only ever call CustomData.update_*, but 0176.rb also exposes
    // the raw registries as $custom_actors / $custom_armors / ... - hand those
    // out for real instead of an auto-vivified stub.  A getter is used because
    // loading a save swaps the whole hash out.
    Object.keys(CUSTOM_KINDS).forEach(function(kind) {
        var plural = CUSTOM_KINDS[kind];
        var resolver = function() { return customSet(plural); };
        GLOBAL_BRIDGE['custom_' + plural] = resolver;
        try {
            Object.defineProperty(window, '$custom_' + plural, {
                get: resolver, configurable: true
            });
        } catch (e) { /* a few engines freeze window - the scope bridge still works */ }
    });

    //-------------------------------------------------------------------------
    // 6) Cosmetic systems -> safe stubs, recorded for Phase 2
    //-------------------------------------------------------------------------
    var COSMETIC = [
        'light', 'weather', 'weather_stop', 'show_fog', 'fade_fog', 'tint_fog',
        'cam_set', 'cam_center', 'cam_follow', 'cam_freeze', 'cam_reset',
        'chain_commands', 'combine_choices', 'global_save',
        'global_load', 'call_monster_catalogue', 'break_loop', 'end_loop',
        'disable_choice', 'hide_choice', 'disable_good', 'hide_good',
        'snooze_bar', 'remove_bar', 'set_symbols', 'char_effects',
        'reflect_sprite', 'zoom_event_sprite', 'zoom_player_sprite',
        'anchor_picture_to_event', 'anchor_picture_to_map',
        'anchor_picture_to_player', 'anchor_picture_to_screen',
        'get_shop', 'price_good', 'set_flash', 'screen_flash'
    ];

    function stub(name) {
        return function() {
            MR.pending[name] = (MR.pending[name] || 0) + 1;
            return true;
        };
    }
    MR.stub = stub;

    /**
     * A counting stub that is callable *and* answers any property access with
     * another counting stub.  The VX Ace scripts use a lot of method-style
     * configuration on their helper objects:
     *
     *     light.setup("torch")
     *     light.chara_id = @event_id
     *     light.set_color(255, 225, 225, 20)
     *     light("player torch").clear
     *
     * Enumerating every one of those names is brittle, so instead we provide
     * one self-extending object per system and record what was actually asked
     * for in MonlineRuby.pending (the Phase 2 worklist).
     */
    function permissiveStub(name) {
        function note(k) {
            var key = k ? name + '.' + k : name;
            MR.pending[key] = (MR.pending[key] || 0) + 1;
            return key;
        }
        var target = function() { return permissiveStub(name + '()'); };
        if (!window.Proxy) {
            var plain = function() { note(); return true; };
            plain.__rubyStub = name;
            return plain;
        }
        var handler = {
            get: function(t, k) {
                if (typeof k === 'symbol') {
                    if (k === TO_PRIM) { return function(hint) { return hint === 'number' ? 0 : ''; }; }
                    return undefined;
                }
                if (k === 'toString' || k === 'valueOf') { return function() { return ''; }; }
                if (k === '__rubyStub') { return name; }
                if (!(k in t)) {
                    note(k);
                    t[k] = permissiveStub(name + '.' + k);
                }
                return t[k];
            },
            set: function(t, k, v) { t[k] = v; return true; },
            has: function() { return true; },
            apply: function() { note(); return permissiveStub(name + '()'); },
            construct: function() { return permissiveStub('new ' + name); }
        };
        return new Proxy(target, handler);
    }
    MR.permissiveStub = permissiveStub;

    /**
     * Is `name` backed by a *real* port rather than a placeholder?
     *
     * `MonlineShim` runs before this plugin and installs bare no-op functions on
     * `window` for every system it merely neutralises (`show_fog`, `cam_*`,
     * `fade_fog`, ...), recording each in `MonlineShim.functions`.  Those
     * placeholders are indistinguishable from a real port by `typeof` alone, so
     * the shim's own bookkeeping is the single source of truth: a name is only
     * "real" once a port plugin has *removed* it from that list (MonlinePicAnchor
     * does exactly that for the `anchor_picture_to_*` family).
     */
    function isRealPort(name) {
        var value = window[name];
        // Container-style ports (`map_effects`, addressed as
        // `map_effects.set_tone(...)` with property writes) are objects, not
        // functions.  They mark themselves `__monlineReal` so this recognises
        // them; without that the loop below would install a stub into `F` and
        // shadow the real object.
        if (value && typeof value === 'object' && value.__monlineReal) { return true; }
        if (typeof value !== 'function') { return false; }
        if (value.__rubyStub) { return false; }
        var shimmed = window.MonlineShim && window.MonlineShim.functions;
        if (shimmed && shimmed.indexOf(name) >= 0) { return false; }
        return true;
    }
    MR.isRealPort = isRealPort;

    // Names not (yet) implemented for real: recorded and neutralised.
    //
    // A port plugin may already have provided a real implementation -- e.g.
    // MonlinePicAnchor fills in the whole `anchor_picture_to_*` family.  `F` is
    // the `with` object of the sandbox, so installing a stub here would *shadow*
    // the real `window` function and quietly turn every call back into a no-op
    // (the exact class of defect this pass exists to remove), while still
    // reporting the name as "pending" and hiding that it was ever ported.
    // Anything MonlineShim is still only *pretending* to provide must keep its
    // stub, or the name would drop off the Phase 2 worklist entirely.
    COSMETIC.forEach(function(n) {
        if (F[n] !== undefined) { return; }
        if (isRealPort(n)) { return; }
        F[n] = stub(n);
    });

    // Systems that are addressed in method style -> one permissive stub each.
    //
    // `light` is special: MonlineLights.js is a real port of Zeus81 Lights &
    // Shadows, so the interpreter gets a live proxy - callable
    // (`light("player torch")`) *and* addressable (`light.setup("torch")`,
    // `light.chara_id = @event_id`), with property access always resolving
    // against the current event's light, exactly like the Ruby default
    // argument `key = "event#@event_id"`.
    if (window.MonlineLights && window.MonlineLights.interpreterProxy) {
        F.light = window.MonlineLights.interpreterProxy();
        F.shadow = window.MonlineLights.interpreterShadowProxy();
        F.set_shadowable = window.MonlineLights.set_shadowable;
    } else {
        F.light = permissiveStub('light');
        F.shadow = permissiveStub('shadow');
        F.set_shadowable = stub('set_shadowable');
    }
    // `map_effects` is a container-style port (MonlineMapEffects.js): it hangs
    // a real object on `window` marked `__monlineReal`.  Only install the
    // permissive stub when it was NOT ported, otherwise the stub in `F` would
    // shadow the real object and silently no-op every `map_effects.*` call.
    if (!isRealPort('map_effects')) {
        F.map_effects = permissiveStub('map_effects');
    }
    F.Tidloc = permissiveStub('Tidloc');
    F.weather = permissiveStub('weather');

    MR.F = F;
    MR.COSMETIC = COSMETIC;

    // Publish the Ruby API on window as well, so a call that resolves outside
    // the `with` scope (or from another plugin) still reaches the real
    // implementation instead of MonlineShim's no-op stub.
    ['self_switch', 'setSelfSwitch', 'setAllSelf', 'isSelfSwitch', 'isNil',
     'set_char', 'restore_char', 'restore_char', 'jump_to', 'jump_to_char',
     'move_toward_xy', 'move_toward_event', 'turn_toward_event', 'find_path',
     'chase_leader', 'get_hp_percent', 'gain_armor', 'equip_armor_by_etype',
     'remove_equip', 'fadeout', 'fadein', 'anim', 'balloon',
     'light', 'map_effects', 'Tidloc', 'puts', 'print', 'rand',
     'shadow', 'set_shadowable',
     '__instanceEval', 'instance_eval'
    ].forEach(function(k) {
        if (F[k] !== undefined) { window[k] = F[k]; }
    });

    //-------------------------------------------------------------------------
    // 7) The sandboxed evaluator
    //-------------------------------------------------------------------------
    var scopeProxy = null;
    var scopeCache = {};
    var autoStubCache = {};

    /**
     * Last-resort stand-in for a name the scripts use but nobody has ported.
     * Recorded in MonlineRuby.pending, never throws.
     */
    function autoStub(name) {
        if (!autoStubCache[name]) {
            autoStubCache[name] = stub('?' + name);
        }
        return autoStubCache[name];
    }

    function makeScope() {
        if (!window.Proxy) { return F; }
        if (!scopeProxy) {
            scopeProxy = new Proxy(F, {
                has: function(t, k) {
                    if (typeof k !== 'string') { return false; }
                    // `with(obj)` is consulted *before* the function's own scope
                    // chain, so claiming these would shadow the evaluator's own
                    // `__self` / `__scope` parameters and make every `@ivar`
                    // and `self.x` resolve to a stub instead of the real object.
                    if (k === '__self' || k === '__scope') { return false; }
                    if (k.charAt(0) === '$') { return true; }
                    if (Object.prototype.hasOwnProperty.call(t, k)) { return true; }
                    // A real engine/JS global resolves normally; anything else is
                    // an unported VX Ace helper, so claim it and auto-stub it.
                    return !(k in window);
                },
                get: function(t, k) {
                    if (typeof k !== 'string') { return t[k]; }
                    if (k.charAt(0) === '$') {
                        var name = k.slice(1);
                        if (scopeCache[k] === undefined) {
                            var resolver = GLOBAL_BRIDGE[name];
                            if (resolver) {
                                scopeCache[k] = { get: resolver };
                            } else {
                                scopeCache[k] = omnipotent(k);
                            }
                        }
                        var entry = scopeCache[k];
                        if (entry && entry.get) { return entry.get(); }
                        return entry;
                    }
                    if (Object.prototype.hasOwnProperty.call(t, k)) { return t[k]; }
                    var g = window[k];
                    if (typeof g === 'function') { return g; }
                    if (k in window) { return g; }
                    return autoStub(k);
                },
                set: function(t, k, v) {
                    if (typeof k === 'string' && k.charAt(0) === '$') {
                        scopeCache[k] = v;
                        return true;
                    }
                    t[k] = v;
                    return true;
                }
            });
        }
        return scopeProxy;
    }

    MR.evalScript = function(src, self, kind) {
        if (typeof src !== 'string' || !src.trim()) { return true; }
        if (kind === 'move') { MR.stats.move++; } else { MR.stats.event++; }
        var code = MR.translate(src);
        var scope = makeScope();
        var fn = compile(code);
        if (!fn) {
            // Last resort, mirroring evalExpr: a single unbalanced bracket in
            // hand-written event code otherwise kills the *whole* 355 block.
            // (The build-time balance guard in fix_data_defects.py keeps this
            // path unused; it exists so a future data edit cannot soft-break an
            // event without a trace.)
            fn = compile(repairBalance(code));
            if (fn) { MR.stats.repaired = (MR.stats.repaired || 0) + 1; }
        }
        if (!fn) { recordError(kind, src, lastCompileError); return false; }
        try {
            fn.call(self, self, scope);
        } catch (e) {
            recordError(kind, src, e);
            return false;
        }
        return true;
    };

    var lastCompileError = null;

    function compile(code) {
        try {
            // new Function bodies are sloppy-mode even inside a strict IIFE,
            // which is what lets us use `with` for Ruby-style globals.
            return new Function('__self', '__scope', 'with(__scope){\n' + code + '\n}');
        } catch (e) {
            lastCompileError = e;
            return null;
        }
    }

    /**
     * Evaluate a Ruby *expression* (not a statement list) and return its value.
     * Used by the conditional-branch and control-variable commands, which need
     * a result rather than a side effect.
     *
     * `quiet` suppresses the error bookkeeping - used by the "extra page
     * condition" script test, where the original script rescues and simply
     * treats a failure as "condition not met".
     */
    MR.evalExpr = function(src, self, quiet) {
        if (typeof src !== 'string' || !src.trim()) { return undefined; }
        var code = MR.translate(src, { expression: true });
        var scope = makeScope();
        var attempt = function(body) {
            return new Function('__self', '__scope', 'with(__scope){\n' + body + '\n}');
        };
        try {
            return attempt('return (' + code + ');').call(self, self, scope);
        } catch (e1) {
            // The original data has a few unbalanced parenthesis typos; try the
            // bare form, then a repaired form, before giving up.
            try {
                return attempt('return ' + code + ';').call(self, self, scope);
            } catch (e2) {
                try {
                    return attempt('return (' + repairBalance(code) + ');')
                        .call(self, self, scope);
                } catch (e3) {
                    if (!quiet) { recordError('expr', src, e2); }
                    return undefined;
                }
            }
        }
    };

    //-------------------------------------------------------------------------
    // 8) Hook every Ruby entry point the engine has
    //    (found by grepping `eval(` across js/ - MV 1.6.3 guards none of the
    //     interpreter ones, so each is a freeze waiting to happen)
    //-------------------------------------------------------------------------

    // The "wait for the world" channel.
    //
    // A few of the ported systems are coroutine-driven in Ruby and suspend the
    // event with `Fiber.yield while <condition>` - Galv's Cam Control parks the
    // cutscene until the camera has finished gliding.  MV's interpreter is
    // update()-driven, so the equivalent is one of MV's own wait modes.  A port
    // records the mode it needs here and command355 hands it to the interpreter,
    // which then suspends the event exactly as the Fiber did.
    //
    // It is cleared before every script block and consumed immediately after, so
    // a request can never leak from one event into the next.
    var pendingWait = null;
    MR.waitFor = function(mode) { pendingWait = mode; };

    // A) move-route script command - the one MV forgot to guard.
    var _processMoveCommand = Game_Character.prototype.processMoveCommand;
    Game_Character.prototype.processMoveCommand = function(command) {
        if (command && command.code === 45) {
            var prev = MR.current;
            MR.current = this;
            try {
                MR.evalScript(command.parameters[0], this, 'move');
            } catch (e) {
                recordError('move', command.parameters[0], e);
            }
            MR.current = prev;
            return;
        }
        return _processMoveCommand.apply(this, arguments);
    };

    // B) event script command 355 (+655 continuations).
    //    NOTE: do *not* advance `this._index` here.  MV's executeCommand()
    //    already does `this._index++` after the command returns true, and the
    //    native command355 relies on that - an extra increment would silently
    //    swallow the command following every script block.
    Game_Interpreter.prototype.command355 = function() {
        var script = this.currentCommand().parameters[0] + '\n';
        while (this.nextEventCode() === 655) {
            this._index++;
            script += this.currentCommand().parameters[0] + '\n';
        }
        var prev = MR.current;
        MR.current = this;
        pendingWait = null;
        try {
            MR.evalScript(script, this, 'event');
        } catch (e) {
            recordError('event', script, e);
        }
        MR.current = prev;

        // A ported system can ask for the event to be parked (see MR.waitFor).
        // `setWaitMode` is MV's own suspend mechanism, and MV's update() loop
        // checks updateWait() right after this command returns true - so the
        // wait takes effect before the next command is fetched.
        if (pendingWait) {
            var mode = pendingWait;
            pendingWait = null;
            if (typeof this.setWaitMode === 'function') { this.setWaitMode(mode); }
        }
        return true;
    };

    // C) conditional branch, "Script" condition (command111, operand type 12).
    //    The condition is pre-evaluated and the parameter replaced with a plain
    //    boolean literal so MV's own branch bookkeeping stays untouched.
    var _command111 = Game_Interpreter.prototype.command111;
    Game_Interpreter.prototype.command111 = function() {
        var p = this._params;
        if (p && p[0] === 12 && typeof p[1] === 'string') {
            var original = p[1];
            var result = false;
            var prev = MR.current;
            MR.current = this;
            try {
                result = !!MR.evalExpr(original, this);
            } catch (e) {
                recordError('condition', original, e);
            }
            MR.current = prev;
            MR.stats.conditions = (MR.stats.conditions || 0) + 1;
            p[1] = result ? 'true' : 'false';
            var r = _command111.apply(this, arguments);
            p[1] = original;                 // never persist into $dataMap
            return r;
        }
        return _command111.apply(this, arguments);
    };

    // D) control variables, "Script" operand (command122, operand type 4).
    var _command122 = Game_Interpreter.prototype.command122;
    Game_Interpreter.prototype.command122 = function() {
        var p = this._params;
        if (p && p[3] === 4 && typeof p[4] === 'string') {
            var original = p[4];
            var value;
            var prev = MR.current;
            MR.current = this;
            try {
                value = MR.evalExpr(original, this);
            } catch (e) {
                recordError('variable', original, e);
                value = 0;
            }
            MR.current = prev;
            if (value === undefined || value === null
                || (typeof value === 'number' && isNaN(value))) { value = 0; }
            MR.stats.variableOps = (MR.stats.variableOps || 0) + 1;
            MR.tmpValue = value;
            p[4] = 'MonlineRuby.tmpValue';
            var r = _command122.apply(this, arguments);
            p[4] = original;
            return r;
        }
        return _command122.apply(this, arguments);
    };

    // E) damage formulas.  MV already wraps evalDamageFormula in try/catch and
    //    provides `v`, but VX Ace formulas that call ported methods (e.g.
    //    `b.gain_jp(1)`) can yield NaN.  Clamp that to 0 damage.
    var _evalDamageFormula = Game_Action.prototype.evalDamageFormula;
    Game_Action.prototype.evalDamageFormula = function(target) {
        var value = _evalDamageFormula.call(this, target);
        return (typeof value === 'number' && isNaN(value)) ? 0 : value;
    };
    MR.tmpValue = 0;

    //-------------------------------------------------------------------------
    // 9) Ruby-named accessors on every object a script can see as `self`
    //-------------------------------------------------------------------------
    // A full audit of the ported data shows the scripts only ever touch five
    // instance variables:
    //     @event_id   1628 reads
    //     @map_id      161 reads
    //     @move_speed    6 reads/writes
    //     @dashing       1 read
    //     @shop_stock  114 indexed writes   <- the only mutating one
    // They are used from *both* event scripts (`self` = Game_Interpreter) and
    // move routes (`self` = Game_Character/Game_Event), so each accessor is
    // installed on every host and written defensively.
    function installAccessors(proto) {
        if (!proto) { return; }
        defAccessor(proto, 'map_id',
            function() {
                // Game_Event and Game_Interpreter both carry the authoritative
                // `_mapId`; only fall back to the current map for hosts
                // (Game_Player) that have none.
                if (this._mapId != null) { return this._mapId; }
                return $gameMap ? $gameMap.mapId() : 0;
            },
            function() {});
        defAccessor(proto, 'event_id',
            function() { return this._eventId || 0; },
            function() {});
        // VX Ace declares `attr_accessor :move_speed`, so scripts both read
        // *and write* it - and the data really does use fractions
        // (`$game_map.events[20].move_speed = 4.15`, which VX Ace turns into
        // distance_per_frame = 2 ** 4.15 / 256).  MV spells it `moveSpeed()`,
        // a method, so:
        //   * the translator must NOT rewrite the assignment target
        //     (`X.moveSpeed() = 4` is a runtime ReferenceError that would kill
        //     the whole script), and
        //   * this accessor must not truncate to an integer.
        defAccessor(proto, 'move_speed',
            function() {
                if (typeof this.moveSpeed === 'function') { return this.moveSpeed(); }
                return this._moveSpeed == null ? 4 : this._moveSpeed;
            },
            function(v) {
                if (v == null || v === '') { return; }   // nil: keep the current value
                var n = Number(v);
                if (!isFinite(n)) { return; }
                if (typeof this.setMoveSpeed === 'function') { this.setMoveSpeed(n); }
                else { this._moveSpeed = n; }
            });
        defAccessor(proto, 'dashing',
            function() {
                return typeof this.isDashing === 'function' ? this.isDashing() : false;
            },
            function() {});
        // VX Ace keeps the shop's stock list in `@shop_stock` on whichever
        // object runs the script.  MV has no such concept, so the list is
        // created lazily on first read/write and persists for that object's
        // lifetime - which mirrors Ruby's per-interpreter instance variable.
        defAccessor(proto, 'shop_stock',
            function() {
                if (!this._shopStock) { this._shopStock = []; }
                return this._shopStock;
            },
            function(v) { this._shopStock = v || []; });
    }
    installAccessors(Game_Character.prototype);
    installAccessors(Game_Event.prototype);
    installAccessors(Game_Interpreter.prototype);
    installAccessors(Game_Player.prototype);

    // `$game_player.no_dash = true` appears 66 times (42 true / 24 false) in
    // the map data: the game locks the player into walking during cutscenes
    // and scripted sequences.  VX Ace's custom dash script reads that flag
    // from `dash?`; MV computes dashing in Game_Player#updateDashing() from
    // isDashButtonPressed(), so we gate that instead of just storing a flag.
    defAccessor(Game_Character.prototype, 'no_dash',
        function() { return this._noDash === true; },
        function(v) { this._noDash = !!v; });
    var _isDashButtonPressed = Game_Player.prototype.isDashButtonPressed;
    Game_Player.prototype.isDashButtonPressed = function() {
        if (this._noDash) { return false; }
        return typeof _isDashButtonPressed === 'function'
            ? _isDashButtonPressed.call(this) : false;
    };

    // `$game_player.no_dash = true/false` really disables dashing.
    defAccessor(Game_Player.prototype, 'no_dash',
        function() { return this._noDash === true; },
        function(v) { this._noDash = !!v; });
    var _isDashing = Game_Player.prototype.isDashing;
    Game_Player.prototype.isDashing = function() {
        if (this._noDash === true) { return false; }
        return _isDashing.call(this);
    };

    // Some events drive the game's custom message-log window like this:
    //     SceneManager.scene.log_window.add_text("...")
    //     SceneManager.scene.log_window.add_text(...).flush()
    //     SceneManager.scene.log_window.wait_and_clear
    //
    // Two things are needed for that to survive:
    //   (a) this engine build only defines `SceneManager._scene`, never the
    //       public `SceneManager.scene` accessor the scripts use;
    //   (b) MV has no message-log window at all, so every scene gets a
    //       permissive stand-in rather than a TypeError at the call site.
    if (typeof SceneManager !== 'undefined' && !('scene' in SceneManager)) {
        try {
            Object.defineProperty(SceneManager, 'scene', {
                get: function() {
                    // A script can legitimately run while no scene is active
                    // (e.g. during a transfer); never hand back null.
                    if (!this._scene) {
                        if (!this._monlineSceneStub) {
                            this._monlineSceneStub = permissiveStub('SceneManager.scene');
                        }
                        return this._monlineSceneStub;
                    }
                    return this._scene;
                },
                configurable: true
            });
        } catch (e) { /* leave the engine alone if it refuses */ }
    }

    defAccessor(Scene_Base.prototype, 'log_window',
        function() {
            if (!this._monlineLogWindow) {
                this._monlineLogWindow = permissiveStub('log_window');
            }
            return this._monlineLogWindow;
        },
        function(v) { this._monlineLogWindow = v; });

    //-------------------------------------------------------------------------
    // 10) CP Page Conditions  (Neon Black) - comment-declared page conditions
    //-------------------------------------------------------------------------
    // The source project uses this VX Ace script (found in the game's own
    // Scripts.rvdata2), and 994 event pages across 656 events depend on it.
    //
    // It adds *extra* page conditions written inside a comment block: the
    // first line of the comment must match /extra condition[s]?/i, and every
    // following comment line is parsed as one condition.  Without it every one
    // of those pages looks unconditionally true, and because both VX Ace and
    // MV pick the *highest-numbered* matching page, the game silently selects
    // the wrong page - e.g. map 238's opening event has 11 pages gated as
    // "variable 99 = 0..99" and would always run the last one ("God Mode").
    //
    // Original Ruby: Game_Event#conditions_met? => native && page.extra_conditions
    var EXTRA_HEADER_RX = /extra condition[s]?/i;

    // Ordered exactly like the Ruby `case @string / when /re/ ...` chain -
    // Regexp#=== is an unanchored search, so the first match wins.
    var EXTRA_PARSERS = [
        [/switch\s+(\d+)\s+on/i, function(m) {
            return condTest(function() { return $gameSwitches.value(+m[1]) === true; });
        }],
        [/variable\s+(\d+)\s*(==|>=|<=|=|>|<)\s*(\d+)/i, function(m) {
            var id = +m[1], op = m[2] === '=' ? '==' : m[2], target = +m[3];
            return condTest(function() {
                var v = $gameVariables.value(id);
                switch (op) {
                    case '==': return v === target;
                    case '>=': return v >= target;
                    case '<=': return v <= target;
                    case '>':  return v > target;
                    case '<':  return v < target;
                }
                return false;
            });
        }],
        [/(item|weapon|armor|armour)\s+(\d+)/i, function(m) {
            var kind = m[1].toLowerCase(), id = +m[2];
            return condTest(function() {
                if (kind === 'item') { return $gameParty.hasItem($dataItems[id]); }
                if (kind === 'weapon') { return $gameParty.hasItem($dataWeapons[id], true); }
                return $gameParty.hasItem($dataArmors[id], true);
            });
        }],
        [/actor\s+(\d+)/i, function(m) {
            var id = +m[1];
            return condTest(function() {
                var actor = $gameActors.actor(id);
                return actor ? $gameParty.members().indexOf(actor) >= 0 : false;
            });
        }],
        [/script\s+(.+)/i, function(m, self) {
            var src = m[1];
            var c = condTest(function() {
                // Ruby: `return true if eval(@v1) rescue return false`
                try {
                    return !!MR.evalExpr(src, self, true);
                } catch (e) { return false; }
            });
            // Remember the source text so a later caller can rebind `self`.
            c.src = src;
            c.self = self;
            return c;
        }],
        [/day\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i,
         function(m) {
             var want = m[1].toUpperCase();
             return condTest(function() {
                 return DAY_NAMES[new Date().getDay()] === want;
             });
         }],
        [/month\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
         function(m) {
             var want = m[1].toUpperCase();
             return condTest(function() {
                 return MONTH_NAMES[new Date().getMonth()] === want;
             });
         }],
        [/day\s+(\d+)/i, function(m) {
            var want = +m[1];
            return condTest(function() { return new Date().getDate() === want; });
        }],
        [/month\s+(\d+)/i, function(m) {
            var want = +m[1];
            return condTest(function() { return new Date().getMonth() + 1 === want; });
        }],
        [/date\s+(\d+)\/(\d+)/i, function(m) {
            var mon = +m[1], day = +m[2];
            return condTest(function() {
                var d = new Date();
                return d.getMonth() + 1 === mon && d.getDate() === day;
            });
        }],
        [/year\s+(\d+)/i, function(m) {
            var want = +m[1];
            return condTest(function() { return new Date().getFullYear() === want; });
        }],
        [/date\s+(before|after)\s+(\d+)\/(\d+)/i, function(m) {
            var before = m[1].toUpperCase() === 'BEFORE', mon = +m[2], day = +m[3];
            return condTest(function() {
                var d = new Date(), cm = d.getMonth() + 1, cd = d.getDate();
                if (before) {
                    if (cm !== mon) { return cm < mon; }
                    return cd < day;
                }
                if (cm !== mon) { return cm > mon; }
                return cd >= day;
            });
        }],
        [/time\s+(before|after)\s+(\d+):(\d+)/i, function(m) {
            var before = m[1].toUpperCase() === 'BEFORE', hr = +m[2], mn = +m[3];
            return condTest(function() {
                var d = new Date(), ch = d.getHours(), cm = d.getMinutes();
                if (before) {
                    if (ch !== hr) { return ch < hr; }
                    return cm < mn;
                }
                if (ch !== hr) { return ch > hr; }
                return cm >= mn;
            });
        }],
        [/timer\s+(\d*):(\d+)/i, function(m) {
            var sec = (+(m[1] || 0)) * 60 + (+m[2]);
            return condTest(function() { return $gameTimer.seconds() <= sec; });
        }]
    ];

    var DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
                     'FRIDAY', 'SATURDAY'];
    var MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
                       'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER',
                       'DECEMBER'];

    function condTest(fn) { return { test: fn }; }

    /** Build one condition out of a comment line. Unknown text is a no-op. */
    function parseExtraCondition(text, self) {
        for (var i = 0; i < EXTRA_PARSERS.length; i++) {
            var m = EXTRA_PARSERS[i][0].exec(text);
            if (m) { return EXTRA_PARSERS[i][1](m, self); }
        }
        // Ruby's `when :skip then return true`
        return condTest(function() { return true; });
    }

    var EMPTY_CONDS = [];

    /**
     * Collect every condition declared in the page's leading comment block,
     * cached on the page.  The cache property is non-enumerable so it can
     * never leak back into serialised map data.
     */
    function pageExtraConditions(page) {
        if (!page || !page.list) { return EMPTY_CONDS; }
        if (page.__monlineCondCache) { return page.__monlineCondCache; }
        var out = [];
        var adding = false;
        for (var i = 0; i < page.list.length; i++) {
            var line = page.list[i];
            if (!line) { continue; }
            var text = (line.parameters && line.parameters[0]) || '';
            if (typeof text !== 'string') { text = String(text); }
            if (line.code === 108) {
                adding = EXTRA_HEADER_RX.test(text);
            } else if (line.code === 408) {
                if (adding) { out.push(parseExtraCondition(text.trim(), null)); }
            } else {
                adding = false;
            }
        }
        try {
            Object.defineProperty(page, '__monlineCondCache', {
                value: out, enumerable: false, configurable: true
            });
        } catch (e) { page.__monlineCondCache = out; }
        return out;
    }

    function extraConditionsMet(page, self) {
        var conds = pageExtraConditions(page);
        for (var i = 0; i < conds.length; i++) {
            var c = conds[i];
            // A `script ...` condition needs the event as `self`; the rest
            // ignore it, so rebind lazily instead of caching per instance.
            if (c.src !== undefined && c.self !== self) {
                c = parseExtraCondition(c.src, self);
            }
            if (!c.test()) { return false; }
        }
        return true;
    }

    var _meetsConditions = Game_Event.prototype.meetsConditions;
    Game_Event.prototype.meetsConditions = function(page) {
        if (!_meetsConditions.call(this, page)) { return false; }
        return extraConditionsMet(page, this);
    };
    MR.extraConditionsMet = extraConditionsMet;
    MR.pageExtraConditions = pageExtraConditions;

    //-------------------------------------------------------------------------
    // 11) Diagnostics
    //-------------------------------------------------------------------------
    MR.report = function() {
        var groups = Object.keys(errorGroups).map(function(msg) {
            return {
                err: msg,
                count: errorGroups[msg].n,
                kind: errorGroups[msg].samples[0] ? errorGroups[msg].samples[0].kind : '?',
                sample: errorGroups[msg].samples[0] ? errorGroups[msg].samples[0].src : ''
            };
        }).sort(function(a, b) { return b.count - a.count; });
        return {
            stats: MR.stats,
            errorCount: MR.errors.length,
            groupCount: groups.length,
            groups: groups,
            errors: MR.errors.slice(0, 40),
            pending: MR.pending
        };
    };
    MR.reset = function() {
        MR.stats = { move: 0, event: 0, failedMove: 0, failedEvent: 0, translated: 0 };
        MR.errors = [];
        errorGroups = {};
        MR.pending = {};
    };

    console.log('[MonlineRubyBridge] loaded');
})();
