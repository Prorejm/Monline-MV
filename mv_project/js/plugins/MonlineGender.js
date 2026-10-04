//=============================================================================
// MonlineGender.js
//-----------------------------------------------------------------------------
// Port of VX Ace 0153.rb, Mr. Bubble's Gender Functions v1.2.
//
// Actors and enemies carry a gender through a notetag:
//
//   <gender: none>        <gender: genderless>    -> 0
//   <gender: m>           <gender: male>          -> 1
//   <gender: f>           <gender: female>        -> 2
//
// (<sex: ...> is accepted too, exactly as in the original.)
//
// Monline's data has 123 of these tags, and 0167.rb (YEA Lunatic Parameters
// Package - Empower) reads `member.male?` / `member.female?` /
// `member.genderless?` for its "Gender Power" parameter effects, so this is a
// live mechanic rather than decoration.
//=============================================================================

/*:
 * @plugindesc Monline's gender system (0153.rb): <gender:> notetags,
 * male?/female?/genderless? and the event script calls that read them.
 * @author Monline MV port
 *
 * @param Default Actor Gender
 * @desc Gender used when an actor has no notetag. 0 genderless, 1 male, 2 female.
 * @default 0
 *
 * @param Default Enemy Gender
 * @desc Gender used when an enemy has no notetag. 0 genderless, 1 male, 2 female.
 * @default 0
 *
 * @help Gender is read from the Actor / Enemy notebox:
 *
 *   <gender: m>   male        (1)
 *   <gender: f>   female      (2)
 *   <gender: none>            (0)
 *
 * Battlers then answer:
 *   member.gender()      0 / 1 / 2
 *   member.male()        member.female()      member.genderless()
 *
 * Event script calls, as in the original:
 *   leader_male?              leader_female?            leader_genderless?
 *   party_member_male?(i)     party_member_female?(i)   party_member_genderless?(i)
 *   actor_male?(id)           actor_female?(id)         actor_genderless?(id)
 *   enemy_male?(id)           enemy_female?(id)         enemy_genderless?(id)
 *   troop_enemy_male?(i)      troop_enemy_female?(i)    troop_enemy_genderless?(i)
 *   battle_party_all_male?    battle_party_all_female?  battle_party_all_genderless?
 *
 * Variable operations:
 *   all_party_male_count      all_party_female_count    all_party_genderless_count
 *   battle_party_male_count   battle_party_female_count battle_party_genderless_count
 *   reserve_party_male_count  reserve_party_female_count reserve_party_genderless_count
 */

var MonlineGender = MonlineGender || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineGender');

    function toNumber(name, fallback) {
        var raw = String(parameters[name] || '').trim();
        var n = parseInt(raw, 10);
        return isNaN(n) ? fallback : n;
    }

    var CFG = {
        DEFAULT_ACTOR_GENDER: toNumber('Default Actor Gender', 0),
        DEFAULT_ENEMY_GENDER: toNumber('Default Enemy Gender', 0)
    };
    MonlineGender.CFG = CFG;

    MonlineGender.GENDERLESS = 0;
    MonlineGender.MALE = 1;
    MonlineGender.FEMALE = 2;

    // The original accepts <gender: ...> and <sex: ...>, case insensitively,
    // and lets the last matching line of the notebox win.
    var RX_NONE = /<(?:gender|sex):\s*(?:none|genderless)>/i;
    var RX_MALE = /<(?:gender|sex):\s*(?:m|male)>/i;
    var RX_FEMALE = /<(?:gender|sex):\s*(?:f|female)>/i;

    /** Read the gender off a database Actor / Enemy. Cached on the object. */
    MonlineGender.genderOf = function (obj, isActor) {
        if (!obj) { return CFG.DEFAULT_ACTOR_GENDER; }
        if (typeof obj.gender === 'number') { return obj.gender; }
        var g = isActor ? CFG.DEFAULT_ACTOR_GENDER
                        : CFG.DEFAULT_ENEMY_GENDER;
        var lines = String(obj.note || '').split(/[\r\n]+/);
        for (var i = 0; i < lines.length; i++) {
            if (RX_NONE.test(lines[i])) { g = 0; }
            else if (RX_MALE.test(lines[i])) { g = 1; }
            else if (RX_FEMALE.test(lines[i])) { g = 2; }
        }
        obj.gender = g;
        return g;
    };

    //-------------------------------------------------------------------------
    // Game_BattlerBase
    //-------------------------------------------------------------------------
    Game_BattlerBase.prototype.gender = function () {
        if (this.isActor && this.isActor()) {
            return MonlineGender.genderOf(this.actor(), true);
        }
        if (this.isEnemy && this.isEnemy()) {
            return MonlineGender.genderOf(this.enemy(), false);
        }
        return 0;
    };

    Game_BattlerBase.prototype.genderless = function () {
        return this.gender() === 0;
    };

    Game_BattlerBase.prototype.male = function () {
        return this.gender() === 1;
    };

    Game_BattlerBase.prototype.female = function () {
        return this.gender() === 2;
    };

    //-------------------------------------------------------------------------
    // The script calls
    //-------------------------------------------------------------------------
    function battlerGender(battler) {
        return battler ? battler.gender() : -1;
    }

    function memberAt(index) {
        var members = $gameParty.members();
        return members[index] || null;
    }

    var CALLS = {
        // party leader
        leader_genderless: function () {
            return battlerGender($gameParty.leader()) === 0;
        },
        leader_male: function () {
            return battlerGender($gameParty.leader()) === 1;
        },
        leader_female: function () {
            return battlerGender($gameParty.leader()) === 2;
        },
        // party member by position
        party_member_genderless: function (i) {
            return battlerGender(memberAt(i)) === 0;
        },
        party_member_male: function (i) {
            return battlerGender(memberAt(i)) === 1;
        },
        party_member_female: function (i) {
            return battlerGender(memberAt(i)) === 2;
        },
        // actor by database id
        actor_genderless: function (id) {
            return battlerGender($gameActors.actor(id)) === 0;
        },
        actor_male: function (id) {
            return battlerGender($gameActors.actor(id)) === 1;
        },
        actor_female: function (id) {
            return battlerGender($gameActors.actor(id)) === 2;
        },
        // enemy in the current troop
        troop_enemy_genderless: function (i) {
            if (!$gameParty.inBattle()) { return false; }
            return battlerGender($gameTroop.members()[i]) === 0;
        },
        troop_enemy_male: function (i) {
            if (!$gameParty.inBattle()) { return false; }
            return battlerGender($gameTroop.members()[i]) === 1;
        },
        troop_enemy_female: function (i) {
            if (!$gameParty.inBattle()) { return false; }
            return battlerGender($gameTroop.members()[i]) === 2;
        },
        // enemy by database id
        enemy_genderless: function (id) {
            return MonlineGender.genderOf($dataEnemies[id], false) === 0;
        },
        enemy_male: function (id) {
            return MonlineGender.genderOf($dataEnemies[id], false) === 1;
        },
        enemy_female: function (id) {
            return MonlineGender.genderOf($dataEnemies[id], false) === 2;
        }
    };

    // "all of the battle party are X" - the original compares against
    // max_battle_members, so a smaller party never counts as all-male.
    ['genderless', 'male', 'female'].forEach(function (kind) {
        CALLS['battle_party_all_' + kind] = function () {
            var want = { genderless: 0, male: 1, female: 2 }[kind];
            var count = 0;
            $gameParty.battleMembers().forEach(function (m) {
                if (m && m.gender() === want) { count++; }
            });
            return count === $gameParty.maxBattleMembers();
        };
    });

    // Counting calls (variable operations).
    function countIn(list, want) {
        var n = 0;
        if (!list) { return 0; }
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].gender() === want) { n++; }
        }
        return n;
    }

    ['genderless', 'male', 'female'].forEach(function (kind) {
        var want = { genderless: 0, male: 1, female: 2 }[kind];
        CALLS['all_party_' + kind + '_count'] = function () {
            return countIn($gameParty.allMembers(), want);
        };
        CALLS['battle_party_' + kind + '_count'] = function () {
            return countIn($gameParty.battleMembers(), want);
        };
        CALLS['reserve_party_' + kind + '_count'] = function () {
            return countIn($gameParty.allMembers(), want) -
                countIn($gameParty.battleMembers(), want);
        };
    });

    MonlineGender.CALLS = CALLS;

    // The original mixes these into Game_Interpreter; MV's ported script
    // blocks resolve bare names as globals, so publish them both ways.
    Object.keys(CALLS).forEach(function (name) {
        window[name] = CALLS[name];
        Game_Interpreter.prototype[name] = CALLS[name];
    });

    //-------------------------------------------------------------------------
    // Ruby syntax for the predicates
    //-------------------------------------------------------------------------
    // `leader_male?` and `member.male?` are legal Ruby but not legal
    // JavaScript, and an untranslated `?` kills the whole script block.
    // These two rules are deliberately name-based rather than a blanket
    // "strip every ?" so a ternary such as `a ? b : c` is never touched.
    if (window.MonlineRuby && typeof MonlineRuby.translate === 'function') {
        var PREDICATE_NAMES =
            '(?:leader|party_member|actor|enemy|troop_enemy|battle_party_all)' +
            '_(?:male|female|genderless)';
        var RX_CALL = new RegExp('\\b(' + PREDICATE_NAMES + ')\\?\\s*\\(', 'g');
        var RX_BARE = new RegExp('\\b(' + PREDICATE_NAMES + ')\\?(?!\\s*\\()', 'g');
        var RX_METHOD = /\.(male|female|genderless)\?/g;

        var _translate = MonlineRuby.translate;
        MonlineRuby.translate = function (src, options) {
            var out = _translate.call(this, src, options);
            if (typeof out !== 'string') { return out; }
            out = out.replace(RX_CALL, '$1(');
            out = out.replace(RX_BARE, '$1()');
            out = out.replace(RX_METHOD, '.$1()');
            return out;
        };
    }

    console.log('[MonlineGender] loaded');
}());
