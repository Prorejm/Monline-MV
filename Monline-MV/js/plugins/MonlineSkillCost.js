//=============================================================================
// MonlineSkillCost.js
// Port of _vxace_scripts/0127.rb - "Yanfly Engine Ace - Skill Cost Manager"
// v1.03 (plus the two lines it borrows from 0110.rb's Numeric#group).
//=============================================================================
/*:
 * @plugindesc YEA Skill Cost Manager: HP / MP / TP(AD) / gold / custom skill
 * costs, read from the skill notetags and drawn the way Monline draws them.
 * @author Monline port (from 0127.rb)
 *
 * @help
 * VX Ace could only charge MP or TP.  Monline charges HP, gold and an
 * arbitrary "custom cost" as well, and it prints every cost it finds in the
 * skill list column, right-aligned and colour-coded:
 *
 *   <hp cost: 30%>          HP cost, a share of MaxHP
 *   <mp cost: 20%>          MP cost, a share of MaxMP (added to the base cost)
 *   <gold cost: x>          gold, taken from the party purse
 *   <custom cost: text>     free-form label
 *   <custom cost icon: n>   icon drawn before that label
 *   <custom cost requirement>  ...ruby...  </custom cost requirement>
 *   <custom cost perform>      ...ruby...  </custom cost perform>
 *
 * The last two are real Ruby: `custom_cost_requirement` gates the skill and
 * `custom_cost_perform` runs when it is paid.  Monline uses them for its
 * "Charge" resource - `$game_variables[6] >= 1` / `$game_variables[6] -= 1` -
 * and they are translated through MonlineRuby so they behave like the rest of
 * the ported event scripts.
 *
 * Without this plugin the skill list would only ever show one number (MV's
 * default `Window_SkillList#drawSkillCost` draws TP *or* MP, never both, and
 * knows nothing about HP / gold / custom costs at all).
 */
var MonlineSkillCost = MonlineSkillCost || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // YEA::SKILL_COST - 0127.rb:203, verbatim.  Note the suffixes: Monline
    // renamed TP to "AD", so the TP cost reads "12AD", not "12TP".
    //-------------------------------------------------------------------------
    var CFG = {
        HP_COST_COLOUR: 21, HP_COST_SIZE: 20, HP_COST_SUFFIX: '%sHP',
        HP_COST_ICON: 0,
        MP_COST_COLOUR: 23, MP_COST_SIZE: 20, MP_COST_SUFFIX: '%sMP',
        MP_COST_ICON: 0,
        TP_COST_COLOUR: 2, TP_COST_SIZE: 20, TP_COST_SUFFIX: '%sAD',
        TP_COST_ICON: 0,
        GOLD_COST_COLOUR: 6, GOLD_COST_SIZE: 20, GOLD_COST_SUFFIX: '%sGold',
        GOLD_COST_ICON: 0
    };

    // 0110.rb:186 - YEA::CORE::GROUP_DIGITS, which is what Numeric#group
    // (0110.rb:299) keys off.  It inserts thousands separators.
    var GROUP_DIGITS = true;

    //-------------------------------------------------------------------------
    // YEA::REGEXP - 0127.rb:265, verbatim (Ruby /i -> JS 'i').
    //-------------------------------------------------------------------------
    var RX_BASE = {
        HP_COST_RATE: /<(?:HP_COST_RATE|hp cost rate):[ ](\d+)([%％])>/i,
        TP_COST_RATE: /<(?:TP_COST_RATE|tp cost rate):[ ](\d+)([%％])>/i,
        GOLD_COST_RATE: /<(?:GOLD_COST_RATE|gold cost rate):[ ](\d+)([%％])>/i
    };
    var RX_SKILL = {
        HP_COST_SET: /<(?:HP_COST|hp cost):[ ](\d+)>/i,
        HP_COST_PER: /<(?:HP_COST|hp cost):[ ](\d+)([%％])>/i,
        MP_COST_SET: /<(?:MP_COST|mp cost):[ ](\d+)>/i,
        MP_COST_PER: /<(?:MP_COST|mp cost):[ ](\d+)([%％])>/i,
        TP_COST_SET: /<(?:TP_COST|tp cost):[ ](\d+)>/i,
        TP_COST_PER: /<(?:TP_COST|tp cost):[ ](\d+)([%％])>/i,
        GOLD_COST_SET: /<(?:GOLD_COST|gold cost):[ ](\d+)>/i,
        GOLD_COST_PER: /<(?:GOLD_COST|gold cost):[ ](\d+)([%％])>/i,

        CUSTOM_COST_TEXT: /<(?:CUSTOM_COST|custom cost):[ ](.*)>/i,
        CUSTOM_COST_COLOUR:
            /<(?:CUSTOM_COST_COLOUR|custom cost colour|custom cost color):[ ](\d+)>/i,
        CUSTOM_COST_SIZE: /<(?:CUSTOM_COST_SIZE|custom cost size):[ ](\d+)>/i,
        CUSTOM_COST_ICON: /<(?:CUSTOM_COST_ICON|custom cost icon):[ ](\d+)>/i,
        CUSTOM_COST_REQUIREMENT_ON:
            /<(?:CUSTOM_COST_REQUIREMENT|custom cost requirement)>/i,
        CUSTOM_COST_REQUIREMENT_OFF:
            /<\/(?:CUSTOM_COST_REQUIREMENT|custom cost requirement)>/i,
        CUSTOM_COST_PERFORM_ON:
            /<(?:CUSTOM_COST_PERFORM|custom cost perform)>/i,
        CUSTOM_COST_PERFORM_OFF:
            /<\/(?:CUSTOM_COST_PERFORM|custom cost perform)>/i,

        // 0127.rb:311 - HP_COST_MAX really does test for `HP_COST_MIN` in its
        // first alternative.  It is a Yanfly typo, but with /i the two halves
        // still cover `<HP_COST_MIN: n>` and `<hp cost max: n>` separately, so
        // the bug is invisible in play.  Kept as written.
        HP_COST_MIN: /<(?:HP_COST_MIN|hp cost min):[ ](\d+)>/i,
        HP_COST_MAX: /<(?:HP_COST_MIN|hp cost max):[ ](\d+)>/i,
        MP_COST_MIN: /<(?:MP_COST_MIN|mp cost min):[ ](\d+)>/i,
        MP_COST_MAX: /<(?:MP_COST_MIN|mp cost max):[ ](\d+)>/i,
        TP_COST_MIN: /<(?:TP_COST_MIN|tp cost min):[ ](\d+)>/i,
        TP_COST_MAX: /<(?:TP_COST_MIN|tp cost max):[ ](\d+)>/i,
        GOLD_COST_MIN: /<(?:GOLD_COST_MIN|gold cost min):[ ](\d+)>/i,
        GOLD_COST_MAX: /<(?:GOLD_COST_MIN|gold cost max):[ ](\d+)>/i
    };

    //-------------------------------------------------------------------------
    // Notetag cache.  816 skills, and `drawSkillCost` runs for every visible
    // row on every refresh, so this is read once per skill and stored on the
    // object itself (non-enumerable, so save data is untouched).
    //-------------------------------------------------------------------------
    function baseRates(obj) {
        if (!obj) { return { hp: 1, tp: 1, gold: 1 }; }
        if (obj._scmRates) { return obj._scmRates; }
        var r = { hp: 1.0, tp: 1.0, gold: 1.0 };
        var note = obj.note || '';
        note.split(/[\r\n]+/).forEach(function (line) {
            var m;
            if ((m = line.match(RX_BASE.TP_COST_RATE))) { r.tp = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_BASE.HP_COST_RATE))) { r.hp = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_BASE.GOLD_COST_RATE))) { r.gold = parseInt(m[1], 10) * 0.01; }
        });
        Object.defineProperty(obj, '_scmRates', { value: r, configurable: true });
        return r;
    }

    function info(skill) {
        if (!skill) { return null; }
        if (skill._scm) { return skill._scm; }
        var d = {
            hpCost: 0, goldCost: 0,
            hpCostPercent: 0, mpCostPercent: 0, tpCostPercent: 0, goldCostPercent: 0,
            customCostText: '0', customCostColour: 0, customCostSize: 20,
            customCostIcon: 0, customCostRequirement: '', customCostPerform: '',
            useCustomCost: false
        };
        var reqOn = false, perOn = false;
        var note = skill.note || '';
        note.split(/[\r\n]+/).forEach(function (line) {
            var m;
            // `case/when` order matters, exactly as in the Ruby
            if ((m = line.match(RX_SKILL.MP_COST_SET))) { d.mpCost = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.MP_COST_PER))) { d.mpCostPercent = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_SKILL.TP_COST_SET))) { d.tpCost = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.TP_COST_PER))) { d.tpCostPercent = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_SKILL.HP_COST_SET))) { d.hpCost = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.HP_COST_PER))) { d.hpCostPercent = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_SKILL.GOLD_COST_SET))) { d.goldCost = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.GOLD_COST_PER))) { d.goldCostPercent = parseInt(m[1], 10) * 0.01; }
            else if ((m = line.match(RX_SKILL.HP_COST_MIN))) { d.hpCostMin = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.HP_COST_MAX))) { d.hpCostMax = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.MP_COST_MIN))) { d.mpCostMin = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.MP_COST_MAX))) { d.mpCostMax = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.TP_COST_MIN))) { d.tpCostMin = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.TP_COST_MAX))) { d.tpCostMax = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.GOLD_COST_MIN))) { d.goldCostMin = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.GOLD_COST_MAX))) { d.goldCostMax = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.CUSTOM_COST_TEXT))) { d.customCostText = m[1]; }
            else if ((m = line.match(RX_SKILL.CUSTOM_COST_COLOUR))) { d.customCostColour = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.CUSTOM_COST_SIZE))) { d.customCostSize = parseInt(m[1], 10); }
            else if ((m = line.match(RX_SKILL.CUSTOM_COST_ICON))) { d.customCostIcon = parseInt(m[1], 10); }
            else if (RX_SKILL.CUSTOM_COST_REQUIREMENT_ON.test(line)) { reqOn = true; d.useCustomCost = true; }
            else if (RX_SKILL.CUSTOM_COST_REQUIREMENT_OFF.test(line)) { reqOn = false; d.useCustomCost = true; }
            else if (RX_SKILL.CUSTOM_COST_PERFORM_ON.test(line)) { perOn = true; d.useCustomCost = true; }
            else if (RX_SKILL.CUSTOM_COST_PERFORM_OFF.test(line)) { perOn = false; d.useCustomCost = true; }
            else {
                // 0127.rb:530 - plain `+=`, so a multi-line block would come
                // out glued together.  Faithful to the Ruby; Monline's 83
                // custom-cost skills are all single-line, so it never bites.
                if (reqOn) { d.customCostRequirement += line; }
                if (perOn) { d.customCostPerform += line; }
            }
        });
        Object.defineProperty(skill, '_scm', { value: d, configurable: true });
        return d;
    }

    //-------------------------------------------------------------------------
    // Numeric#group (0110.rb:299) - thousands separators.
    //-------------------------------------------------------------------------
    function group(n) {
        var s = String(n);
        if (!GROUP_DIGITS) { return s; }
        // Ruby's `(\d)(?=\d{3}+(?:\.|$))(\d{3}\..*)?` - the `\d{3}+` is a
        // *possessive* quantifier, which JS has no syntax for.  `{3}` is an
        // exact count, so possessive and greedy are indistinguishable here and
        // the plain `{3}` reproduces the Ruby result exactly.
        return s.replace(/(\d)(?=\d{3}(?:\.|$))(\d{3}\..*)?/g, '$1,$2');
    }

    /** `sprintf('%sMP', 12)` - the only format used by this script. */
    function suffix(fmt, value) {
        return fmt.replace(/%s/, String(value));
    }

    //-------------------------------------------------------------------------
    // Custom-cost Ruby -> JS.  Monline's two shapes are
    //   $game_variables[6] >= 1     (requirement)
    //   $game_variables[6] -= 1     (perform)
    //-------------------------------------------------------------------------
    function translateRuby(src) {
        var MR = window.MonlineRuby;
        var js = (MR && typeof MR.translate === 'function') ? MR.translate(src) : src;
        // belt and braces: if the bridge ever leaves the Ruby spelling alone,
        // rewrite it to MV's own variable store
        if (js.indexOf('$game_variables') >= 0) {
            js = js.replace(/\$game_variables\s*\[\s*(\d+)\s*\]/g,
                            '$gameVariables._data[$1]');
        }
        if (js.indexOf('$game_switches') >= 0) {
            js = js.replace(/\$game_switches\s*\[\s*(\d+)\s*\]/g,
                            '$gameSwitches._data[$1]');
        }
        return js;
    }

    function runRuby(src, battler) {
        if (!src) { return undefined; }
        var js = translateRuby(src);
        try {
            var body = (js.indexOf('\n') >= 0) ? js : ('return (' + js + ');');
            var fn = new Function('self', 'a', body);
            return fn.call(battler, battler, battler);
        } catch (e) {
            console.warn('[MonlineSkillCost] custom cost script failed: ' +
                         (e && e.message) + '\n  ruby: ' + src);
            return undefined;
        }
    }

    //-------------------------------------------------------------------------
    // Game_BattlerBase - 0127.rb:551
    //-------------------------------------------------------------------------
    function rate(self, field) {
        var n = 1.0;
        var i, list;
        if (self.isActor()) {
            n *= baseRates(self.actor())[field];
            n *= baseRates(self.currentClass())[field];
            list = self.equips();
            for (i = 0; i < list.length; i++) {
                if (list[i]) { n *= baseRates(list[i])[field]; }
            }
        } else {
            n *= baseRates(self.enemy())[field];
        }
        list = self.states();
        for (i = 0; i < list.length; i++) {
            if (list[i]) { n *= baseRates(list[i])[field]; }
        }
        return n;
    }

    /** 0127.rb:626 - TP cost rate. */
    Game_BattlerBase.prototype.scmTcr = function () { return rate(this, 'tp'); };
    /** 0127.rb:662 - HP cost rate. */
    Game_BattlerBase.prototype.scmHcr = function () { return rate(this, 'hp'); };
    /** 0127.rb:698 - gold cost rate. */
    Game_BattlerBase.prototype.scmGcr = function () { return rate(this, 'gold'); };

    function clampCost(n, lo, hi) {
        if (hi !== undefined) { n = Math.min(Math.floor(n), hi); }
        if (lo !== undefined) { n = Math.max(Math.floor(n), lo); }
        return Math.floor(n);
    }

    var _skillMpCost = Game_BattlerBase.prototype.skillMpCost;
    Game_BattlerBase.prototype.skillMpCost = function (skill) {
        var n = _skillMpCost.call(this, skill);
        var d = info(skill);
        if (d) {
            n += d.mpCostPercent * this.mmp * this.mcr;
            n = clampCost(n, d.mpCostMin, d.mpCostMax);
        }
        return n;
    };

    var _skillTpCost = Game_BattlerBase.prototype.skillTpCost;
    Game_BattlerBase.prototype.skillTpCost = function (skill) {
        var d = info(skill);
        var tcr = this.scmTcr();
        var n = _skillTpCost.call(this, skill) * tcr;
        if (d) {
            n += d.tpCostPercent * this.maxTp() * tcr;
            n = clampCost(n, d.tpCostMin, d.tpCostMax);
        }
        return n;
    };

    /** 0127.rb:651 */
    Game_BattlerBase.prototype.skillHpCost = function (skill) {
        var d = info(skill);
        if (!d) { return 0; }
        var hcr = this.scmHcr();
        var n = d.hpCost * hcr + d.hpCostPercent * this.mhp * hcr;
        return clampCost(n, d.hpCostMin, d.hpCostMax);
    };

    /** 0127.rb:687 */
    Game_BattlerBase.prototype.skillGoldCost = function (skill) {
        var d = info(skill);
        if (!d) { return 0; }
        var gcr = this.scmGcr();
        var n = d.goldCost * gcr + d.goldCostPercent * $gameParty.gold() * gcr;
        return clampCost(n, d.goldCostMin, d.goldCostMax);
    };

    /** 0127.rb:567 */
    Game_BattlerBase.prototype.scmGoldCostMet = function (skill) {
        if (!this.isActor()) { return true; }
        return $gameParty.gold() >= this.skillGoldCost(skill);
    };

    /** 0127.rb:575 */
    Game_BattlerBase.prototype.scmCustomCostMet = function (skill) {
        var d = info(skill);
        if (!d || !d.useCustomCost) { return true; }
        return !!runRuby(d.customCostRequirement, this);
    };

    /** 0127.rb:594 */
    Game_BattlerBase.prototype.payCustomCost = function (skill) {
        var d = info(skill);
        if (!d || !d.useCustomCost) { return; }
        runRuby(d.customCostPerform, this);
    };

    var _canPaySkillCost = Game_BattlerBase.prototype.canPaySkillCost;
    Game_BattlerBase.prototype.canPaySkillCost = function (skill) {
        if (this.hp <= this.skillHpCost(skill)) { return false; }
        if (!this.scmGoldCostMet(skill)) { return false; }
        if (!this.scmCustomCostMet(skill)) { return false; }
        return _canPaySkillCost.call(this, skill);
    };

    var _paySkillCost = Game_BattlerBase.prototype.paySkillCost;
    Game_BattlerBase.prototype.paySkillCost = function (skill) {
        _paySkillCost.call(this, skill);
        this.setHp(this.hp - this.skillHpCost(skill));
        if (this.isActor()) { $gameParty.loseGold(this.skillGoldCost(skill)); }
        this.payCustomCost(skill);
    };

    //-------------------------------------------------------------------------
    // Window_Base - 0127.rb:719.  MV's own mpCostColor is already 23; the
    // interesting one is tpCostColor, which MV defaults to 29 and Monline
    // sets to 2.
    //-------------------------------------------------------------------------
    Window_Base.prototype.mpCostColor = function () { return this.textColor(CFG.MP_COST_COLOUR); };
    Window_Base.prototype.tpCostColor = function () { return this.textColor(CFG.TP_COST_COLOUR); };
    Window_Base.prototype.hpCostColor = function () { return this.textColor(CFG.HP_COST_COLOUR); };
    Window_Base.prototype.goldCostColor = function () { return this.textColor(CFG.GOLD_COST_COLOUR); };

    //-------------------------------------------------------------------------
    // Window_SkillList - 0127.rb:735
    //
    // MV hands drawSkillCost `(skill, x, y, width)`; the Ruby hands it
    // `(rect, skill)` and *shrinks* the rect after every cost so the costs
    // stack right-to-left.  Same idea, MV's signature.
    //-------------------------------------------------------------------------
    function drawOne(win, rect, skill, cost, colour, size, icon, text) {
        if (!(cost > 0)) { return; }
        win.changeTextColor(colour);
        win.changePaintOpacity(win.isEnabled(skill));
        if (icon > 0) {
            win.drawIcon(icon, rect.x + rect.width - 24, rect.y);
            rect.width -= 24;
        }
        win.contents.fontSize = size;
        win.drawText(text, rect.x, rect.y, rect.width, 'right');
        rect.width -= win.textWidth(text) + 4;
        win.resetFontSettings();
    }

    Window_SkillList.prototype.drawSkillCost = function (skill, x, y, width) {
        if (!skill) { return; }
        var rect = { x: x, y: y, width: width };
        var d = info(skill) || {};
        // 0127.rb:740 - with the Ace Battle Engine installed the order is
        // MP, TP, HP, gold, custom.  0111.rb sets $imported["YEA-BattleEngine"].
        drawOne(this, rect, skill, this._actor.skillMpCost(skill),
                this.mpCostColor(), CFG.MP_COST_SIZE, CFG.MP_COST_ICON,
                suffix(CFG.MP_COST_SUFFIX, group(this._actor.skillMpCost(skill))));
        drawOne(this, rect, skill, this._actor.skillTpCost(skill),
                this.tpCostColor(), CFG.TP_COST_SIZE, CFG.TP_COST_ICON,
                suffix(CFG.TP_COST_SUFFIX, group(this._actor.skillTpCost(skill))));
        drawOne(this, rect, skill, this._actor.skillHpCost(skill),
                this.hpCostColor(), CFG.HP_COST_SIZE, CFG.HP_COST_ICON,
                suffix(CFG.HP_COST_SUFFIX, group(this._actor.skillHpCost(skill))));
        drawOne(this, rect, skill, this._actor.skillGoldCost(skill),
                this.goldCostColor(), CFG.GOLD_COST_SIZE, CFG.GOLD_COST_ICON,
                suffix(CFG.GOLD_COST_SUFFIX, group(this._actor.skillGoldCost(skill))));
        if (d.useCustomCost) {
            this.changeTextColor(this.textColor(d.customCostColour));
            this.changePaintOpacity(this.isEnabled(skill));
            if (d.customCostIcon > 0) {
                this.drawIcon(d.customCostIcon, rect.x + rect.width - 24, rect.y);
                rect.width -= 24;
            }
            this.contents.fontSize = d.customCostSize;
            this.drawText(d.customCostText, rect.x, rect.y, rect.width, 'right');
            rect.width -= this.textWidth(d.customCostText) + 4;
            this.resetFontSettings();
        }
        this.changePaintOpacity(true);
    };

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    MonlineSkillCost.CFG = CFG;
    MonlineSkillCost.info = info;
    MonlineSkillCost.baseRates = baseRates;
    MonlineSkillCost.group = group;
    MonlineSkillCost.translateRuby = translateRuby;
    window.MonlineSkillCost = MonlineSkillCost;

    console.log('[MonlineSkillCost] loaded');
})();
