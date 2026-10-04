//=============================================================================
// MonlineGameOver.js
//-----------------------------------------------------------------------------
// Port of VX Ace 0254.rb "DT's GameOver +" (DoctorTodd), the script Monline
// actually uses for its defeat screen: instead of "press a key and go to the
// title", the GameOver image gets a real command window with
//     Load / To Title / Quit
// at (180, 300), 160 pixels wide, one visible row per command.
//
// The optional "modern" behaviour (party-death common event, skipping the
// GameOver scene, reloading the last save, after-game-over common event) is
// taken from TSF Dungeon's Kath_GameOver.js v1.3 by McKathlin.  All of it is
// off by default so the screen behaves exactly like Monline's unless a
// parameter turns it on.
//=============================================================================

/*:
 * @plugindesc Monline's Game Over screen - a Load / To Title / Quit command
 * window over the GameOver image, with optional reload-last-save handling.
 * @author Monline MV port
 *
 * @param Command Window X
 * @desc X coordinate of the game over command window.
 * @default 180
 *
 * @param Command Window Y
 * @desc Y coordinate of the game over command window.
 * @default 300
 *
 * @param Command Window Width
 * @desc Width of the game over command window.
 * @default 160
 *
 * @param Show Command Window
 * @desc Show the Load / To Title / Quit window. If false the screen behaves
 * like the stock one (press a key to return to the title).
 * @default true
 *
 * @param Disable Load If No Save
 * @desc Grey out the Load command when this game has never been saved.
 * @default true
 *
 * @param Party Death Common Event ID
 * @desc Common event run the moment the party dies, instead of Game Over.
 * Leave blank to use the normal Game Over screen.
 * @default
 *
 * @param Show Game Over Scene
 * @desc Whether Scene_Gameover is shown. If false only a fade to black is
 * seen before the next scene.
 * @default true
 *
 * @param Reload Last Save
 * @desc Reload the most recent save instead of going to the title screen.
 * If the player never saved, the title screen is used as a fallback.
 * @default false
 *
 * @param After Game Over Common Event ID
 * @desc Common event run AFTER the Game Over screen, on a blacked-out map
 * with the leader revived to 1 HP. Leave blank to go to the title.
 * @default
 *
 * @help This plugin reproduces Monline's own defeat screen.
 *
 * ==============================
 * = The command window         =
 * ==============================
 * * Load     - opens the load screen; picking a file resumes there, and
 *              cancelling comes back to this screen.
 * * To Title - returns to the title screen.
 * * Quit     - closes the game.
 *
 * When "Disable Load If No Save" is on and there is no save file yet, Load is
 * drawn greyed out and cannot be chosen.
 *
 * ==================================
 * = Party Death Common Event ID    =
 * ==================================
 * Runs instead of the Game Over screen, in the same scene where the party
 * died. Have the common event call the Game Over command if you still want
 * the screen afterwards.
 *
 * ==================================
 * = Reload Last Save               =
 * ==================================
 * Sends the player back to the most recent save instead of the title. If an
 * After Game Over Common Event is set, the reload happens first and then the
 * common event runs on a blacked-out map.
 *
 * ==================================
 * = After Game Over Common Event   =
 * ==================================
 * Runs after the Game Over screen in a fresh map scene with the screen faded
 * out and the leader revived to 1 HP. Remember to fade back in.
 *
 * Plugin commands:
 *   GameOver Reload on|off|toggle
 *   GameOver ShowScene on|off|toggle
 */

var MonlineGameOver = MonlineGameOver || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineGameOver');

    function toNumber(name) {
        var raw = String(parameters[name] || '').trim();
        var n = parseInt(raw, 10);
        return isNaN(n) ? 0 : n;
    }

    function toBoolean(name, defaultValue) {
        switch (String(parameters[name] || '').trim().toLowerCase()) {
            case 'true': case 't': case 'yes': case 'y':
            case 'on': case '1':
                return true;
            case 'false': case 'f': case 'no': case 'n':
            case 'off': case '0':
                return false;
            default:
                return defaultValue;
        }
    }

    var CFG = {
        WIN_X: toNumber('Command Window X'),
        WIN_Y: toNumber('Command Window Y'),
        WIN_W: toNumber('Command Window Width'),
        SHOW_WINDOW: toBoolean('Show Command Window', true),
        DISABLE_LOAD: toBoolean('Disable Load If No Save', true),
        DEATH_EVENT: toNumber('Party Death Common Event ID'),
        SHOW_SCENE: toBoolean('Show Game Over Scene', true),
        RELOAD: toBoolean('Reload Last Save', false),
        AFTER_EVENT: toNumber('After Game Over Common Event ID')
    };
    MonlineGameOver.CFG = CFG;

    //=========================================================================
    // Window_GameOverCommand
    //=========================================================================

    function Window_GameOverCommand() {
        this.initialize.apply(this, arguments);
    }

    Window_GameOverCommand.prototype = Object.create(Window_Command.prototype);
    Window_GameOverCommand.prototype.constructor = Window_GameOverCommand;

    // DT's script builds the window at (0, 0) and lets the scene move it.
    Window_GameOverCommand.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
    };

    Window_GameOverCommand.prototype.windowWidth = function () {
        return CFG.WIN_W;
    };

    // VX Ace: visible_line_number returns item_max - one row per command,
    // so the window is exactly as tall as its command list.
    Window_GameOverCommand.prototype.numVisibleRows = function () {
        return this.maxItems();
    };

    Window_GameOverCommand.prototype.makeCommandList = function () {
        this.addLoadCommand();
        this.addTitleCommand();
        this.addOriginalCommands();
        this.addQuitCommand();
    };

    Window_GameOverCommand.prototype.addLoadCommand = function () {
        this.addCommand('Load', 'load', this.canLoad());
    };

    Window_GameOverCommand.prototype.canLoad = function () {
        if (!CFG.DISABLE_LOAD) { return true; }
        return DataManager.isAnySavefileExists();
    };

    Window_GameOverCommand.prototype.addTitleCommand = function () {
        this.addCommand('To Title', 'title');
    };

    // Hook, exactly like the VX Ace script's empty add_original_commands.
    Window_GameOverCommand.prototype.addOriginalCommands = function () {
    };

    Window_GameOverCommand.prototype.addQuitCommand = function () {
        this.addCommand('Quit', 'quit');
    };

    MonlineGameOver.Window_GameOverCommand = Window_GameOverCommand;
    window.Window_GameOverCommand = Window_GameOverCommand;

    //=========================================================================
    // Scene_Gameover
    //=========================================================================

    var _Scene_Gameover_create = Scene_Gameover.prototype.create;
    Scene_Gameover.prototype.create = function () {
        _Scene_Gameover_create.call(this);
        if (CFG.SHOW_WINDOW && CFG.SHOW_SCENE) {
            this.createCommandWindow();
        }
    };

    Scene_Gameover.prototype.createCommandWindow = function () {
        // Scene_Base#create does not make a window layer - only Scene_MenuBase
        // and Scene_Map do - and the stock Game Over screen has no windows at
        // all.  Without this, addWindow would have nothing to add to.
        if (!this._windowLayer) { this.createWindowLayer(); }
        var win = new Window_GameOverCommand();
        win.x = CFG.WIN_X;
        win.y = CFG.WIN_Y;
        win.setHandler('load', this.commandLoad.bind(this));
        win.setHandler('title', this.commandTitle.bind(this));
        win.setHandler('quit', this.commandQuit.bind(this));
        this.addWindow(win);
        this._commandWindow = win;
    };

    // Stock MV checks the trigger BEFORE Scene_Base.update, which is what
    // updates the windows - so the command window would never see the button
    // press and every choice would bounce straight to the title.  Fall back to
    // the stock "press anything" behaviour only when there is no command
    // window to handle the input.
    Scene_Gameover.prototype.update = function () {
        if (this.isActive() && !this.isBusy() && !this._commandWindow &&
            this.isTriggered()) {
            this.gotoTitle();
        }
        Scene_Base.prototype.update.call(this);
    };

    Scene_Gameover.prototype.commandLoad = function () {
        SceneManager.push(Scene_Load);
    };

    Scene_Gameover.prototype.commandTitle = function () {
        SceneManager.goto(Scene_Title);
    };

    Scene_Gameover.prototype.commandQuit = function () {
        this.fadeOutAll();
        SceneManager.exit();
    };

    //-------------------------------------------------------------------------
    // Skip the screen entirely (Kath_GameOver, off by default)
    //-------------------------------------------------------------------------
    if (!CFG.SHOW_SCENE) {
        Scene_Gameover.prototype.create = function () {
            Scene_Base.prototype.create.call(this);
            this.createBackground();
        };

        Scene_Gameover.prototype.start = function () {
            Scene_Base.prototype.start.call(this);
        };

        Scene_Gameover.prototype.update = function () {
            if (this.isActive() && !this.isBusy()) {
                this.gotoTitle();
            }
            Scene_Base.prototype.update.call(this);
        };

        // Load the picture so it cannot conflict with anything else, but do
        // not put it on screen.
        Scene_Gameover.prototype.createBackground = function () {
            this._backSprite = new Sprite();
            this._backSprite.bitmap = ImageManager.loadSystem('GameOver');
        };
    }

    //-------------------------------------------------------------------------
    // After-Game-Over behaviour: reload last save and/or a common event.
    //-------------------------------------------------------------------------
    var _Scene_Gameover_gotoTitle = Scene_Gameover.prototype.gotoTitle;
    Scene_Gameover.prototype.gotoTitle = function () {
        if (CFG.RELOAD) {
            var saveId = DataManager.lastAccessedSavefileId();
            if (DataManager.isThisGameFile(saveId)) {
                DataManager.loadGame(saveId);
                $gamePlayer.requestMapReload();
                $gameScreen.startFadeOut(1); // start the next scene blacked out
                SceneManager.goto(Scene_Map);
                if (CFG.AFTER_EVENT > 0) {
                    $gameTemp.reserveCommonEvent(CFG.AFTER_EVENT);
                } else {
                    // Transfer to where we already are, so BGM, map fade-in
                    // and friends are set up properly.
                    $gamePlayer.reserveTransfer($gameMap.mapId(),
                        $gamePlayer.x, $gamePlayer.y, $gamePlayer.direction(),
                        0);
                    $gameScreen.startFadeIn(this.slowFadeSpeed());
                }
                return;
            }
            // Never saved - the title screen is the only way out.
        } else if (CFG.AFTER_EVENT > 0) {
            $gameScreen.startFadeOut(1);
            $gameParty.reviveLeader();
            $gameTemp.reserveCommonEvent(CFG.AFTER_EVENT);
            SceneManager.goto(Scene_Map);
            return;
        }
        _Scene_Gameover_gotoTitle.call(this);
    };

    //=========================================================================
    // Party death handling
    //=========================================================================

    Game_Party.prototype.reviveLeader = function () {
        if (this.isAllDead()) {
            var leader = this.leader();
            if (leader) {
                leader.setHp(1);
                leader.clearStates();
            }
        }
    };

    var _BattleManager_processDefeat = BattleManager.processDefeat;
    BattleManager.processDefeat = function () {
        if (CFG.DEATH_EVENT > 0 && !this._canLose) {
            this.displayDefeatMessage();
            this.playDefeatMe();
            AudioManager.stopBgm();
            $gameParty.reviveLeader();
            $gameTemp.reserveCommonEvent(CFG.DEATH_EVENT);
            // Run the reserved common event inside the battle. The battle only
            // ends if the common event says so.
            $gameTroop.setupBattleEvent();
            return;
        }
        _BattleManager_processDefeat.call(this);
    };

    var _Scene_Base_checkGameover = Scene_Base.prototype.checkGameover;
    Scene_Base.prototype.checkGameover = function () {
        if (CFG.DEATH_EVENT > 0 && $gameParty.isAllDead()) {
            $gameParty.reviveLeader();
            $gameTemp.reserveCommonEvent(CFG.DEATH_EVENT);
            return;
        }
        _Scene_Base_checkGameover.call(this);
    };

    //=========================================================================
    // Plugin commands
    //=========================================================================

    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (String(command).toLowerCase() !== 'gameover') { return; }
        var what = String(args[0] || '').toLowerCase();
        var state = String(args[1] || '').toLowerCase();
        var value;
        if (state === 'on' || state === 'true' || state === '1') {
            value = true;
        } else if (state === 'off' || state === 'false' || state === '0') {
            value = false;
        } else if (state === 'toggle') {
            value = !(what === 'showscene' ? CFG.SHOW_SCENE : CFG.RELOAD);
        } else {
            return;
        }
        if (what === 'reload') { CFG.RELOAD = value; }
        else if (what === 'showscene') { CFG.SHOW_SCENE = value; }
    };

    console.log('[MonlineGameOver] loaded');
}());
