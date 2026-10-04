//=============================================================================
// MonlineLoadout.js
//-----------------------------------------------------------------------------
// Port of VX Ace 0149.rb / 0150.rb (Scene_Loadout) plus the two extra equip
// commands that open them (0060.rb Window_EquipCommand, 0098.rb Scene_Equip).
//
// Monline lets the player park three full gear sets and swap between them:
//   * the equip screen's command row gains "Save" and "Load"
//   * Save  -> chose Slot 1 / 2 / 3 / Cancel, and the actor's five equipment
//              ids are copied into a variable
//   * Load  -> the same menu, and the ids are put back on the actor
//
// Storage, exactly as in the original:
//   variable 204 / 205 / 206   the three loadouts, each [0,0,0,0,0]
//   variable 207               the actor being dressed; reset to 0 when done
//
// Loadouts survive in the save file because they live in variables.
//=============================================================================

/*:
 * @plugindesc Monline's gear loadouts (0149/0150.rb): save and load three
 * equipment sets from the equip screen.
 * @author Monline MV port
 *
 * @param Loadout Variables
 * @desc Variable ids holding the three saved loadouts, comma separated.
 * @default 204, 205, 206
 *
 * @param Actor Variable
 * @desc Variable holding the actor id while a loadout screen is open.
 * @default 207
 *
 * @param Equip Slot Count
 * @desc How many equipment slots a loadout stores.
 * @default 5
 *
 * @param Window X
 * @desc X coordinate of the loadout command window.
 * @default 202
 *
 * @param Window Y
 * @desc Y coordinate of the loadout command window.
 * @default 168
 *
 * @param Background Opacity
 * @desc How dark the map behind the loadout window is (VX Ace used tone 128).
 * @default 128
 *
 * @param Save Command Text
 * @desc Label of the equip screen command that opens the save-loadout menu.
 * @default Save
 *
 * @param Load Command Text
 * @desc Label of the equip screen command that opens the load-loadout menu.
 * @default Load
 *
 * @help Adds two commands to the equip screen's command row (making five, as
 * in the original, so the row is Equip / Optimize / Clear / Save / Load):
 *
 *   Save  - stores the actor's current equipment into one of three slots
 *   Load  - puts a stored set back on, with the equip sound
 *
 * A Load slot that was never written to is greyed out, because the original
 * would have crashed on it.
 *
 * Plugin commands:
 *   Loadout save <slot> [actorId]   store the actor's gear (slot 1-3)
 *   Loadout load <slot> [actorId]   restore it
 *   Loadout open save|load          open the menu screen itself
 */

var MonlineLoadout = MonlineLoadout || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineLoadout');

    function toNumber(name, fallback) {
        var raw = String(parameters[name] || '').trim();
        var n = parseInt(raw, 10);
        return isNaN(n) ? fallback : n;
    }

    var CFG = {
        SLOT_VARS: String(parameters['Loadout Variables'] || '204, 205, 206')
            .split(',').map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return n > 0; }),
        ACTOR_VAR: toNumber('Actor Variable', 207),
        SLOT_COUNT: toNumber('Equip Slot Count', 5),
        WIN_X: toNumber('Window X', 202),
        WIN_Y: toNumber('Window Y', 168),
        BG_OPACITY: toNumber('Background Opacity', 128),
        SAVE_TEXT: String(parameters['Save Command Text'] || 'Save'),
        LOAD_TEXT: String(parameters['Load Command Text'] || 'Load')
    };
    MonlineLoadout.CFG = CFG;

    //-------------------------------------------------------------------------
    // The loadout data itself
    //-------------------------------------------------------------------------
    function emptyLoadout() {
        var ids = [];
        for (var i = 0; i < CFG.SLOT_COUNT; i++) { ids.push(0); }
        return ids;
    }

    /** Which actor the open loadout screen is dressing. */
    MonlineLoadout.currentActor = function () {
        var id = CFG.ACTOR_VAR > 0 ? $gameVariables.value(CFG.ACTOR_VAR) : 0;
        var actor = id > 0 ? $gameActors.actor(id) : null;
        if (actor) { return actor; }
        return $gameParty.menuActor() || $gameParty.leader();
    };

    /** Read a stored loadout, or null when that slot was never written to. */
    MonlineLoadout.savedLoadout = function (slot) {
        var varId = CFG.SLOT_VARS[slot];
        if (!varId) { return null; }
        var value = $gameVariables.value(varId);
        return Array.isArray(value) ? value : null;
    };

    /** Copy an actor's equipment ids into a slot. */
    MonlineLoadout.saveLoadout = function (actor, slot) {
        var varId = CFG.SLOT_VARS[slot];
        if (!actor || !varId) { return false; }
        var ids = emptyLoadout();
        var equips = actor.equips();
        for (var i = 0; i < CFG.SLOT_COUNT; i++) {
            var item = equips ? equips[i] : null;
            ids[i] = item ? item.id : 0;
        }
        $gameVariables.setValue(varId, ids);
        return true;
    };

    /** Put a stored set back on an actor. */
    MonlineLoadout.loadLoadout = function (actor, slot) {
        var ids = MonlineLoadout.savedLoadout(slot);
        if (!actor || !ids) { return false; }
        SoundManager.playEquip();
        for (var i = 0; i < CFG.SLOT_COUNT; i++) {
            // VX Ace indexed equipment by slot; MV indexes it by equip type.
            // MonlineRubyBridge adds changeEquipBySlot for the Ace numbering,
            // which is what the event data (and the original) speaks.
            if (typeof actor.changeEquipBySlot === 'function') {
                actor.changeEquipBySlot(i, ids[i] || 0);
            } else {
                actor.changeEquipById(i + 1, ids[i] || 0);
            }
        }
        return true;
    };

    MonlineLoadout.clearActorVariable = function () {
        if (CFG.ACTOR_VAR > 0) { $gameVariables.setValue(CFG.ACTOR_VAR, 0); }
    };

    //-------------------------------------------------------------------------
    // Window_SLoadout / Window_LLoadout
    //-------------------------------------------------------------------------
    // Give a constructor built this way the VX Ace class name, so error
    // messages and SceneManager diagnostics read Scene_SaveLoadout rather
    // than a shared placeholder.
    function nameIt(fn, name) {
        Object.defineProperty(fn, 'name', { value: name, configurable: true });
        return fn;
    }

    function makeCommandWindowClass(name, makeList) {
        function Window_Loadout() { this.initialize.apply(this, arguments); }
        nameIt(Window_Loadout, name);
        Window_Loadout.prototype = Object.create(Window_Command.prototype);
        Window_Loadout.prototype.constructor = Window_Loadout;
        Window_Loadout.prototype.initialize = function (x, y) {
            Window_Command.prototype.initialize.call(this, x, y);
        };
        Window_Loadout.prototype.makeCommandList = function () {
            makeList.call(this);
        };
        return Window_Loadout;
    }

    var Window_SLoadout = makeCommandWindowClass('Window_SLoadout', function () {
        for (var i = 0; i < CFG.SLOT_VARS.length; i++) {
            this.addCommand('Slot ' + (i + 1), 'SLoadout' + (i + 1));
        }
        this.addCommand('Cancel', 'cancel');
    });

    // A slot that was never written to cannot be loaded - the original would
    // have read nil[0] and blown up.
    var Window_LLoadout = makeCommandWindowClass('Window_LLoadout', function () {
        for (var i = 0; i < CFG.SLOT_VARS.length; i++) {
            this.addCommand('Slot ' + (i + 1), 'LLoadout' + (i + 1),
                !!MonlineLoadout.savedLoadout(i));
        }
        this.addCommand('Cancel', 'cancel');
    });

    MonlineLoadout.Window_SLoadout = Window_SLoadout;
    MonlineLoadout.Window_LLoadout = Window_LLoadout;
    window.Window_SLoadout = Window_SLoadout;
    window.Window_LLoadout = Window_LLoadout;

    //-------------------------------------------------------------------------
    // Scene_SaveLoadout / Scene_LoadLoadout
    //-------------------------------------------------------------------------
    function makeLoadoutScene(name, WindowClass, symbolPrefix, applySlot) {
        function Scene_Loadout() { this.initialize.apply(this, arguments); }
        nameIt(Scene_Loadout, name);
        Scene_Loadout.prototype = Object.create(Scene_MenuBase.prototype);
        Scene_Loadout.prototype.constructor = Scene_Loadout;

        Scene_Loadout.prototype.initialize = function () {
            Scene_MenuBase.prototype.initialize.call(this);
        };

        Scene_Loadout.prototype.create = function () {
            Scene_MenuBase.prototype.create.call(this);
            // VX Ace dims the frozen map with tone (0, 0, 0, 128); MV does
            // the same thing with sprite opacity.
            this.setBackgroundOpacity(CFG.BG_OPACITY);
            this.createCommandWindow();
        };

        Scene_Loadout.prototype.createCommandWindow = function () {
            var win = new WindowClass(CFG.WIN_X, CFG.WIN_Y);
            for (var i = 0; i < CFG.SLOT_VARS.length; i++) {
                win.setHandler(symbolPrefix + (i + 1),
                    this.commandSlot.bind(this, i));
            }
            win.setHandler('cancel', this.popScene.bind(this));
            this.addWindow(win);
            this._commandWindow = win;
        };

        Scene_Loadout.prototype.commandSlot = function (slot) {
            var actor = MonlineLoadout.currentActor();
            if (actor) { applySlot.call(this, actor, slot); }
            MonlineLoadout.clearActorVariable();
            this.popScene();
        };

        return Scene_Loadout;
    }

    var Scene_SaveLoadout = makeLoadoutScene('Scene_SaveLoadout',
        Window_SLoadout, 'SLoadout',
        function (actor, slot) { MonlineLoadout.saveLoadout(actor, slot); });

    var Scene_LoadLoadout = makeLoadoutScene('Scene_LoadLoadout',
        Window_LLoadout, 'LLoadout',
        function (actor, slot) { MonlineLoadout.loadLoadout(actor, slot); });

    MonlineLoadout.Scene_SaveLoadout = Scene_SaveLoadout;
    MonlineLoadout.Scene_LoadLoadout = Scene_LoadLoadout;
    window.Scene_SaveLoadout = Scene_SaveLoadout;
    window.Scene_LoadLoadout = Scene_LoadLoadout;

    //-------------------------------------------------------------------------
    // The equip screen gains Save / Load (0060.rb, 0098.rb)
    //-------------------------------------------------------------------------
    var _Window_EquipCommand_makeCommandList =
        Window_EquipCommand.prototype.makeCommandList;
    Window_EquipCommand.prototype.makeCommandList = function () {
        _Window_EquipCommand_makeCommandList.call(this);
        this.addCommand(CFG.SAVE_TEXT, 'Saveout');
        this.addCommand(CFG.LOAD_TEXT, 'Loadout');
    };

    // The original lays the five commands out on one line (col_max = 5).
    Window_EquipCommand.prototype.maxCols = function () {
        return 5;
    };

    var _Scene_Equip_createCommandWindow =
        Scene_Equip.prototype.createCommandWindow;
    Scene_Equip.prototype.createCommandWindow = function () {
        _Scene_Equip_createCommandWindow.call(this);
        var actor = this.actor();
        var enabled = !!actor;
        this._commandWindow.setHandler('Saveout',
            this.commandSaveout.bind(this));
        this._commandWindow.setHandler('Loadout',
            this.commandLoadout.bind(this));
        if (!enabled) {
            this._commandWindow._list.forEach(function (c) {
                if (c.symbol === 'Saveout' || c.symbol === 'Loadout') {
                    c.enabled = false;
                }
            });
        }
    };

    Scene_Equip.prototype.commandSaveout = function () {
        var actor = this.actor();
        if (!actor) { return; }
        if (CFG.ACTOR_VAR > 0) {
            $gameVariables.setValue(CFG.ACTOR_VAR, actor.actorId());
        }
        SceneManager.push(Scene_SaveLoadout);
    };

    Scene_Equip.prototype.commandLoadout = function () {
        var actor = this.actor();
        if (!actor) { return; }
        if (CFG.ACTOR_VAR > 0) {
            $gameVariables.setValue(CFG.ACTOR_VAR, actor.actorId());
        }
        SceneManager.push(Scene_LoadLoadout);
    };

    //-------------------------------------------------------------------------
    // Plugin commands
    //-------------------------------------------------------------------------
    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (String(command).toLowerCase() !== 'loadout') { return; }
        var what = String(args[0] || '').toLowerCase();
        if (what === 'open') {
            var which = String(args[1] || 'save').toLowerCase();
            var actor = $gameParty.menuActor() || $gameParty.leader();
            if (actor && CFG.ACTOR_VAR > 0) {
                $gameVariables.setValue(CFG.ACTOR_VAR, actor.actorId());
            }
            SceneManager.push(which === 'load' ? Scene_LoadLoadout
                                               : Scene_SaveLoadout);
            return;
        }
        var slot = parseInt(args[1], 10) - 1;
        if (isNaN(slot) || slot < 0) { return; }
        var targetActor = $gameActors.actor(parseInt(args[2], 10)) ||
            ($gameParty.menuActor() || $gameParty.leader());
        if (what === 'save') { MonlineLoadout.saveLoadout(targetActor, slot); }
        else if (what === 'load') {
            MonlineLoadout.loadLoadout(targetActor, slot);
        }
    };

    console.log('[MonlineLoadout] loaded');
}());
