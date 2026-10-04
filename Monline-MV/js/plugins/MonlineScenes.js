//=============================================================================
// MonlineScenes.js
//=============================================================================
/*:
 * @plugindesc VX Ace custom scenes ported to MV: crafting, skill learning, PXE menu.
 * @author Monline port
 *
 * @help
 * The event scripts call three scenes that MV does not have at all, which threw
 * `ReferenceError` the moment the player reached them:
 *
 *     SceneManager.call(Scene_Crafting)        // 11 references
 *     SceneManager.call(Scene_LearnSkill)      //  2 references
 *     SceneManager.call(Scene_PXEBestChoose)   //  1 reference
 *
 * A systematic scan of every script payload for Scene_ / Window_ / Sprite_
 * class names the project does not define produced exactly these three, so
 * these are all of them rather than the ones that happened to be hit first.
 * (Careful in here: a slash followed by a star inside a block comment ends it.)
 *
 * All three originals are **notetag driven**, so the data already carries
 * everything needed:
 *
 *   Crafting (0126 -> no: 0187.rb, Coelocanth's item crafting)
 *     <craft item:id> / <craft item:id:qty>      consume an item
 *     <craft weapon:id:qty> / <craft armor:id:qty>
 *     <craft gold:qty>                           gold price
 *     <craft switch:id>                          only craftable while ON
 *     <craft recipe:id>                          item holding the recipe
 *
 *   Learn Skill (0126.rb, YEA Learn Skill Engine)
 *     What can be learned comes from the CLASS:
 *       <learn skills: id,id,...>               repeated, every line adds more
 *     What it costs and what unlocks it comes from the SKILL:
 *       <learn cost: N jp> / <learn cost: N exp> / <learn cost: N gold>
 *       <learn require level: N>
 *       <learn require skill: id,id,...>
 *       <learn require switch: id,id,...>
 *
 *   PXE bestiary/encyclopedia menu (0148.rb)
 *     a six-entry command window routing to the other two, to the equip scene
 *     for actor 25, or to common event 82.
 */

var MonlineScenes = MonlineScenes || {};

(function() {
    'use strict';

    //-------------------------------------------------------------------------
    // Notetag parsing
    //-------------------------------------------------------------------------
    function noteOf(obj) {
        return (obj && obj.note) ? String(obj.note) : '';
    }

    /** One `<craft ...>` tag set.  `null` when the item has no crafting data. */
    MonlineScenes.parseCraft = function(obj) {
        var note = noteOf(obj);
        if (!note || !/<\s*craft\s/i.test(note)) { return null; }
        var out = { gold: 0, switchId: 0, recipeId: 0, ingredients: [], requirement: 0 };
        var rx = /<\s*craft\s+([a-z]+)\s*:?\s*([^>]*)>/gi;
        var m;
        while ((m = rx.exec(note)) !== null) {
            var kind = m[1].toLowerCase();
            var rest = String(m[2] || '').trim();
            if (kind === 'gold') {
                out.gold = parseInt(rest, 10) || 0;
            } else if (kind === 'switch') {
                out.switchId = parseInt(rest, 10) || 0;
            } else if (kind === 'recipe') {
                out.recipeId = parseInt(rest, 10) || 0;
            } else if (kind === 'item' || kind === 'weapon' || kind === 'armor') {
                var parts = rest.split(':');
                out.ingredients.push({
                    kind: kind,
                    id: parseInt(parts[0], 10) || 0,
                    qty: parseInt(parts[1] !== undefined ? parts[1] : 1, 10) || 1
                });
            }
        }
        return (out.gold > 0 || out.ingredients.length) ? out : null;
    };

    function craftAvailable(craft) {
        if (!craft) { return false; }
        if (craft.switchId && !$gameSwitches.value(craft.switchId)) { return false; }
        if (craft.recipeId && !$gameParty.hasItem($dataItems[craft.recipeId], false)) {
            return false;
        }
        return true;
    }
    MonlineScenes.craftAvailable = craftAvailable;

    function canAfford(craft) {
        if (!craft) { return false; }
        if (craft.gold > $gameParty.gold()) { return false; }
        for (var i = 0; i < craft.ingredients.length; i++) {
            var ing = craft.ingredients[i];
            var data = ing.kind === 'weapon' ? $dataWeapons[ing.id]
                     : ing.kind === 'armor' ? $dataArmors[ing.id]
                     : $dataItems[ing.id];
            if (!$gameParty.hasItem(data, false) ||
                (ing.kind === 'item' && $gameParty.numItems(data) < ing.qty)) {
                return false;
            }
        }
        return true;
    }
    MonlineScenes.canAfford = canAfford;

    MonlineScenes.craft = function(item) {
        var craft = MonlineScenes.parseCraft(item);
        if (!craft || !craftAvailable(craft) || !canAfford(craft)) { return false; }
        if (craft.gold > 0) { $gameParty.loseGold(craft.gold); }
        for (var i = 0; i < craft.ingredients.length; i++) {
            var ing = craft.ingredients[i];
            var data = ing.kind === 'weapon' ? $dataWeapons[ing.id]
                     : ing.kind === 'armor' ? $dataArmors[ing.id]
                     : $dataItems[ing.id];
            $gameParty.loseItem(data, ing.qty, false);
        }
        $gameParty.gainItem(item, 1);
        return true;
    };

    //-------------------------------------------------------------------------
    // Learn Skill - port of 0126.rb (YEA Learn Skill Engine)
    //
    // Two records drive everything:
    //   * the CLASS lists what the character is allowed to learn at all
    //     (`<learn skills: id,id,...>`, 0126.rb:187/303-315);
    //   * the SKILL lists the price and the prerequisites
    //     (`<learn cost:>`, `<learn require ...>`, 0126.rb:192-200/337-383).
    //
    // The list comes from the class's learn pool, NOT from `actor.skills()`:
    // `actor.skills()` is what is already learned, and since `enabled?` rejects
    // anything already learned (0126.rb:717) an inherited MV list is dead on
    // arrival - every row unselectable.  That was the "looks right, does
    // nothing" defect.
    //-------------------------------------------------------------------------

    // 0126.rb:85-155 (settings) and 0173.rb:137-138 (JP vocabulary and cap).
    MonlineScenes.LearnConfig = {
        COMMAND_NAME:      'Learn',
        SHOW_SWITCH:       0,
        STYPE_ORDER:       [1, 2, 3, 4, 5, 6, 9],
        DEFAULT_COST:      25,
        DEFAULT_TYPE:      'jp',
        EMPTY_TEXT:        '-',
        EXP_TEXT:          'EXP',
        JP_TEXT:           'SP',          // 0173.rb:137 - this game calls JP "SP"
        GOLD_TEXT:         'Gold Cost',
        LEARNED_TEXT:      'Known',
        LEARNED_SIZE:      20,
        COLOUR_JP:         24,
        COLOUR_EXP:        5,
        COLOUR_GOLD:       21,
        COST_SIZE:         20,
        MAXIMUM_ROWS:      8,
        GOLD_ICON:         361,
        LEARN_SKILL_TEXT:  'Learn %s?',
        LEARN_CANCEL_TEXT: 'Cancel',
        CANCEL_ICON:       112,
        MAX_JP:            99999999      // 0173.rb:138
    };

    // 0173.rb:10 sets `$imported["YEA-JPManager"] = true`, so this game DOES
    // ship the JP manager.  Two branches key off it and neither fires here:
    //   * 0126.rb:351 ignores a `<learn cost: N jp>` tag when it is missing;
    //   * 0126.rb:380 downgrades :jp to :exp when it is missing.
    // A jp cost therefore stays a jp cost - the earlier claim in this file that
    // "without YEA-JPManager the original downgrades jp costs to exp" was wrong
    // for this project and has been removed.
    MonlineScenes.JP_MANAGER = true;

    /**
     * Skill ids every `<learn skills: ...>` tag of a class contributes.
     * Mirrors 0126.rb:303-315: read all integers of every tag, keep ids > 0,
     * drop duplicates, keep first-seen order.  Memoised per class id and
     * invalidated whenever the note changes.
     *
     * @param {number} classId Id into `$dataClasses`.
     * @return {Array<number>} Skill ids, possibly empty.
     */
    var _classLearnCache = {};
    MonlineScenes.classLearnSkills = function(classId) {
        var cls = ($dataClasses || [])[classId] || null;
        if (!cls) { return []; }
        var note = noteOf(cls);
        var cached = _classLearnCache[classId];
        if (cached && cached.note === note) { return cached.ids.slice(); }
        // Same capture shape as 0126.rb:187 - only digit groups (optionally
        // comma separated) count, so `<learn skills: -3>` is not a tag at all.
        var rx = /<\s*learn\s+skills\s*:\s*(\d+(?:\s*,\s*\d+)*)\s*>/gi;
        var ids = [];
        var m;
        while ((m = rx.exec(note)) !== null) {
            var nums = String(m[1] || '').match(/\d+/g) || [];
            for (var i = 0; i < nums.length; i++) {
                var id = parseInt(nums[i], 10);
                if (id > 0 && ids.indexOf(id) < 0) { ids.push(id); }
            }
        }
        _classLearnCache[classId] = { note: note, ids: ids };
        return ids.slice();
    };

    /** Every digit group of a comma separated notetag argument, unique, > 0. */
    function idList(text) {
        var out = [];
        var nums = String(text || '').match(/\d+/g) || [];
        for (var i = 0; i < nums.length; i++) {
            var id = parseInt(nums[i], 10);
            if (id > 0 && out.indexOf(id) < 0) { out.push(id); }
        }
        return out;
    }

    /** First integer of a notetag argument, 0 when there is none. */
    function firstNumber(text) {
        var nums = String(text || '').match(/\d+/);
        return nums ? (parseInt(nums[0], 10) || 0) : 0;
    }

    /**
     * Price and prerequisites of one skill - 0126.rb:337-383.
     *
     * `requireSwitch` is the first switch id and survives because callers used
     * to read it; the arrays are what the original actually iterates.
     *
     * @return {{cost:number, type:string, requireLevel:number,
     *           requireSkills:Array<number>, requireSwitches:Array<number>,
     *           requireSwitch:number, requireEval:?string}}
     */
    MonlineScenes.parseLearn = function(skill) {
        var cfg = MonlineScenes.LearnConfig;
        var note = noteOf(skill);
        var out = {
            cost: cfg.DEFAULT_COST,
            type: cfg.DEFAULT_TYPE,
            requireLevel: 0,
            requireSkills: [],
            requireSwitches: [],
            requireSwitch: 0,
            requireEval: null
        };
        var m;
        var rxCost = /<\s*learn\s+cost\s*:\s*([^>]*)>/gi;
        while ((m = rxCost.exec(note)) !== null) {
            var arg = String(m[1] || '').toUpperCase();
            if (/JP/.test(arg)) {
                out.cost = firstNumber(arg) || 0;
                out.type = 'jp';
            } else if (/EXP/.test(arg)) {
                out.cost = firstNumber(arg) || 0;
                out.type = 'exp';
            } else if (/GOLD/.test(arg)) {
                out.cost = firstNumber(arg) || 0;
                out.type = 'gold';
            }
        }
        // 0126.rb:193-198 - same digit-only captures.
        var rxLevel = /<\s*learn\s+require\s+level\s*:\s*(\d+)\s*>/gi;
        while ((m = rxLevel.exec(note)) !== null) {
            out.requireLevel = parseInt(m[1], 10) || 0;
        }
        var rxSkill = /<\s*learn\s+require\s+skill\s*:\s*(\d+(?:\s*,\s*\d+)*)\s*>/gi;
        while ((m = rxSkill.exec(note)) !== null) {
            out.requireSkills = idList(m[1]);
        }
        var rxSwitch = /<\s*learn\s+require\s+switch\s*:\s*(\d+(?:\s*,\s*\d+)*)\s*>/gi;
        while ((m = rxSwitch.exec(note)) !== null) {
            out.requireSwitches = idList(m[1]);
        }
        // `<learn require eval>` (0126.rb:199-200) is deliberately NOT
        // evaluated.  Census of the converted database (Skills.json): 275 skills
        // carry a `<learn cost:>` tag, 227 carry a `<learn require ...>` tag,
        // and of those tags 225 are `switch`, 48 are `skill`, 0 are `level` and
        // 0 are `eval`.  There is nothing to run, and evaluating database text
        // would only add a way for one bad row to break the whole screen, so
        // the requirement stays null and meetsEvalRequirements answers true.
        out.requireSwitch = out.requireSwitches.length ? out.requireSwitches[0] : 0;
        return out;
    };

    /** Current class id of an actor, 0 before the actor has been set up. */
    MonlineScenes.currentClassId = function(actor) {
        return (actor && actor._classId) ? actor._classId : 0;
    };

    /**
     * Classes a skill may be paid from - 0126.rb:602-615.  Only the actor's own
     * class here: this game does not ship YEA-ClassSystem, so the
     * unlocked-class branch (0126.rb:620) does not exist.
     */
    MonlineScenes.skillClassIds = function(actor, skill) {
        if (!actor || !skill) { return []; }
        return [MonlineScenes.currentClassId(actor)];
    };

    function actorLevel(actor) {
        if (!actor) { return 0; }
        if (typeof actor.level === 'number') { return actor.level; }
        return actor._level || 0;
    }

    function switchValue(id) {
        return !!($gameSwitches && $gameSwitches.value(id));
    }

    /** 0126.rb:676-678. */
    MonlineScenes.meetsLevelRequirements = function(actor, skill) {
        var l = MonlineScenes.parseLearn(skill);
        return actorLevel(actor) >= l.requireLevel;
    };

    /** 0126.rb:683-689. */
    MonlineScenes.meetsSkillRequirements = function(actor, skill) {
        var l = MonlineScenes.parseLearn(skill);
        for (var i = 0; i < l.requireSkills.length; i++) {
            if (!actor.isLearnedSkill(l.requireSkills[i])) { return false; }
        }
        return true;
    };

    /** 0126.rb:694-699. */
    MonlineScenes.meetsSwitchRequirements = function(actor, skill) {
        var l = MonlineScenes.parseLearn(skill);
        for (var i = 0; i < l.requireSwitches.length; i++) {
            if (!switchValue(l.requireSwitches[i])) { return false; }
        }
        return true;
    };

    /** Always true: no `<learn require eval>` exists in this game's data. */
    MonlineScenes.meetsEvalRequirements = function(actor, skill) {
        return MonlineScenes.parseLearn(skill).requireEval === null;
    };

    /** 0126.rb:664-671 - all four checks have to pass to even be listed. */
    MonlineScenes.meetsRequirements = function(actor, skill) {
        if (!actor || !skill) { return false; }
        if (!MonlineScenes.meetsLevelRequirements(actor, skill)) { return false; }
        if (!MonlineScenes.meetsSkillRequirements(actor, skill)) { return false; }
        if (!MonlineScenes.meetsSwitchRequirements(actor, skill)) { return false; }
        if (!MonlineScenes.meetsEvalRequirements(actor, skill)) { return false; }
        return true;
    };

    /** 0126.rb:723-730 - any one class with enough JP unlocks the row. */
    MonlineScenes.enabledJp = function(actor, skill, classIds) {
        var l = MonlineScenes.parseLearn(skill);
        if (l.type !== 'jp') { return true; }
        for (var i = 0; i < classIds.length; i++) {
            if (actor.jp(classIds[i]) >= l.cost) { return true; }
        }
        return false;
    };

    /** Per-class EXP pool (0126.rb:413-416); MV keeps one too. */
    MonlineScenes.expClass = function(actor, classId) {
        if (!actor) { return 0; }
        if (!actor._exp) { actor._exp = {}; }
        if (actor._exp[classId] === undefined) { actor._exp[classId] = 0; }
        return actor._exp[classId];
    };

    /** 0126.rb:735-742 - same rule as JP, for per-class EXP. */
    MonlineScenes.enabledExp = function(actor, skill, classIds) {
        var l = MonlineScenes.parseLearn(skill);
        if (l.type !== 'exp') { return true; }
        for (var i = 0; i < classIds.length; i++) {
            if (MonlineScenes.expClass(actor, classIds[i]) >= l.cost) { return true; }
        }
        return false;
    };

    /** 0126.rb:747-751. */
    MonlineScenes.enabledGold = function(actor, skill) {
        var l = MonlineScenes.parseLearn(skill);
        if (l.type !== 'gold') { return true; }
        return ($gameParty && $gameParty.gold) ? $gameParty.gold() >= l.cost : false;
    };

    /** 0126.rb:712-718 - can pay *and* has not learned it yet. */
    MonlineScenes.enabledFor = function(actor, skill, classIds) {
        if (!actor || !skill) { return false; }
        if (!MonlineScenes.enabledJp(actor, skill, classIds)) { return false; }
        if (!MonlineScenes.enabledExp(actor, skill, classIds)) { return false; }
        if (!MonlineScenes.enabledGold(actor, skill)) { return false; }
        return !actor.isLearnedSkill(skill.id);
    };

    MonlineScenes.canLearn = function(actor, skill) {
        if (!actor || !skill || actor.isLearnedSkill(skill.id)) { return false; }
        if (!MonlineScenes.meetsRequirements(actor, skill)) { return false; }
        return MonlineScenes.enabledFor(actor, skill,
                                        MonlineScenes.skillClassIds(actor, skill));
    };

    /** 0126.rb:1351-1366 - teach the skill, then take the payment. */
    MonlineScenes.learnSkill = function(actor, skill, classId) {
        if (!MonlineScenes.canLearn(actor, skill)) { return false; }
        var l = MonlineScenes.parseLearn(skill);
        var cid = (classId === undefined || classId === null)
            ? MonlineScenes.currentClassId(actor) : classId;
        if (l.type === 'gold') {
            if ($gameParty && $gameParty.loseGold) { $gameParty.loseGold(l.cost); }
        } else if (l.type === 'jp') {
            actor.loseJp(l.cost, cid);
        } else {
            MonlineScenes.loseExpClass(actor, l.cost, cid);
        }
        actor.learnSkill(skill.id);
        return true;
    };

    /** 0126.rb:421-432 - EXP comes out of one class's private pool. */
    MonlineScenes.loseExpClass = function(actor, value, classId) {
        var amount = parseInt(value, 10) || 0;
        if (!actor) { return; }
        if (classId === actor._classId && actor.changeExp) {
            actor.changeExp(Math.max(0, (actor.currentExp() || 0) - amount), false);
            return;
        }
        if (!actor._exp) { actor._exp = {}; }
        actor._exp[classId] = Math.max(0,
            MonlineScenes.expClass(actor, classId) - amount);
    };

    /** 0126.rb:252-255 - switch 0 means the command is always visible. */
    MonlineScenes.learnCommandVisible = function() {
        var sw = MonlineScenes.LearnConfig.SHOW_SWITCH;
        if (sw <= 0) { return true; }
        return switchValue(sw);
    };

    //-------------------------------------------------------------------------
    // JP: the original keeps a per-class JP pool (YEA-JPManager,
    // 0173.rb:472-511), so `_jp` is an object keyed by class id.  Older builds
    // (and any save made with them) kept a plain number, so reading a number
    // migrates it onto the actor's current class instead of treating it as a
    // lookup table.
    //
    // Assigned unconditionally on purpose: MonlineShim.js loads first and
    // plants `Game_Actor.prototype.gain_jp` as an empty stub, and a guarded
    // assignment would leave that stub in place forever.
    //-------------------------------------------------------------------------
    Game_Actor.prototype.jpClassId = function() {
        return MonlineScenes.currentClassId(this);
    };

    Game_Actor.prototype.jpStorage = function() {
        if (typeof this._jp !== 'object' || this._jp === null) {
            var legacy = parseInt(this._jp, 10) || 0;
            this._jp = {};
            this._jp[this.jpClassId()] = legacy;
        }
        return this._jp;
    };

    Game_Actor.prototype.initJp = function() {
        this._jp = {};
        this._jp[this.jpClassId()] = 0;
    };

    Game_Actor.prototype.jp = function(classId) {
        var pool = this.jpStorage();
        var cid = (classId === undefined || classId === null) ? this.jpClassId()
                                                             : classId;
        var value = pool[cid];
        return typeof value === 'number' ? value : 0;
    };

    Game_Actor.prototype.gainJp = function(value, classId) {
        var pool = this.jpStorage();
        var cid = (classId === undefined || classId === null) ? this.jpClassId()
                                                             : classId;
        var total = (pool[cid] || 0) + (parseInt(value, 10) || 0);
        pool[cid] = Math.max(0, Math.min(total, MonlineScenes.LearnConfig.MAX_JP));
        return pool[cid];
    };

    Game_Actor.prototype.loseJp = function(value, classId) {
        return this.gainJp(-(parseInt(value, 10) || 0), classId);
    };

    // the Ruby names the event scripts use
    Game_Actor.prototype.gain_jp = function(value, classId) {
        return this.gainJp(value, classId);
    };
    Game_Actor.prototype.lose_jp = function(value, classId) {
        return this.loseJp(value, classId);
    };

    //-------------------------------------------------------------------------
    // Scene_Crafting
    //-------------------------------------------------------------------------
    function Scene_Crafting() { this.initialize.apply(this, arguments); }
    Scene_Crafting.prototype = Object.create(Scene_ItemBase.prototype);
    Scene_Crafting.prototype.constructor = Scene_Crafting;
    Scene_Crafting.prototype.initialize = function() {
        Scene_ItemBase.prototype.initialize.call(this);
    };
    Scene_Crafting.prototype.create = function() {
        Scene_ItemBase.prototype.create.call(this);
    };
    Scene_Crafting.prototype.createItemWindow = function() {
        var wy = this._categoryWindow.y + this._categoryWindow.height;
        var wh = Graphics.boxHeight - wy;
        this._itemWindow = new Window_CraftingList(0, wy, Graphics.boxWidth, wh);
        this._itemWindow.setHelpWindow(this._helpWindow);
        this._itemWindow.setHandler('ok', this.onItemOk.bind(this));
        this._itemWindow.setHandler('cancel', this.onItemCancel.bind(this));
        this.addWindow(this._itemWindow);
    };
    Scene_Crafting.prototype.onItemOk = function() {
        var item = this.item();
        if (!item) { return; }
        if (MonlineScenes.craft(item)) {
            SoundManager.playUseItem();
            this._itemWindow.refresh();
            this._itemWindow.activate();
        } else {
            SoundManager.playBuzzer();
            this._itemWindow.activate();
        }
    };
    MonlineScenes.Scene_Crafting = Scene_Crafting;

    function Window_CraftingList() { this.initialize.apply(this, arguments); }
    Window_CraftingList.prototype = Object.create(Window_ItemList.prototype);
    Window_CraftingList.prototype.constructor = Window_CraftingList;
    Window_CraftingList.prototype.includes = function(item) {
        if (!Window_ItemList.prototype.includes.call(this, item)) { return false; }
        return !!craftAvailable(MonlineScenes.parseCraft(item));
    };
    Window_CraftingList.prototype.isEnabled = function(item) {
        return canAfford(MonlineScenes.parseCraft(item));
    };
    MonlineScenes.Window_CraftingList = Window_CraftingList;

    //-------------------------------------------------------------------------
    // Scene_LearnSkill
    //-------------------------------------------------------------------------
    function Scene_LearnSkill() { this.initialize.apply(this, arguments); }
    Scene_LearnSkill.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_LearnSkill.prototype.constructor = Scene_LearnSkill;
    Scene_LearnSkill.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_LearnSkill.prototype.create = function() {
        // Scene_MenuBase#create itself runs updateActor(), so once this returns
        // Scene_MenuBase#actor() already answers with the party's menu subject
        // (Game_Party#menuActor falls back to members()[0]).
        Scene_MenuBase.prototype.create.call(this);
        this.createHelpWindow();
        this.createCommandWindow();
        this.createSkillWindow();
        this.createCostWindow();
        // 0126.rb:1324/1367-1376 - the command window pushes the selected skill
        // type onto the list every frame, so it needs both links in place
        // before the first update runs.
        this._commandWindow.setSkillWindow(this._skillWindow);
        this._commandWindow.setActor(this.actor());
        this._skillWindow.setActor(this.actor());
    };
    Scene_LearnSkill.prototype.createCommandWindow = function() {
        var wy = this._helpWindow.height;
        this._commandWindow = new Window_LearnSkillCommand(0, wy);
        this._commandWindow.setHelpWindow(this._helpWindow);
        this._commandWindow.setHandler('skill', this.commandLearnType.bind(this));
        this._commandWindow.setHandler('ok', this.commandLearnType.bind(this));
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._commandWindow);
    };
    Scene_LearnSkill.prototype.createSkillWindow = function() {
        var wy = this._commandWindow.y + this._commandWindow.height;
        var wh = Graphics.boxHeight - wy;
        this._skillWindow = new Window_LearnSkillList(0, wy, Graphics.boxWidth, wh);
        this._skillWindow.setHelpWindow(this._helpWindow);
        this._skillWindow.setHandler('ok', this.onSkillOk.bind(this));
        this._skillWindow.setHandler('cancel', this.onSkillCancel.bind(this));
        this.addWindow(this._skillWindow);
    };
    Scene_LearnSkill.prototype.createCostWindow = function() {
        var wy = this._skillWindow.y + 8;
        this._costWindow = new Window_LearnSkillCost(Graphics.boxWidth - 320, wy);
        this._costWindow.setHandler('learn', this.onCostOk.bind(this));
        this._costWindow.setHandler('ok', this.onCostOk.bind(this));
        this._costWindow.setHandler('cancel', this.onCostCancel.bind(this));
        this.addWindow(this._costWindow);
        this._costWindow.close();
        this._costWindow.deactivate();
    };
    Scene_LearnSkill.prototype.commandLearnType = function() {
        this._skillWindow.activate();
        this._skillWindow.selectLast();
    };
    Scene_LearnSkill.prototype.onSkillOk = function() {
        var skill = this._skillWindow.item();
        if (!skill) { return; }
        this._skillWindow.deactivate();
        this._costWindow.reveal(skill, this._skillWindow.skillClasses(skill),
                                this.actor());
    };
    Scene_LearnSkill.prototype.onSkillCancel = function() {
        this._skillWindow.deselect();
        this._commandWindow.activate();
    };
    Scene_LearnSkill.prototype.onCostOk = function() {
        var skill = this._costWindow.skill();
        if (!skill) { return; }
        if (MonlineScenes.learnSkill(this.actor(), skill,
                                     this._costWindow.skillClass())) {
            SoundManager.playUseSkill();
        } else {
            SoundManager.playBuzzer();
        }
        this.onCostCancel();
        this._skillWindow.refresh();
    };
    Scene_LearnSkill.prototype.onCostCancel = function() {
        this._costWindow.deactivate();
        this._costWindow.close();
        this._skillWindow.activate();
    };
    MonlineScenes.Scene_LearnSkill = Scene_LearnSkill;

    //-------------------------------------------------------------------------
    // Window_LearnSkillList - what the current class offers, 0126.rb:578-763
    //-------------------------------------------------------------------------
    function Window_LearnSkillList() { this.initialize.apply(this, arguments); }
    Window_LearnSkillList.prototype = Object.create(Window_SkillList.prototype);
    Window_LearnSkillList.prototype.constructor = Window_LearnSkillList;

    Window_LearnSkillList.prototype.initialize = function(x, y, width, height) {
        Window_SkillList.prototype.initialize.call(this, x, y, width, height);
        this._learnSkills = [];
        this._skillClasses = {};
    };

    Window_LearnSkillList.prototype.maxCols = function() {
        return 1;
    };

    Window_LearnSkillList.prototype.selectLast = function() {
        this.select(0);
    };

    /**
     * MV's own setActor rebuilds from `actor.skills()` (already learned), which
     * is what made every row dead here.  0126.rb:593-597 builds the pool from
     * the class notetags first, so do that, then the same reselect the base
     * class would have performed.
     */
    Window_LearnSkillList.prototype.setActor = function(actor) {
        if (this._actor === actor) { return; }
        this._actor = actor;
        this.makeLearnSkillsList();
        this.refresh();
        this.resetScroll();
        this.selectLast();
    };

    /** 0126.rb:602-615 - every `<learn skills:>` id of the actor's class. */
    Window_LearnSkillList.prototype.makeLearnSkillsList = function() {
        this._learnSkills = [];
        this._skillClasses = {};
        if (!this._actor) { return; }
        var classId = MonlineScenes.currentClassId(this._actor);
        var ids = MonlineScenes.classLearnSkills(classId);
        for (var i = 0; i < ids.length; i++) {
            var skill = ($dataSkills || [])[ids[i]] || null;
            if (!skill) { continue; }
            if (this._learnSkills.indexOf(skill) >= 0) { continue; }
            this._learnSkills.push(skill);
            this._skillClasses[skill.id] = [classId];
        }
    };

    /** 0126.rb:647-650 - the class pool minus what should not be shown. */
    Window_LearnSkillList.prototype.makeItemList = function() {
        this._data = (this._learnSkills || []).filter(function(skill) {
            return this.includes(skill);
        }, this);
    };

    /** 0126.rb:655-659 - prerequisites plus the selected skill type. */
    Window_LearnSkillList.prototype.includes = function(item) {
        if (!item || !this._actor) { return false; }
        if (!MonlineScenes.meetsRequirements(this._actor, item)) { return false; }
        return item.stypeId === this._stypeId;
    };

    Window_LearnSkillList.prototype.isEnabled = function(item) {
        if (!item || !this._actor) { return false; }
        return MonlineScenes.enabledFor(this._actor, item, this.skillClasses(item));
    };

    /** 0126.rb:640-642 - classes this skill can be paid from. */
    Window_LearnSkillList.prototype.skillClasses = function(skill) {
        if (!skill || !this._skillClasses) { return []; }
        return this._skillClasses[skill.id] || [];
    };

    /**
     * MV spells this `isLearnedSkill` (Game_Actor, rpg_objects.js:3964); there
     * is no `isLearned`.  Kept under a distinct name of its own so nothing
     * confuses it with the actor method it wraps.
     */
    Window_LearnSkillList.prototype.knowsSkill = function(skill) {
        return this._actor && skill
            ? this._actor.isLearnedSkill(skill.id) : false;
    };

    Window_LearnSkillList.prototype.drawItem = function(index) {
        var skill = this._data[index];
        if (!skill) { return; }
        var rect = this.itemRect(index);
        rect.width -= this.textPadding();
        this.changePaintOpacity(this.isEnabled(skill));
        var costWidth = this.costWidth();
        this.drawItemName(skill, rect.x, rect.y, rect.width - costWidth);
        this.drawLearnCost(skill, rect);
        this.changePaintOpacity(1);
    };

    /** 0126.rb:839-907 - either "Known" or the price, coloured by type. */
    Window_LearnSkillList.prototype.drawLearnCost = function(skill, rect) {
        var cfg = MonlineScenes.LearnConfig;
        if (this.knowsSkill(skill)) {
            this.contents.fontSize = cfg.LEARNED_SIZE;
            this.changeTextColor(this.normalColor());
            this.drawText(cfg.LEARNED_TEXT, rect.x, rect.y, rect.width, 'right');
            this.resetFontSettings();
            return;
        }
        var l = MonlineScenes.parseLearn(skill);
        var suffix = l.type === 'jp' ? cfg.JP_TEXT
                   : l.type === 'exp' ? cfg.EXP_TEXT
                   : cfg.GOLD_TEXT;
        var colour = l.type === 'jp' ? cfg.COLOUR_JP
                   : l.type === 'exp' ? cfg.COLOUR_EXP
                   : cfg.COLOUR_GOLD;
        this.contents.fontSize = cfg.COST_SIZE;
        this.changeTextColor(this.systemColor());
        this.drawText(suffix, rect.x, rect.y, rect.width, 'right');
        var suffixWidth = this.textWidth(suffix) + this.textPadding();
        this.changeTextColor(this.textColor(colour));
        this.drawText(String(l.cost), rect.x, rect.y,
                      rect.width - suffixWidth, 'right');
        this.resetFontSettings();
    };

    MonlineScenes.Window_LearnSkillList = Window_LearnSkillList;

    //-------------------------------------------------------------------------
    // Window_LearnSkillCommand - the skill-type column, 0126.rb:467-570
    //-------------------------------------------------------------------------
    function Window_LearnSkillCommand() { this.initialize.apply(this, arguments); }
    Window_LearnSkillCommand.prototype = Object.create(Window_Command.prototype);
    Window_LearnSkillCommand.prototype.constructor = Window_LearnSkillCommand;

    Window_LearnSkillCommand.prototype.initialize = function(x, y) {
        Window_Command.prototype.initialize.call(this, x, y);
        this._actor = null;
        this._skillWindow = null;
    };

    Window_LearnSkillCommand.prototype.windowWidth = function() {
        return 160;
    };

    Window_LearnSkillCommand.prototype.numVisibleRows = function() {
        return 4;
    };

    Window_LearnSkillCommand.prototype.setActor = function(actor) {
        if (this._actor === actor) { return; }
        this._actor = actor;
        this.refresh();
        this.select(0);
    };

    Window_LearnSkillCommand.prototype.setSkillWindow = function(skillWindow) {
        this._skillWindow = skillWindow;
    };

    Window_LearnSkillCommand.prototype.makeCommandList = function() {
        if (!this._actor) { return; }
        var order = MonlineScenes.LearnConfig.STYPE_ORDER;
        var names = ($dataSystem && $dataSystem.skillTypes)
            ? $dataSystem.skillTypes : [];
        for (var i = 0; i < order.length; i++) {
            var stypeId = order[i];
            if (!this.includes(stypeId)) { continue; }
            if (!names[stypeId]) { continue; }
            this.addCommand(names[stypeId], 'skill', true, stypeId);
        }
    };

    /** 0126.rb:548-554 - no ClassSystem here, so added skill types decide. */
    Window_LearnSkillCommand.prototype.includes = function(stypeId) {
        if (!this._actor || !this._actor.addedSkillTypes) { return false; }
        return this._actor.addedSkillTypes().indexOf(stypeId) >= 0;
    };

    Window_LearnSkillCommand.prototype.update = function() {
        Window_Command.prototype.update.call(this);
        if (this._skillWindow) {
            this._skillWindow.setStypeId(this.currentExt());
        }
    };

    MonlineScenes.Window_LearnSkillCommand = Window_LearnSkillCommand;

    //-------------------------------------------------------------------------
    // Window_LearnSkillCost - the confirm step, 0126.rb:147-153/1330-1346
    //-------------------------------------------------------------------------
    function Window_LearnSkillCost() { this.initialize.apply(this, arguments); }
    Window_LearnSkillCost.prototype = Object.create(Window_Command.prototype);
    Window_LearnSkillCost.prototype.constructor = Window_LearnSkillCost;

    Window_LearnSkillCost.prototype.initialize = function(x, y) {
        Window_Command.prototype.initialize.call(this, x, y);
        this._skill = null;
        this._classIds = [];
        this._classId = 0;
    };

    Window_LearnSkillCost.prototype.windowWidth = function() {
        return 320;
    };

    Window_LearnSkillCost.prototype.numVisibleRows = function() {
        return 2;
    };

    Window_LearnSkillCost.prototype.reveal = function(skill, classIds, actor) {
        this._skill = skill || null;
        this._classIds = (classIds && classIds.length)
            ? classIds.slice()
            : MonlineScenes.skillClassIds(actor, skill);
        this._classId = this._classIds.length
            ? this._classIds[0] : MonlineScenes.currentClassId(actor);
        this.refresh();
        this.select(0);
        this.open();
        this.activate();
    };

    Window_LearnSkillCost.prototype.skill = function() {
        return this._skill;
    };

    /** The class the payment comes out of (0126.rb:1358). */
    Window_LearnSkillCost.prototype.skillClass = function() {
        return this._classId;
    };

    Window_LearnSkillCost.prototype.makeCommandList = function() {
        if (!this._skill) { return; }
        var cfg = MonlineScenes.LearnConfig;
        this.addCommand(cfg.LEARN_SKILL_TEXT.replace('%s', this._skill.name),
                        'learn', true);
        this.addCommand(cfg.LEARN_CANCEL_TEXT, 'cancel', true);
    };

    Window_LearnSkillCost.prototype.drawItem = function(index) {
        Window_Command.prototype.drawItem.call(this, index);
        if (index !== 0 || !this._skill) { return; }
        var cfg = MonlineScenes.LearnConfig;
        var l = MonlineScenes.parseLearn(this._skill);
        var unit = l.type === 'jp' ? cfg.JP_TEXT
                 : l.type === 'exp' ? cfg.EXP_TEXT
                 : cfg.GOLD_TEXT;
        var text = l.cost + ' ' + unit;
        var rect = this.itemRectForText(0);
        this.contents.fontSize = cfg.COST_SIZE;
        this.changeTextColor(this.systemColor());
        this.drawText(text, rect.x, rect.y, rect.width -
                      this.textWidth(this.commandName(0)) - this.textPadding(),
                      'right');
        this.resetFontSettings();
    };

    MonlineScenes.Window_LearnSkillCost = Window_LearnSkillCost;

    //-------------------------------------------------------------------------
    // "Learn" entry point in MV's own skill menu, 0126.rb:440-461/1275-1277
    //-------------------------------------------------------------------------
    var _skillTypeMakeCommandList = Window_SkillType.prototype.makeCommandList;
    Window_SkillType.prototype.makeCommandList = function() {
        _skillTypeMakeCommandList.call(this);
        if (!this._actor) { return; }
        this.addLearnSkillCommand();
    };
    Window_SkillType.prototype.addLearnSkillCommand = function() {
        if (!MonlineScenes.learnCommandVisible()) { return; }
        this.addCommand(MonlineScenes.LearnConfig.COMMAND_NAME, 'learnskill', true);
    };

    var _sceneSkillCreateSkillTypeWindow =
        Scene_Skill.prototype.createSkillTypeWindow;
    Scene_Skill.prototype.createSkillTypeWindow = function() {
        _sceneSkillCreateSkillTypeWindow.call(this);
        this._skillTypeWindow.setHandler('learnskill',
                                         this.commandLearnSkill.bind(this));
    };
    Scene_Skill.prototype.commandLearnSkill = function() {
        SceneManager.push(Scene_LearnSkill);
    };

    //-------------------------------------------------------------------------
    // Scene_PXEBestChoose
    //-------------------------------------------------------------------------
    function Scene_PXEBestChoose() { this.initialize.apply(this, arguments); }
    Scene_PXEBestChoose.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_PXEBestChoose.prototype.constructor = Scene_PXEBestChoose;
    Scene_PXEBestChoose.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };
    // 0148.rb:27 - `create_background` tints the menu backdrop down.
    Scene_PXEBestChoose.prototype.createBackground = function() {
        Scene_MenuBase.prototype.createBackground.call(this);
        if (this._backgroundSprite) {
            this._backgroundSprite.setColorTone([0, 0, 0, 128]);
        }
    };

    // 0148.rb:13 - the command window is built in `start`, not `create`.
    Scene_PXEBestChoose.prototype.start = function() {
        Scene_MenuBase.prototype.start.call(this);
        this._commandWindow = new Window_PXEBestiary(202, 168);
        this._commandWindow.setHandler('to_pedia', this.commandToPedia.bind(this));
        this._commandWindow.setHandler('to_bestiary', this.commandToBestiary.bind(this));
        this._commandWindow.setHandler('to_pxeshop', this.commandToShop.bind(this));
        this._commandWindow.setHandler('to_pxelearn', this.commandToLearn.bind(this));
        this._commandWindow.setHandler('to_pxeequip', this.commandToEquip.bind(this));
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._commandWindow);
    };

    // 0148.rb:20 - `pre_terminate` closes the window and blocks until it has
    // finished closing, so the scene never fades out over an open window.
    Scene_PXEBestChoose.prototype.terminate = function() {
        if (this._commandWindow) { this._commandWindow.close(); }
        Scene_MenuBase.prototype.terminate.call(this);
    };

    function pxeActor() {
        return $gameActors.actor(25);
    }

    // 0148.rb:55 - the PXEpedia entry really does open the encyclopedia now
    // that 0146.rb is ported (MonlineEncyclopedia.js).
    Scene_PXEBestChoose.prototype.commandToPedia = function() {
        SceneManager.push(Encyclopedia);
    };
    Scene_PXEBestChoose.prototype.commandToBestiary = function() {
        SceneManager.push(Scene_MonsterCatalogue);
    };
    // 0148.rb:69 - VX Ace's `SceneManager.call(Scene_Map)` pushes a fresh map
    // scene; MV's `goto` replaces it.  Popping back to the map that called this
    // scene is what the player sees either way.
    Scene_PXEBestChoose.prototype.commandToShop = function() {
        SceneManager.pop();
        $gameTemp.reserveCommonEvent(82);
        if (!SceneManager.isCurrentScene(Scene_Map)) { SceneManager.goto(Scene_Map); }
    };
    Scene_PXEBestChoose.prototype.commandToLearn = function() {
        $gameParty.setMenuActor(pxeActor());
        SceneManager.push(Scene_LearnSkill);
    };
    Scene_PXEBestChoose.prototype.commandToEquip = function() {
        $gameParty.setMenuActor(pxeActor());
        SceneManager.push(Scene_Equip);
    };
    MonlineScenes.Scene_PXEBestChoose = Scene_PXEBestChoose;

    function Window_PXEBestiary() { this.initialize.apply(this, arguments); }
    Window_PXEBestiary.prototype = Object.create(Window_Command.prototype);
    Window_PXEBestiary.prototype.constructor = Window_PXEBestiary;
    Window_PXEBestiary.prototype.makeCommandList = function() {
        this.addCommand('PXEpedia', 'to_pedia');
        this.addCommand('Bestiary', 'to_bestiary');
        var a = pxeActor();
        if ($gameSwitches.value(280)) {
            this.addCommand('Functions', 'to_pxelearn');
            if (a && a.isLearnedSkill(758)) { this.addCommand('Augment', 'to_pxeequip'); }
            if (a && a.isLearnedSkill(752)) { this.addCommand('PXE Shop', 'to_pxeshop'); }
        }
        this.addCommand('Return', 'cancel');
    };
    MonlineScenes.Window_PXEBestiary = Window_PXEBestiary;

    //-------------------------------------------------------------------------
    // Scene_MonsterCatalogue used to live here as a name-only stand-in.  The
    // real 0147.rb port is MonlineMonsterCatalogue.js, which loads later and
    // publishes both `Scene_MonsterCatalogue` and its four windows; the
    // encyclopedia half of that stand-in is MonlineEncyclopedia.js.  Nothing
    // is declared here any more - two definitions of the same class is exactly
    // how a port ends up "looking right" while running the wrong code.
    //
    //-------------------------------------------------------------------------
    // Publish every scene on window: `SceneManager.call(Scene_Crafting)` inside a
    // translated Ruby script resolves the name through the bridge's scope
    // proxy, i.e. `window[name]`.  A `function` declared inside this closure is
    // not a global, so without these the call still throws ReferenceError.
    //-------------------------------------------------------------------------
    window.Scene_Crafting = Scene_Crafting;
    window.Scene_LearnSkill = Scene_LearnSkill;
    window.Scene_PXEBestChoose = Scene_PXEBestChoose;
    window.Window_CraftingList = Window_CraftingList;
    window.Window_LearnSkillList = Window_LearnSkillList;
    window.Window_LearnSkillCommand = Window_LearnSkillCommand;
    window.Window_LearnSkillCost = Window_LearnSkillCost;
    window.Window_PXEBestiary = Window_PXEBestiary;
    // Scene_MonsterCatalogue / Encyclopedia are published by their own full
    // ports (MonlineMonsterCatalogue.js, MonlineEncyclopedia.js), which load
    // after this file.  Re-exporting the stand-ins here would win the race in
    // the wrong order if this file ever moved below them.
})();
