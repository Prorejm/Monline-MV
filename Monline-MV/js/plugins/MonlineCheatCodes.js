//=============================================================================
// MonlineCheatCodes.js
// Port of _vxace_scripts/0263.rb - "Cheat Code Engine by Riff".
//=============================================================================
/*:
 * @plugindesc Cheat code engine (0263.rb): a "Cheats" entry on the title
 * screen that opens a code input scene and applies the codes on New Game /
 * Continue.
 * @author Monline port (from 0263.rb)
 *
 * @help
 * Monline ships 18 codes.  They are typed in on the title screen under
 * "Cheats" and take effect on the *next* New Game or loaded save - which is
 * why `CheatCode_Interpreter` runs from both `command_new_game` and
 * `Scene_Load#on_load_success`.
 *
 *   SKIP1..SKIP9   start the game at the beginning of a later zone
 *   IDDQD          God Mode (variable 99 = 99)
 *   IDCHOPPERS     Chainsaw added
 *   Zelda          Green Tunic added
 *   Rosebud        1000G added
 *   Kenkou         Arena / PXEPedia completed (a block of 79 switches)
 *   Arena          Arena unlocked
 *
 * The SKIP* and IDDQD codes are "stage codes": they also call
 * `set_starting_map`, which restarts the game on map 238 immediately instead
 * of waiting for New Game to be pressed.
 *
 * The encyclopedia's own "Cheat Codes" topic (0146.rb) documents this screen,
 * so without the port the game describes a feature it does not have.
 */
var MonlineCheatCodes = MonlineCheatCodes || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // RIFF::CHEAT - 0263.rb:437, verbatim.
    //-------------------------------------------------------------------------
    var RIFF = {
        CHEAT: {
            CODE_LENGTH: 10,
            CODESCENE_BUTTON: 'Cheats'
        }
    };

    // 0263.rb:445 - `CODES[:code] = [:name, :instructions...]`.  The :code key
    // is a template the author left in the hash; it is not a real code, so it
    // is kept but excluded from the lookup.
    var CODES = {
        'SKIP1': ['Intro Skip', 'set_variable(99, 1)', 'set_starting_map(238, 8, 6)'],
        'SKIP2': ['Forest Skip', 'set_variable(99, 2)', 'set_starting_map(238, 8, 6)'],
        'SKIP3': ['Coastal Skip', 'set_variable(99, 3)', 'set_starting_map(238, 8, 6)'],
        'SKIP4': ['Demon Skip', 'set_variable(99, 4)', 'set_starting_map(238, 8, 6)'],
        'SKIP5': ['Desolate Skip', 'set_variable(99, 5)', 'set_starting_map(238, 8, 6)'],
        'SKIP6': ['Desert Skip', 'set_variable(99, 6)', 'set_starting_map(238, 8, 6)'],
        'SKIP7': ['Desert Skip 2', 'set_variable(99, 7)', 'set_starting_map(238, 8, 6)'],
        'SKIP8': ['Desert Skip 3', 'set_variable(99, 8)', 'set_starting_map(238, 8, 6)'],
        'SKIP9': ['Mythic Skip', 'set_variable(99, 9)', 'set_starting_map(238, 8, 6)'],
        'IDDQD': ['God Mode', 'set_variable(99, 99)', 'set_starting_map(238, 8, 6)'],
        'IDCHOPPERS': ['Chainsaw Added', 'add_weapons(31)'],
        'Zelda': ['Green Tunic Added', 'add_armors(57)'],
        'Rosebud': ['1000G Added', 'add_gold(1000)'],
        'Kenkou': ['Arena/PXEPedia Completed',
            'turn_switches(101, 102, 103, 104, 105, 106, 107, 108, 109, 110, ' +
            '111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, ' +
            '124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, ' +
            '137, 138, 139, 140, 141, 142, 143, 145, 146, 147, 148, 149, 150, ' +
            '151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, ' +
            '164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, ' +
            '177, 178, 179, 180)'],
        'Arena': ['Arena Unlocked', 'turn_switches(46)']
    };
    var CODE_TEMPLATE = ['name', 'instructions1', 'instructions2'];

    // `$cheat_code` in the Ruby - the codes waiting to be applied.
    var pending = [];
    MonlineCheatCodes.pending = pending;

    //-------------------------------------------------------------------------
    // Instruction plumbing.
    //
    // 0263.rb builds instructions as strings and `eval`s them twice: once
    // against the Cheat_Code (where each helper just appends another string)
    // and once against the CheatCode_Interpreter (where they do the work).
    // Rather than eval, the string is parsed into a name plus arguments and
    // dispatched onto whichever object is the current "self".  Same two-stage
    // behaviour, no eval of database text.
    //-------------------------------------------------------------------------
    function splitArgs(body) {
        var args = [], depth = 0, buf = '';
        for (var i = 0; i < body.length; i++) {
            var c = body.charAt(i);
            if (c === '[' || c === '(') { depth++; buf += c; continue; }
            if (c === ']' || c === ')') { depth--; buf += c; continue; }
            if (c === ',' && depth === 0) { args.push(buf); buf = ''; continue; }
            buf += c;
        }
        if (buf.replace(/\s/g, '')) { args.push(buf); }
        return args.map(function (a) {
            a = a.trim();
            if (!a) { return undefined; }
            if (a.charAt(0) === '[') {
                try { return JSON.parse(a.replace(/'/g, '"')); } catch (e) { return []; }
            }
            if (/^-?\d+$/.test(a)) { return parseInt(a, 10); }
            if (/^-?\d+\.\d+$/.test(a)) { return parseFloat(a); }
            return a.replace(/^["']|["']$/g, '');
        });
    }

    function runOn(self, src) {
        var m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/.exec(String(src));
        if (!m) { return false; }
        var fn = self[m[1]];
        if (typeof fn !== 'function') {
            // 0263.rb:604 - `begin eval rescue next end`: an instruction the
            // receiver does not implement is skipped, not fatal.
            return false;
        }
        fn.apply(self, splitArgs(m[2]));
        return true;
    }

    /** Ruby's `"#{args}"` for an array - `[31]`, not `31`. */
    function rubyArgs(args) {
        return '[' + args.map(function (a) {
            return Array.isArray(a) ? rubyArgs(a) : String(a);
        }).join(', ') + ']';
    }

    //-------------------------------------------------------------------------
    // Cheat_Code - 0263.rb:496
    //-------------------------------------------------------------------------
    function Cheat_Code(name, instructions) {
        this.name = name;
        this.stageCode = false;
        this.instructions = [];
        var self = this;
        (instructions || []).forEach(function (i) { runOn(self, i); });
    }
    Cheat_Code.prototype.delete = function (instruction) {
        var i = this.instructions.indexOf(instruction);
        if (i >= 0) { this.instructions.splice(i, 1); }
    };
    Cheat_Code.prototype.add_gold = function (value) {
        this.instructions.push('add_gold(' + value + ')');
    };
    Cheat_Code.prototype.add_armors = function () {
        this.instructions.push('add_armors(' + rubyArgs([].slice.call(arguments)) + ')');
    };
    Cheat_Code.prototype.add_weapons = function () {
        this.instructions.push('add_weapons(' + rubyArgs([].slice.call(arguments)) + ')');
    };
    Cheat_Code.prototype.add_items = function () {
        this.instructions.push('add_items(' + rubyArgs([].slice.call(arguments)) + ')');
    };
    Cheat_Code.prototype.turn_switches = function () {
        this.instructions.push('turn_switches(' + rubyArgs([].slice.call(arguments)) + ')');
    };
    Cheat_Code.prototype.set_variable = function (variableId, value) {
        this.instructions.push('set_variable(' + variableId + ', ' + value + ')');
    };
    Cheat_Code.prototype.add_states = function (subject) {
        var args = [].slice.call(arguments, 1);
        this.instructions.push('add_states(' + subject + ', ' + rubyArgs(args) + ')');
    };
    Cheat_Code.prototype.gain_exp = function (subject, value) {
        this.instructions.push('gain_exp(' + subject + ', ' + value + ')');
    };
    Cheat_Code.prototype.add_actors = function () {
        this.instructions.push('add_actors(' + rubyArgs([].slice.call(arguments)) + ')');
    };
    Cheat_Code.prototype.run_common_event = function (eventId) {
        this.instructions.push('run_common_event(' + eventId + ')');
    };
    Cheat_Code.prototype.set_starting_map = function (mapId, x, y) {
        this.instructions.push('set_starting_map(' + mapId + ', ' + x + ', ' + y + ')');
        this.stageCode = true;
    };

    //-------------------------------------------------------------------------
    // CheatCode_Interpreter - 0263.rb:590
    //-------------------------------------------------------------------------
    function CheatCode_Interpreter() {
        this.sortCodes();
        var self = this;
        this.instructions.forEach(function (i) {
            try { runOn(self, i); } catch (e) { /* `rescue; next` */ }
        });
        pending.length = 0;
    }

    /** 0263.rb:626 - flatten every pending code, `add_actors` first. */
    CheatCode_Interpreter.prototype.sortCodes = function () {
        var temp = [], actorInstructs = [];
        pending.forEach(function (code) {
            code.instructions.forEach(function (i) { temp.push(i); });
        });
        temp.forEach(function (i) {
            if (/add_actors\s*\(/.test(i)) { actorInstructs.push(i); }
        });
        temp = temp.filter(function (i) { return !/add_actors\s*\(/.test(i); });
        this.instructions = actorInstructs.concat(temp);
    };

    CheatCode_Interpreter.prototype.add_gold = function (value) {
        $gameParty.gainGold(value);
    };
    CheatCode_Interpreter.prototype.add_armors = function (armors) {
        (armors || []).forEach(function (id) {
            $gameParty.gainItem($dataArmors[id], 1);
        });
    };
    CheatCode_Interpreter.prototype.add_weapons = function (weapons) {
        (weapons || []).forEach(function (id) {
            $gameParty.gainItem($dataWeapons[id], 1);
        });
    };
    // 0263.rb:684 - the Ruby body reads `items.each` (an undefined local), so
    // this helper has never worked upstream.  Kept verbatim in spirit, but
    // guarded so it cannot throw where the original silently NoMethodError'd.
    CheatCode_Interpreter.prototype.add_items = function (item, amount) {
        if (!Array.isArray(item)) { return; }
        item.forEach(function (id) {
            $gameParty.gainItem($dataItems[id], amount);
        });
    };
    CheatCode_Interpreter.prototype.turn_switches = function (switches) {
        (switches || []).forEach(function (id) { $gameSwitches.setValue(id, true); });
    };
    CheatCode_Interpreter.prototype.set_variable = function (variableId, value) {
        $gameVariables.setValue(variableId, value);
    };
    CheatCode_Interpreter.prototype.add_states = function (subject, states) {
        var targets = this.get_subject(subject);
        if (!targets) { return; }
        (states || []).forEach(function (stateId) {
            targets.forEach(function (actor) { if (actor) { actor.addState(stateId); } });
        });
    };
    CheatCode_Interpreter.prototype.gain_exp = function (subject, value) {
        var targets = this.get_subject(subject);
        if (!targets) { return; }
        targets.forEach(function (actor) { if (actor) { actor.gainExp(value); } });
    };
    CheatCode_Interpreter.prototype.add_actors = function (actors) {
        (actors || []).forEach(function (id) {
            if ($dataActors[id]) { $gameParty.addActor(id); }
        });
    };
    // 0263.rb:748 - `SceneManager.scene.interpreter.setup(...)`.  MV's Scene_Map
    // has no interpreter property; `$gameTemp.reserveCommonEvent` is MV's own
    // queue and lands the same event at the same moment in the frame.
    CheatCode_Interpreter.prototype.run_common_event = function (eventId) {
        var scene = SceneManager._scene;
        if (scene && scene._interpreter && $dataCommonEvents[eventId]) {
            scene._interpreter.setup($dataCommonEvents[eventId].list);
        } else if ($gameTemp) {
            $gameTemp.reserveCommonEvent(eventId);
        }
    };
    /** 0263.rb:762 */
    CheatCode_Interpreter.prototype.get_subject = function (subjects) {
        if (subjects === -1) { return $gameParty.allMembers(); }
        if (typeof subjects === 'number') {
            return $gameActors.actor(subjects) ? [$gameActors.actor(subjects)] : null;
        }
        if (Array.isArray(subjects)) {
            // The Ruby pushes `$data_actors[actor_id]` here - the *database*
            // record, which has no add_state/gain_exp, so the branch has never
            // worked upstream.  `$gameActors.actor` is what was meant.
            var out = [];
            subjects.forEach(function (id) {
                if ($dataActors[id]) { out.push($gameActors.actor(id)); }
            });
            return out;
        }
        return null;
    };

    //-------------------------------------------------------------------------
    // Window_CodeEdit - 0263.rb:1085 (a Window_NameEdit without an actor)
    //-------------------------------------------------------------------------
    function Window_CodeEdit() { this.initialize.apply(this, arguments); }
    Window_CodeEdit.prototype = Object.create(Window_NameEdit.prototype);
    Window_CodeEdit.prototype.constructor = Window_CodeEdit;

    Window_CodeEdit.prototype.initialize = function (maxChar) {
        var x = (Graphics.boxWidth - 360) / 2;
        var y = (Graphics.boxHeight -
                 (this.fittingHeight(4) + this.fittingHeight(10) + 12)) / 2;
        // The Ruby skips two levels up to Window_Base's own initialize for the
        // same reason: Window_NameEdit's wants an actor, and a code is not one.
        Window_Base.prototype.initialize.call(this, x, y, 360, this.fittingHeight(2));
        this._maxLength = maxChar;
        this._name = '';
        this._defaultName = '';
        this._index = 0;
        this._actor = null;
        this.deactivate();
        this.refresh();
    };
    /** 0263.rb:1120 - no face, so no face width in the centring. */
    Window_CodeEdit.prototype.left = function () {
        var nameCenter = this.contentsWidth() / 2;
        var nameWidth = (this._maxLength + 1) * this.charWidth();
        return Math.min(nameCenter - nameWidth / 2, this.contentsWidth() - nameWidth);
    };
    /** 0263.rb:1131 */
    Window_CodeEdit.prototype.itemRect = function (index) {
        return {
            x: this.left() + index * this.charWidth(),
            y: Math.floor(this.height / 2) - 20,
            width: this.charWidth(),
            height: this.lineHeight()
        };
    };
    /** 0263.rb:1141 - no actor face to draw, unlike the base refresh. */
    Window_CodeEdit.prototype.refresh = function () {
        this.contents.clear();
        for (var i = 0; i < this._maxLength; i++) { this.drawUnderline(i); }
        for (var j = 0; j < this._name.length; j++) { this.drawChar(j); }
        var rect = this.itemRect(this._index);
        this.setCursorRect(rect.x, rect.y, rect.width, rect.height);
    };

    //-------------------------------------------------------------------------
    // Window_CodeCheck - 0263.rb:1016
    //-------------------------------------------------------------------------
    function Window_CodeCheck() { this.initialize.apply(this, arguments); }
    Window_CodeCheck.prototype = Object.create(Window_Base.prototype);
    Window_CodeCheck.prototype.constructor = Window_CodeCheck;

    Window_CodeCheck.prototype.initialize = function (editWindow) {
        Window_Base.prototype.initialize.call(this, editWindow.x,
            editWindow.y + editWindow.height + 8, editWindow.width,
            editWindow.height);
    };
    // 0263.rb:1046/1055 draw into `contents.rect` - the whole content area,
    // centred.  `contents.clear()` is not in the Ruby, which lets successive
    // entries overprint; clearing is the behaviour the screen plainly wants.
    /** the code's display name, centred, in colour 11. */
    Window_CodeCheck.prototype.success = function (code) {
        this.contents.clear();
        this.changeTextColor(this.textColor(11));
        this.drawText(code, 0, 0, this.contentsWidth(), 'center');
    };
    Window_CodeCheck.prototype.fail = function () {
        this.contents.clear();
        this.changeTextColor(this.textColor(18));
        this.drawText('Incorrect entry', 0, 0, this.contentsWidth(), 'center');
    };

    //-------------------------------------------------------------------------
    // Window_CodeInput - 0263.rb:948
    //-------------------------------------------------------------------------
    function Window_CodeInput() { this.initialize.apply(this, arguments); }
    Window_CodeInput.prototype = Object.create(Window_NameInput.prototype);
    Window_CodeInput.prototype.constructor = Window_CodeInput;

    // 0263.rb:966 - the stock table ends 'Page','OK' (VX Ace 0071.rb:19, MV
    // rpg_windows.js) with the page-change slot at 88 and OK at 89.  This
    // "modified version" only relabels those two cells: 'Page' becomes 'Leave'
    // and 'OK' stays 'OK'.  So the two predicates below are *not* swapped -
    // they are the engine's own indices, restated.  'Leave' at 88 hits
    // cursorPagedown, which is redefined below to return to the title.
    Window_CodeInput.MOD_LATIN1 =
        ['A', 'B', 'C', 'D', 'E', 'a', 'b', 'c', 'd', 'e',
         'F', 'G', 'H', 'I', 'J', 'f', 'g', 'h', 'i', 'j',
         'K', 'L', 'M', 'N', 'O', 'k', 'l', 'm', 'n', 'o',
         'P', 'Q', 'R', 'S', 'T', 'p', 'q', 'r', 's', 't',
         'U', 'V', 'W', 'X', 'Y', 'u', 'v', 'w', 'x', 'y',
         'Z', '[', ']', '^', '_', 'z', '{', '}', '|', '~',
         '0', '1', '2', '3', '4', '!', '#', '$', '%', '&',
         '5', '6', '7', '8', '9', '(', ')', '*', '+', '-',
         '/', '=', '@', '<', '>', ':', ';', ' ', 'Leave', 'OK'];

    Window_CodeInput.prototype.table = function () {
        return [Window_CodeInput.MOD_LATIN1, Window_NameInput.LATIN2];
    };
    // VX Ace 0071.rb:87 (is_page_change?) / :94 (is_ok?) - MV uses the same
    // indices, so these are restated rather than overridden.
    Window_CodeInput.prototype.isPageChange = function () { return this._index === 88; };
    Window_CodeInput.prototype.isOk = function () { return this._index === 89; };
    /** 0263.rb:996 - "page down" leaves the scene rather than turning a page. */
    Window_CodeInput.prototype.cursorPagedown = function () {
        this.callCancelHandler();
    };

    //-------------------------------------------------------------------------
    // Scene_CodeInput - 0263.rb:798
    //-------------------------------------------------------------------------
    function Scene_CodeInput() { this.initialize.apply(this, arguments); }
    Scene_CodeInput.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_CodeInput.prototype.constructor = Scene_CodeInput;

    Scene_CodeInput.prototype.prepare = function (maxChar) {
        this._maxChar = maxChar;
    };

    Scene_CodeInput.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        this._editWindow = new Window_CodeEdit(RIFF.CHEAT.CODE_LENGTH);
        this._checkWindow = new Window_CodeCheck(this._editWindow);
        this._inputWindow = new Window_CodeInput(this._editWindow);
        this._inputWindow.y = this._checkWindow.y + this._checkWindow.height + 8;
        this._inputWindow.setHandler('ok', this.onInputOk.bind(this));
        this._inputWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._editWindow);
        this.addWindow(this._checkWindow);
        this.addWindow(this._inputWindow);
    };

    Scene_CodeInput.prototype.checkValidity = function (code) {
        return Object.prototype.hasOwnProperty.call(CODES, code);
    };

    /** 0263.rb:846 */
    Scene_CodeInput.prototype.onInputOk = function () {
        var typed = this._editWindow.name();
        if (!this.checkValidity(typed)) {
            this._checkWindow.fail();
            SoundManager.playBuzzer();
            this._editWindow.restoreDefault();
            return;
        }
        var entry = CODES[typed];
        var code = new Cheat_Code(entry[0], entry.slice(1));
        this._checkWindow.success(code.name);
        SoundManager.playOk();
        if (code.stageCode) {
            var stage = null;
            var self = this;
            code.instructions.slice().forEach(function (ins) {
                if (/set_starting_map\s*\(/.test(ins)) {
                    stage = ins;
                    code.delete(ins);
                }
            });
            pending.push(code);
            // `eval(@stage_instruction)` runs against the scene, so
            // set_starting_map resolves to the scene's own method.
            if (stage) { runOn(self, stage); }
        } else {
            pending.push(code);
            this._editWindow.restoreDefault();
        }
    };

    /** 0263.rb:912 - restart the game at a given map / tile right away. */
    Scene_CodeInput.prototype.set_starting_map = function (mapId, x, y) {
        // `SceneManager.clear` + `DataManager.load_database` in the Ruby.  MV's
        // setupNewGame is the closer equivalent - it also builds the party and
        // reserving the transfer below is what actually lands the player,
        // because setupNewGame's own reserve would otherwise win.
        DataManager.setupNewGame();
        $gameMap.setup(mapId);
        $gamePlayer.reserveTransfer(mapId, x, y);
        $gamePlayer.refresh();
        // 0263.rb:913 - `SceneManager.clear` empties the return stack before
        // the map is called.  MV's goto() leaves the stack alone, so a later
        // pop would drop the player back into the title.
        SceneManager._stack.length = 0;
        SceneManager.goto(Scene_Map);
        $gameMap.autoplay();
        new CheatCode_Interpreter();
    };

    //-------------------------------------------------------------------------
    // Title screen wiring - 0263.rb:1214 / 1252
    //-------------------------------------------------------------------------
    var _titleMakeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function () {
        _titleMakeCommandList.call(this);
        // 0263.rb:1275 - New Game, Continue, Cheats, Shutdown.  MV has no
        // Shutdown command, so Cheats goes between Continue and Options.
        //
        // The guard has to be "is it already there" rather than a once-flag:
        // MV's Window_Command#initialize runs refresh() twice before its own
        // Window_Selectable#initialize does, and refresh() clears the list, so
        // a one-shot flag drops the command on the very next rebuild.
        var list = this._list;
        var at = list.length;
        for (var i = 0; i < list.length; i++) {
            if (list[i].symbol === 'passwords') { return; }
            if (list[i].symbol === 'options') { at = i; }
        }
        list.splice(at, 0, {
            name: RIFF.CHEAT.CODESCENE_BUTTON, symbol: 'passwords',
            enabled: true, ext: null
        });
    };

    var _titleCreateCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function () {
        _titleCreateCommandWindow.call(this);
        this._commandWindow.setHandler('passwords', this.commandPasswords.bind(this));
    };

    /** 0263.rb:1231 */
    Scene_Title.prototype.commandPasswords = function () {
        this._commandWindow.close();
        SceneManager.push(Scene_CodeInput);
    };

    var _titleCommandNewGame = Scene_Title.prototype.commandNewGame;
    Scene_Title.prototype.commandNewGame = function () {
        _titleCommandNewGame.call(this);
        new CheatCode_Interpreter();
    };

    //-------------------------------------------------------------------------
    // Scene_Load - 0263.rb:1320
    //-------------------------------------------------------------------------
    var _loadOnLoadSuccess = Scene_Load.prototype.onLoadSuccess;
    Scene_Load.prototype.onLoadSuccess = function () {
        _loadOnLoadSuccess.call(this);
        new CheatCode_Interpreter();
    };

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    MonlineCheatCodes.RIFF = RIFF;
    MonlineCheatCodes.CODES = CODES;
    MonlineCheatCodes.Cheat_Code = Cheat_Code;
    MonlineCheatCodes.CheatCode_Interpreter = CheatCode_Interpreter;
    MonlineCheatCodes.Scene_CodeInput = Scene_CodeInput;
    MonlineCheatCodes.Window_CodeEdit = Window_CodeEdit;
    MonlineCheatCodes.Window_CodeCheck = Window_CodeCheck;
    MonlineCheatCodes.Window_CodeInput = Window_CodeInput;
    MonlineCheatCodes.runOn = runOn;
    window.Scene_CodeInput = Scene_CodeInput;
    window.MonlineCheatCodes = MonlineCheatCodes;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        F.Scene_CodeInput = Scene_CodeInput;
        F.CheatCode_Interpreter = CheatCode_Interpreter;
    }

    console.log('[MonlineCheatCodes] loaded');
})();
