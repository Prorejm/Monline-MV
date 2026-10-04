//=============================================================================
// MonlineJp.js
//=============================================================================
/*:
 * @plugindesc YEA JP Manager (0173.rb) - the *earning* half: JP from enemy
 * kills, skill/item use and level ups.
 * @author Monline port
 *
 * @help
 * Port of 0173.rb (Yanfly Engine Ace - JP Manager v1.00).
 *
 * The storage half already lives in MonlineScenes.js: `jp(classId)`,
 * `gainJp(value, classId)` and `loseJp(value, classId)` keep one pool per class
 * (0173.rb:472-511).  This file adds everything 0173.rb drives out of battle:
 *
 *   BattleManager.gainJp   0173.rb:372  grants $gameTroop.jpTotal() to every
 *                                       battle member through earnJp (rate
 *                                       applied).  Called from 0174.rb:377,
 *                                       i.e. inside process_victory right after
 *                                       the victory ME.
 *   Game_Actor#earnJp      0173.rb:480  gainJp(value * jpr) - unlike gainJp,
 *                                       the JP rate traits are applied.
 *   jpr                    0173.rb:395  product of every <jp rate: x%> on the
 *                                       actor, its class, its equips and its
 *                                       states.  Default 1.0, so no tag = 100%.
 *   Game_Enemy#jp          0173.rb:533  <jp gain: x> of the enemy, default
 *                                       YEA::JP::ENEMY_KILL.
 *   Game_Troop#jpTotal     0173.rb:548  sum over *dead* members only.
 *   action JP              0173.rb:446  earnJp(item.jp_gain) on every hit that
 *                                       lands, actors only.
 *   level up JP            0173.rb:517  earnJp(YEA::JP::LEVEL_UP).
 *
 * Data census - the converted MV data matches the original .rvdata2 byte for
 * byte, and it is what decides which of the three sources are actually live:
 *
 *   Enemies.json   159 x <jp gain: N>   -> the victory grant is LIVE
 *   Actors.json      1 x <jp rate: 0%>  (id 25, PXE - earns nothing from
 *                                       battle, which is why the event script
 *                                       for PXE uses gain_jp and not earn_jp)
 *   Skills / Items / Weapons / Armors / States / Classes / Troops: 0 tags
 *
 * YEA::JP::ENEMY_KILL, LEVEL_UP and ACTION_JP are all 0 (0173.rb:146-148), so
 * the last two hooks are inert for this game: with no <jp gain:> tag on any of
 * the 815 skills or 370 items, `item.jp_gain` is always the 0 constant, and
 * level ups add 0.  They are ported anyway so the constants stay the single
 * source of truth, and both are skipped entirely when the amount is 0 - which
 * is exactly what earn_jp(0) does in Ruby.
 *
 * Deliberately NOT ported: `battle_jp_earned` (0173.rb:423-441, 493-494).  Its
 * only reader is the Victory Aftermath window (0174.rb), which this port does
 * not have, so the accumulator would have no consumer.  For the same reason no
 * victory line is printed: with `$imported["YEA-VictoryAftermath"]` true,
 * 0173.rb:377 `next if ...` skips the `$game_message.add` branch entirely.
 */

var MonlineJp = MonlineJp || {};

(function() {
    'use strict';

    //-------------------------------------------------------------------------
    // 0173.rb:136-157 - module YEA::JP settings, unchanged from the original.
    //-------------------------------------------------------------------------
    MonlineJp.Config = {
        ICON:             0,
        VOCAB:            'SP',
        MAX_JP:           99999999,
        // 0173.rb:146-148. All three are 0 in this game - see the header.
        ENEMY_KILL:       0,
        LEVEL_UP:         0,
        ACTION_JP:        0,
        VICTORY_MESSAGE:  '%s has earned %s %s!',
        VICTORY_AFTERMATH: '+%s%s'
    };

    // 0173.rb:177/182 - the tag regexes, verbatim. `jp gain` keeps its last
    // occurrence (Ruby assigns inside the `each`, so a later tag overwrites an
    // earlier one); `jp rate` is a percentage and needs the % sign.
    var JP_GAIN_RE = /<(?:JP_GAIN|jp gain):[ ](\d+)>/gi;
    var JP_RATE_RE = /<(?:JP_RATE|jp rate):[ ](\d+)(?:[%％])>/gi;

    /** @return {object|null} Global class/object by name, or null when absent. */
    function resolve(name) {
        var scope = (typeof window !== 'undefined') ? window
                  : (typeof global !== 'undefined') ? global
                  : (typeof globalThis !== 'undefined') ? globalThis : null;
        return (scope && scope[name]) ? scope[name] : null;
    }

    /** Install a brand new method (0173.rb defines these, MV does not). */
    function define(className, methodName, fn) {
        var klass = resolve(className);
        if (!klass || !klass.prototype) { return false; }
        klass.prototype[methodName] = fn;
        return true;
    }

    /** Alias an existing method; a no-op when the class or method is missing. */
    function hook(className, methodName, wrap) {
        var klass = resolve(className);
        if (!klass || !klass.prototype) { return false; }
        var original = klass.prototype[methodName];
        if (typeof original !== 'function') { return false; }
        klass.prototype[methodName] = wrap(original);
        return true;
    }

    function noteOf(obj) {
        return (obj && typeof obj.note === 'string') ? obj.note : '';
    }

    //-------------------------------------------------------------------------
    // Notetag cache.  0173.rb reads the tags once at load_database time
    // (0173.rb:249-258); this port has no such hook point, so the parsed pair
    // is memoised on the data object and re-read whenever the note changes.
    //-------------------------------------------------------------------------
    function record(obj) {
        if (!obj) { return null; }
        var note = noteOf(obj);
        var rec = obj._monlineJp;
        if (rec && rec.note === note) { return rec; }
        rec = { note: note, gain: null, rate: null };
        obj._monlineJp = rec;
        return rec;
    }

    /**
     * `<jp gain: x>` of a database object.  0173.rb:337/307 - enemies fall back
     * to ENEMY_KILL, skills and items to ACTION_JP.
     *
     * @param {object} obj Database entry, may be null.
     * @param {number} fallback Constant used when the object has no tag.
     * @return {number} JP granted.
     */
    MonlineJp.jpGainOf = function(obj, fallback) {
        var rec = record(obj);
        if (!rec) { return fallback || 0; }
        if (rec.gain === null) {
            var value = fallback || 0;
            var m;
            JP_GAIN_RE.lastIndex = 0;
            while ((m = JP_GAIN_RE.exec(rec.note)) !== null) {
                value = parseInt(m[1], 10);
            }
            rec.gain = value;
        }
        return rec.gain;
    };

    /**
     * `<jp rate: x%>` of a database object as a multiplier.  0173.rb:277-288 -
     * no tag means 1.0 (100%); the tag is stored as `x * 0.01`.
     *
     * @param {object} obj Database entry, may be null.
     * @return {number} Rate multiplier, 1.0 by default.
     */
    MonlineJp.jpRateOf = function(obj) {
        var rec = record(obj);
        if (!rec) { return 1.0; }
        if (rec.rate === null) {
            var value = 1.0;
            var m;
            JP_RATE_RE.lastIndex = 0;
            while ((m = JP_RATE_RE.exec(rec.note)) !== null) {
                value = parseInt(m[1], 10) * 0.01;
            }
            rec.rate = value;
        }
        return rec.rate;
    };

    //-------------------------------------------------------------------------
    // 0173.rb:395 - Game_BattlerBase#jpr.
    //-------------------------------------------------------------------------
    define('Game_BattlerBase', 'jpRate', function() {
        var n = 1.0;
        if (this.isActor && this.isActor()) {
            n *= MonlineJp.jpRateOf(this.actor ? this.actor() : null);
            n *= MonlineJp.jpRateOf(this.currentClass ? this.currentClass() : null);
            var equips = this.equips ? this.equips() : [];
            for (var i = 0; i < equips.length; i++) {
                if (equips[i]) { n *= MonlineJp.jpRateOf(equips[i]); }
            }
        }
        var states = this.states ? this.states() : [];
        for (var j = 0; j < states.length; j++) {
            if (states[j]) { n *= MonlineJp.jpRateOf(states[j]); }
        }
        return n;
    });

    //-------------------------------------------------------------------------
    // 0173.rb:480 - Game_Actor#earn_jp.  The rate only applies here: gain_jp
    // and lose_jp (0173.rb:487/500) bypass it on purpose, which is why the
    // event scripts - `$game_actors[25].gain_jp(1)` for the 0% PXE - use it.
    //-------------------------------------------------------------------------
    define('Game_Actor', 'earnJp', function(value, classId) {
        var base = (typeof value === 'number') ? value : (parseFloat(value) || 0);
        if (typeof this.gainJp !== 'function') { return 0; }
        return this.gainJp(base * this.jpRate(), classId);
    });
    define('Game_Actor', 'earn_jp', function(value, classId) {
        return this.earnJp(value, classId);
    });

    //-------------------------------------------------------------------------
    // 0173.rb:517 - Game_Actor#level_up.  Inert here (LEVEL_UP = 0).
    //-------------------------------------------------------------------------
    hook('Game_Actor', 'levelUp', function(original) {
        return function() {
            var result = original.apply(this, arguments);
            var gain = MonlineJp.Config.LEVEL_UP;
            if (gain && typeof this.earnJp === 'function') { this.earnJp(gain); }
            return result;
        };
    });

    //-------------------------------------------------------------------------
    // 0173.rb:533 - Game_Enemy#jp.
    //-------------------------------------------------------------------------
    define('Game_Enemy', 'jp', function() {
        return MonlineJp.jpGainOf(this.enemy ? this.enemy() : null,
                                  MonlineJp.Config.ENEMY_KILL);
    });

    //-------------------------------------------------------------------------
    // 0173.rb:548 - Game_Troop#jp_total.  Only members that actually died
    // count, so escaping enemies (or a troop wiped by an event) pay nothing.
    //-------------------------------------------------------------------------
    define('Game_Troop', 'jpTotal', function() {
        var total = 0;
        var dead = this.deadMembers ? this.deadMembers() : [];
        for (var i = 0; i < dead.length; i++) {
            var member = dead[i];
            if (member && typeof member.jp === 'function') {
                total += member.jp() || 0;
            }
        }
        return total;
    });

    //-------------------------------------------------------------------------
    // 0173.rb:372 - BattleManager.gain_jp.
    // `$game_party.members` is battle_members while a battle is running
    // (0025.rb:54), which is exactly what MV's `$gameParty.members()` answers,
    // so reserve members are not paid.
    //-------------------------------------------------------------------------
    MonlineJp.gainJp = function() {
        // `resolve` and not a bare global: reading an undeclared identifier
        // throws in strict mode, and this runs before the battle globals exist
        // in any harness that loads the file on its own.
        var troop = resolve('$gameTroop');
        var party = resolve('$gameParty');
        var amount = (troop && typeof troop.jpTotal === 'function')
            ? troop.jpTotal() : 0;
        var members = (party && typeof party.members === 'function')
            ? party.members() : [];
        for (var i = 0; i < members.length; i++) {
            var member = members[i];
            if (member && typeof member.earnJp === 'function') {
                member.earnJp(amount);
            }
        }
        return amount;
    };

    // 0174.rb:377 - Victory Aftermath calls gain_jp from process_victory, after
    // play_battle_end_me and before display_exp.  MV has no such script, so the
    // call is grafted onto the front of BattleManager.processVictory: like the
    // original it therefore runs *before* `$gameParty.removeBattleStates()`
    // (VX Ace only clears battle states in battle_end, 0174.rb:385) and before
    // gainExp, so any level-up JP lands on top of the victory JP.
    var BattleManagerRef = resolve('BattleManager');
    if (BattleManagerRef) {
        BattleManagerRef.gainJp = MonlineJp.gainJp;
        var _processVictory = BattleManagerRef.processVictory;
        if (typeof _processVictory === 'function') {
            BattleManagerRef.processVictory = function() {
                this.gainJp();
                return _processVictory.apply(this, arguments);
            };
        }
    }

    //-------------------------------------------------------------------------
    // 0173.rb:446 - Game_Battler#item_user_effect, the action-JP hook.  Ruby
    // runs it on the *target* with the user passed in, and only when the hit
    // landed; MV's Game_Action#applyItemUserEffect is the same point in
    // Game_Action#apply (0173.rb:449 -> rpg_objects.js:1664).  Inert here:
    // ACTION_JP is 0 and no skill or item carries a <jp gain:> tag.
    //-------------------------------------------------------------------------
    hook('Game_Action', 'applyItemUserEffect', function(original) {
        return function(target) {
            var result = original.call(this, target);
            var gain = MonlineJp.jpGainOf(this.item ? this.item() : null,
                                          MonlineJp.Config.ACTION_JP);
            if (gain) {
                var subject = this.subject ? this.subject() : null;
                if (subject && subject.isActor && subject.isActor() &&
                        typeof subject.earnJp === 'function') {
                    subject.earnJp(gain);
                }
            }
            return result;
        };
    });

    MonlineJp.resolve = resolve;
})();
