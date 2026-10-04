//=============================================================================
// MonlineSaveEngine.js
// Port of _vxace_scripts/0114.rb - "Yanfly Engine Ace - Ace Save Engine".
//=============================================================================
/*:
 * @plugindesc The Monline save screen (0114.rb): a file list, a Load / Save /
 * Delete action bar, and a status panel showing playtime, save count, gold,
 * location, the party and the configured variables.
 * @author Monline port (from 0114.rb)
 *
 * @help
 * Monline replaces the stock save/load screen with Yanfly's Ace Save Engine.
 * The stock MV screen is a plain list of rows; this one is a three-pane
 * layout: slots down the left, Load / Save / Delete across the top right, and
 * a status panel underneath that tells you what is actually in the file -
 * playtime, how many times you have saved, your gold, where you saved, who is
 * in the party and any variables the game wants to show.
 *
 *   60 file slots (YEA::SAVE::MAX_FILES)
 *   Save is always available from the main menu, because this screen loads
 *   and deletes as well as saves.
 *
 * The Ruby writes the *whole* game state into the save header so the status
 * window can read it without opening the file.  MV has no separate header -
 * `DataManager.loadSavefileInfo` reads one entry out of the global info file,
 * which is parsed on every refresh of a 60-slot list.  The port therefore
 * stores only what the status window actually draws, which keeps file 0 small;
 * every number on screen is the same.
 */
var MonlineSaveEngine = MonlineSaveEngine || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // YEA::SAVE - 0114.rb:55, verbatim.
    //-------------------------------------------------------------------------
    var YEA = {
        SAVE: {
            MAX_FILES: 60,
            SLOT_NAME: 'File %s',
            SAVE_ICON: 1748,
            EMPTY_ICON: 1744,
            ACTION_LOAD: 'Load',
            ACTION_SAVE: 'Save',
            ACTION_DELETE: 'Delete',
            // 0114.rb:78 - RPG::SE.new("Collapse3", 100, 100)
            DELETE_SOUND: { name: 'Collapse3', volume: 100, pitch: 100 },
            SELECT_HELP: 'Please select a file slot.',
            LOAD_HELP: 'Loads the data from the saved game.',
            SAVE_HELP: 'Saves the current progress in your game.',
            DELETE_HELP: 'Deletes all data from this save file.',
            EMPTY_TEXT: 'No Save Data',
            PLAYTIME: 'Playtime',
            TOTAL_SAVE: 'Total Saves: ',
            TOTAL_GOLD: 'Total Gold: ',
            LOCATION: 'Location: ',
            COLUMN1_VARIABLES: [0, 0, 0],
            COLUMN2_VARIABLES: [0, 0, 0]
        }
    };

    // 0114.rb:119 - Icon.save_icon / Icon.empty_icon
    var Icon = { save_icon: YEA.SAVE.SAVE_ICON, empty_icon: YEA.SAVE.EMPTY_ICON };

    /** 0110.rb:299 - thousands separators (YEA::CORE::GROUP_DIGITS). */
    function group(n) {
        var s = String(n);
        return s.replace(/(\d)(?=\d{3}(?:\.|$))(\d{3}\..*)?/g, '$1,$2');
    }

    /** `sprintf(SLOT_NAME, x)` - the Ruby only ever interpolates one value. */
    function slotName(value) {
        var s = YEA.SAVE.SLOT_NAME;
        return s.replace('%s', value === undefined ? '' : String(value));
    }

    //-------------------------------------------------------------------------
    // DataManager (0114.rb:152)
    //-------------------------------------------------------------------------
    // 0114.rb:157 - 60 slots, not MV's 20.
    DataManager.maxSavefiles = function () {
        return YEA.SAVE.MAX_FILES;
    };

    // 0114.rb:164 - everything the status window reads out of a header.
    // See the header comment for why this is a compact copy and not the whole
    // game state the Ruby marshals.
    var _makeSavefileInfo = DataManager.makeSavefileInfo;
    DataManager.makeSavefileInfo = function () {
        var info = _makeSavefileInfo.call(this);
        info.saveCount = $gameSystem.saveCount();
        info.gold = $gameParty.gold();
        info.location = $gameMap.displayName();
        info.variables = {};
        info.members = [];
        $gameParty.battleMembers().forEach(function (actor) {
            info.members.push({
                name: actor.name(),
                characterName: actor.characterName(),
                characterIndex: actor.characterIndex()
            });
        });
        var ids = YEA.SAVE.COLUMN1_VARIABLES.concat(YEA.SAVE.COLUMN2_VARIABLES);
        ids.forEach(function (id) {
            if (id > 0 && $dataSystem.variables[id]) {
                info.variables[id] = $gameVariables.value(id);
            }
        });
        return info;
    };

    /** 0114.rb:708 - delete a slot, header included. */
    DataManager.deleteSavefile = function (savefileId) {
        StorageManager.remove(savefileId);
        var globalInfo = this.loadGlobalInfo() || [];
        if (globalInfo[savefileId]) {
            delete globalInfo[savefileId];
            StorageManager.save(0, JsonEx.stringify(globalInfo));
        }
    };

    //-------------------------------------------------------------------------
    // Window_MenuCommand (0114.rb:193) - Save is always on the menu, because
    // this screen loads and deletes too.
    //-------------------------------------------------------------------------
    Window_MenuCommand.prototype.isSaveEnabled = function () {
        return true;
    };

    //-------------------------------------------------------------------------
    // Window_FileList (0114.rb:201)
    //-------------------------------------------------------------------------
    function Window_FileList() { this.initialize.apply(this, arguments); }
    Window_FileList.prototype = Object.create(Window_Selectable.prototype);
    Window_FileList.prototype.constructor = Window_FileList;

    Window_FileList.prototype.initialize = function (x, y) {
        Window_Selectable.prototype.initialize.call(
            this, x, y, 128, Graphics.boxHeight - y);
        this.refresh();
        this.activate();
        // 0114.rb:209 - `select(SceneManager.scene.first_savefile_index)`, so
        // the save screen opens on the slot you last used.
        var scene = SceneManager._scene;
        var first = (scene && scene.firstSavefileIndex)
            ? scene.firstSavefileIndex() : 0;
        this.select(first);
    };
    Window_FileList.prototype.maxItems = function () {
        return DataManager.maxSavefiles();
    };
    /** MV's savefile ids are 1-based; the window's index is 0-based. */
    Window_FileList.prototype.savefileId = function () {
        return this.index() + 1;
    };
    Window_FileList.prototype.header = function (index) {
        if (index === undefined) { index = this.index(); }
        if (index < 0) { return null; }
        return DataManager.loadSavefileInfo(index + 1);
    };
    /** 0114.rb:221 - an empty slot cannot be loaded. */
    Window_FileList.prototype.isCurrentItemEnabled = function () {
        var h = this.header();
        if (!h && SceneManager._scene instanceof Scene_Load) { return false; }
        return true;
    };
    Window_FileList.prototype.refresh = function () {
        this.createContents();
        this.drawAllItems();
    };
    // 0114.rb:246 - `save_icon?(header)`: a filled slot gets the save icon, an
    // empty one the empty icon *at translucent alpha*.  MV's drawIcon blts, and
    // Bitmap#blt ignores paintOpacity, so the alpha is pushed onto the canvas
    // for the duration of the one blt.
    Window_FileList.prototype.drawItemIcon = function (icon, x, y, alpha) {
        var ctx = this.contents && this.contents._context;
        if (!ctx) { this.drawIcon(icon, x, y); return; }
        var old = ctx.globalAlpha;
        ctx.globalAlpha = alpha / 255;
        this.drawIcon(icon, x, y);
        ctx.globalAlpha = old;
    };
    // 0114.rb:238
    Window_FileList.prototype.drawItem = function (index) {
        var header = this.header(index);
        var enabled = !!header;
        var rect = this.itemRect(index);
        rect.width -= 4;
        this.drawItemIcon(enabled ? Icon.save_icon : Icon.empty_icon,
                          rect.x, rect.y,
                          enabled ? 255 : this.translucentOpacity());
        this.changeTextColor(this.normalColor());
        this.changePaintOpacity(enabled);
        this.drawText(slotName(group(index + 1)), rect.x + 24, rect.y,
                      rect.width - 24);
        this.changePaintOpacity(true);
    };

    //-------------------------------------------------------------------------
    // Window_FileStatus (0114.rb:263)
    //-------------------------------------------------------------------------
    function Window_FileStatus() { this.initialize.apply(this, arguments); }
    Window_FileStatus.prototype = Object.create(Window_Base.prototype);
    Window_FileStatus.prototype.constructor = Window_FileStatus;

    Window_FileStatus.prototype.initialize = function (x, y, fileWindow) {
        Window_Base.prototype.initialize.call(
            this, x, y, Graphics.boxWidth - x, Graphics.boxHeight - y);
        this._fileWindow = fileWindow;
        this._currentIndex = fileWindow.index();
        this.refresh();
    };
    // 0114.rb:278
    Window_FileStatus.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (this._fileWindow.index() < 0) { return; }
        if (this._currentIndex === this._fileWindow.index()) { return; }
        this._currentIndex = this._fileWindow.index();
        this.refresh();
    };
    // 0114.rb:289
    Window_FileStatus.prototype.refresh = function () {
        this.contents.clear();
        this.resetFontSettings();
        this._header = this._fileWindow.header();
        if (!this._header) { this.drawEmpty(); } else { this.drawSaveContents(); }
    };
    // 0114.rb:303
    Window_FileStatus.prototype.drawEmpty = function () {
        // `Color.new(0, 0, 0, translucent_alpha / 2)` - 80 / 255
        this.contents.fillRect(0, 0, this.contentsWidth(), this.contentsHeight(),
                               'rgba(0,0,0,0.3137)');
        this.changeTextColor(this.systemColor());
        this.drawText(YEA.SAVE.EMPTY_TEXT, 0, 0, this.contentsWidth(),
                      'center');
    };
    // 0114.rb:315
    Window_FileStatus.prototype.drawSaveSlot = function (dx, dy, dw) {
        this.resetFontSettings();
        this.changeTextColor(this.systemColor());
        var text = slotName('');
        this.drawText(text, dx, dy, dw);
        var cx = this.textWidth(text);
        this.changeTextColor(this.normalColor());
        this.drawText(group(this._fileWindow.index() + 1), dx + cx, dy, dw - cx);
    };
    // 0114.rb:328 - `draw_text(..., 0)` / `draw_text(..., 2)` = left / right
    Window_FileStatus.prototype.drawSavePlaytime = function (dx, dy, dw) {
        if (this._header.playtime === undefined) { return; }
        this.resetFontSettings();
        this.changeTextColor(this.systemColor());
        this.drawText(YEA.SAVE.PLAYTIME, dx, dy, dw, 'left');
        this.changeTextColor(this.normalColor());
        this.drawText(this._header.playtime, dx, dy, dw, 'right');
    };
    // 0114.rb:340
    Window_FileStatus.prototype.drawSaveTotalSaves = function (dx, dy, dw) {
        if (this._header.saveCount === undefined) { return; }
        this.resetFontSettings();
        this.changeTextColor(this.systemColor());
        var text = YEA.SAVE.TOTAL_SAVE;
        this.drawText(text, dx, dy, dw);
        var cx = this.textWidth(text);
        this.changeTextColor(this.normalColor());
        this.drawText(group(this._header.saveCount), dx + cx, dy, dw - cx);
    };
    // 0114.rb:354
    Window_FileStatus.prototype.drawSaveGold = function (dx, dy, dw) {
        if (this._header.gold === undefined) { return; }
        this.resetFontSettings();
        this.changeTextColor(this.systemColor());
        this.drawText(YEA.SAVE.TOTAL_GOLD, dx, dy, dw);
        var unit = TextManager.currencyUnit;
        this.drawText(unit, dx, dy, dw, 'right');
        var cx = this.textWidth(unit);
        this.changeTextColor(this.normalColor());
        this.drawText(group(this._header.gold), dx, dy, dw - cx, 'right');
    };
    // 0114.rb:370
    Window_FileStatus.prototype.drawSaveLocation = function (dx, dy, dw) {
        if (this._header.location === undefined) { return; }
        this.resetFontSettings();
        this.changeTextColor(this.systemColor());
        this.drawText(YEA.SAVE.LOCATION, dx, dy, dw);
        var cx = this.textWidth(YEA.SAVE.LOCATION);
        this.changeTextColor(this.normalColor());
        var text = this._header.location;
        if (!text || text === '') { text = '???'; }
        this.drawText(text, dx + cx, dy, dw - cx);
    };
    // 0114.rb:387 - the Ruby draws the walking graphic with the name at its
    // feet; both sit on the same y, exactly as upstream.
    //
    // The header is round-tripped through JSON on its way into the global info
    // file, so a member is stored as plain data and handed to
    // `draw_actor_character` behind a one-call adapter rather than as a live
    // Game_Actor (which is what the marshalled header carried).
    Window_FileStatus.prototype.drawSaveCharacters = function (dx, dy) {
        if (!this._header.members) { return; }
        this.resetFontSettings();
        this.contents.fontSize = Math.max((this.contents.fontSize || 28) - 4, 10);
        var n = Math.max(this._header.members.length, 1);
        var dw = (this.contentsWidth() - dx) / n;
        var x = dx + dw / 2;
        this._header.members.forEach(function (member) {
            this.changeTextColor(this.normalColor());
            this.drawActorCharacter({
                characterName: function () { return member.characterName; },
                characterIndex: function () { return member.characterIndex; }
            }, x, dy);
            this.drawText(member.name, x - dw / 2, dy, dw, 'center');
            x += dw;
        }, this);
        this.resetFontSettings();
    };
    // 0114.rb:429
    Window_FileStatus.prototype.drawColumnData = function (data, dx, dy, dw) {
        if (!this._header.variables) { return; }
        this.resetFontSettings();
        data.forEach(function (variableId) {
            if (!$dataSystem.variables[variableId]) { return; }
            this.changeTextColor(this.systemColor());
            this.drawText($dataSystem.variables[variableId], dx, dy, dw, 'left');
            var value = this._header.variables[variableId];
            this.changeTextColor(this.normalColor());
            this.drawText(group(value === undefined ? 0 : value), dx, dy, dw, 'right');
            dy += this.lineHeight();
        }, this);
    };
    // 0114.rb:447
    Window_FileStatus.prototype.drawSaveContents = function () {
        var lh = this.lineHeight();
        var half = Math.floor(this.contentsWidth() / 2);
        this.drawSaveSlot(4, 0, half - 8);
        this.drawSavePlaytime(half + 4, 0, half - 8);
        this.drawSaveTotalSaves(4, lh, half - 8);
        this.drawSaveGold(half + 4, lh, half - 8);
        this.drawSaveLocation(4, lh * 2, this.contentsWidth() - 8);
        this.drawSaveCharacters(0, lh * 5 + lh / 3);
        this.drawColumnData(YEA.SAVE.COLUMN1_VARIABLES, 16, lh * 7, half - 48);
        this.drawColumnData(YEA.SAVE.COLUMN2_VARIABLES, half + 16, lh * 7,
                            half - 48);
    };

    //-------------------------------------------------------------------------
    // Window_FileAction (0114.rb:464)
    //-------------------------------------------------------------------------
    function Window_FileAction() { this.initialize.apply(this, arguments); }
    Window_FileAction.prototype = Object.create(Window_HorzCommand.prototype);
    Window_FileAction.prototype.constructor = Window_FileAction;

    Window_FileAction.prototype.initialize = function (x, y, fileWindow) {
        this._fileWindow = fileWindow;
        this._currentIndex = fileWindow.index();
        Window_HorzCommand.prototype.initialize.call(this, x, y);
        this.deactivate();
        this.deselect();
    };
    Window_FileAction.prototype.windowWidth = function () {
        return Graphics.boxWidth - 128;
    };
    /** 0114.rb:484 - col_max */
    Window_FileAction.prototype.maxCols = function () {
        return 3;
    };
    // 0114.rb:489
    Window_FileAction.prototype.update = function () {
        Window_HorzCommand.prototype.update.call(this);
        if (this._fileWindow.index() < 0) { return; }
        if (this._currentIndex === this._fileWindow.index()) { return; }
        this._currentIndex = this._fileWindow.index();
        this.refresh();
    };
    Window_FileAction.prototype.header = function () {
        return this._fileWindow.header();
    };
    Window_FileAction.prototype.makeCommandList = function () {
        this._header = this.header();
        this.addCommand(YEA.SAVE.ACTION_LOAD, 'load', this.loadEnabled());
        this.addCommand(YEA.SAVE.ACTION_SAVE, 'save', this.saveEnabled());
        this.addCommand(YEA.SAVE.ACTION_DELETE, 'delete', this.deleteEnabled());
    };
    /** 0114.rb:517 */
    Window_FileAction.prototype.loadEnabled = function () {
        return !!this.header();
    };
    // 0114.rb:532 - `!$game_system.save_disabled`.  MV spells the getter the
    // other way round (`isSaveEnabled`), so the check is negated here.
    Window_FileAction.prototype.saveEnabled = function () {
        if (SceneManager._scene instanceof Scene_Load) { return false; }
        if (!$gameSystem.isSaveEnabled()) { return false; }
        return true;
    };
    /** 0114.rb:549 */
    Window_FileAction.prototype.deleteEnabled = function () {
        return !!this.header();
    };

    //-------------------------------------------------------------------------
    // Scene_File (0114.rb:571)
    //-------------------------------------------------------------------------
    // 0114.rb:649 - which action the cursor lands on: Load for Scene_Load,
    // Save for Scene_Save.
    function defaultActionIndex() {
        return SceneManager._scene instanceof Scene_Load ? 0 : 1;
    }

    var _Scene_File_create = Scene_File.prototype.create;
    Scene_File.prototype.create = function () {
        // MV's own create() builds Window_SaveFile and asks DataManager to
        // preload every slot's faces; the Ace Save Engine has its own layout
        // and draws only the selected file, so it is not used here.
        Scene_MenuBase.prototype.create.call(this);
        this.createAllWindows();
    };

    var _Scene_File_start = Scene_File.prototype.start;
    Scene_File.prototype.start = function () {
        Scene_MenuBase.prototype.start.call(this);
    };

    /** 0114.rb:598 */
    Scene_File.prototype.createAllWindows = function () {
        this.createHelpWindow();
        this.createFileWindow();
        this.createActionWindow();
        this.createStatusWindow();
    };
    /** 0114.rb:608 */
    Scene_File.prototype.createHelpWindow = function () {
        this._helpWindow = new Window_Help(1);
        this._helpWindow.setText(YEA.SAVE.SELECT_HELP);
        this.addWindow(this._helpWindow);
    };
    /** 0114.rb:616 */
    Scene_File.prototype.createFileWindow = function () {
        this._fileWindow = new Window_FileList(0, this._helpWindow.height);
        this._fileWindow.setHandler('ok', this.onFileOk.bind(this));
        this._fileWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._fileWindow);
    };
    /** 0114.rb:626 */
    Scene_File.prototype.createActionWindow = function () {
        var wx = this._fileWindow.width;
        var wy = this._helpWindow.height;
        this._actionWindow = new Window_FileAction(wx, wy, this._fileWindow);
        this._actionWindow.setHelpWindow(this._helpWindow);
        this._actionWindow.setHandler('cancel', this.onActionCancel.bind(this));
        this._actionWindow.setHandler('load', this.onActionLoad.bind(this));
        this._actionWindow.setHandler('save', this.onActionSave.bind(this));
        this._actionWindow.setHandler('delete', this.onActionDelete.bind(this));
        this.addWindow(this._actionWindow);
    };
    /** 0114.rb:640 */
    Scene_File.prototype.createStatusWindow = function () {
        var wx = this._actionWindow.x;
        var wy = this._actionWindow.y + this._actionWindow.height;
        this._statusWindow = new Window_FileStatus(wx, wy, this._fileWindow);
        this.addWindow(this._statusWindow);
    };

    Scene_File.prototype.savefileId = function () {
        return this._fileWindow.savefileId();
    };

    /** 0114.rb:649 */
    Scene_File.prototype.onFileOk = function () {
        this._actionWindow.activate();
        this._actionWindow.select(defaultActionIndex());
    };
    /** 0114.rb:658 */
    Scene_File.prototype.onActionCancel = function () {
        this._actionWindow.deselect();
        this._fileWindow.activate();
        this._helpWindow.setText(YEA.SAVE.SELECT_HELP);
    };
    /** 0114.rb:667 */
    Scene_File.prototype.onActionLoad = function () {
        if (DataManager.loadGame(this.savefileId())) {
            this.onLoadSuccess();
        } else {
            SoundManager.playBuzzer();
        }
    };
    /** 0114.rb:686 */
    Scene_File.prototype.onActionSave = function () {
        this._actionWindow.activate();
        // Ace does this inside DataManager.save_game (0003.rb:120); MV leaves
        // it to Scene_Save#onSavefileOk, which this layout never reaches.
        $gameSystem.onBeforeSave();
        if (DataManager.saveGame(this.savefileId())) {
            this.onSaveSuccess();
            this.refreshWindows();
        } else {
            SoundManager.playBuzzer();
        }
    };
    // 0114.rb:702 - `def on_save_success; Sound.play_save; end`.  Ace stays on
    // the save screen after saving (you leave with cancel); MV's own pops the
    // scene, so it is replaced here.
    Scene_Save.prototype.onSaveSuccess = function () {
        SoundManager.playSave();
    };
    /** 0114.rb:706 */
    Scene_File.prototype.onActionDelete = function () {
        this._actionWindow.activate();
        DataManager.deleteSavefile(this.savefileId());
        this.onDeleteSuccess();
        this.refreshWindows();
    };
    /** 0114.rb:716 - RPG::SE.new("Collapse3", 100, 100).play */
    Scene_File.prototype.onDeleteSuccess = function () {
        AudioManager.playSe(YEA.SAVE.DELETE_SOUND);
    };
    /** 0114.rb:723 */
    Scene_File.prototype.refreshWindows = function () {
        this._fileWindow.refresh();
        this._actionWindow.refresh();
        this._statusWindow.refresh();
    };
    /** 0114.rb:557 - the help text follows the highlighted action. */
    Scene_File.prototype.updateHelp = function () {
        if (!this._actionWindow || !this._actionWindow.active) { return; }
        var symbol = this._actionWindow.currentSymbol();
        if (symbol === 'load') { this._helpWindow.setText(YEA.SAVE.LOAD_HELP); }
        else if (symbol === 'save') { this._helpWindow.setText(YEA.SAVE.SAVE_HELP); }
        else if (symbol === 'delete') { this._helpWindow.setText(YEA.SAVE.DELETE_HELP); }
    };
    var _Scene_File_update = Scene_File.prototype.update;
    Scene_File.prototype.update = function () {
        _Scene_File_update.call(this);
        this.updateHelp();
    };

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    MonlineSaveEngine.YEA = YEA;
    MonlineSaveEngine.Icon = Icon;
    MonlineSaveEngine.group = group;
    MonlineSaveEngine.slotName = slotName;
    MonlineSaveEngine.Window_FileList = Window_FileList;
    MonlineSaveEngine.Window_FileStatus = Window_FileStatus;
    MonlineSaveEngine.Window_FileAction = Window_FileAction;
    window.MonlineSaveEngine = MonlineSaveEngine;
    window.Window_FileList = Window_FileList;
    window.Window_FileStatus = Window_FileStatus;
    window.Window_FileAction = Window_FileAction;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.savefile_max = function () {
            return YEA.SAVE.MAX_FILES;
        };
    }

    console.log('[MonlineSaveEngine] loaded');
})();
