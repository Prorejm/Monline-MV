//=============================================================================
// MonlineEventSkipper.js
//=============================================================================
/*:
 * @plugindesc Hold-to-skip mode for skippable cutscenes and messages.
 * @author Monline port
 *
 * @help
 * Port of the TSF Dungeon reference build's EventSkipper.js (v7.3, "TSF
 * Dungeon / Gemini"), with the plumbing changed to suit this project:
 *
 *   * TSF drives the mode through a game switch so its common events can see
 *     it; Monline has no such common event, so the master state is a flag on
 *     $gameSystem (it saves with the game) and the switch is optional.
 *   * The Yanfly MoveRouteCore interception is dropped - this project does
 *     not run that plugin.
 *
 * Everything else is the reference's behaviour:
 *   * Ctrl (configurable) toggles Skip Mode; a small "Skip Mode: ON" notice
 *     is drawn in the top left while it is on;
 *   * while it is on, skippable events run at full speed: Show Text, Show
 *     Scrolling Text, scroll/look routes, waits, fade/flash/shake, sounds
 *     that only pad the scene, transfers and the battle-call commands are
 *     consumed instantly, and forced move routes are processed in one go;
 *   * an event is skippable when its page note carries the tag below, or
 *     when it is one of the whitelisted common events;
 *   * choices, number input and item selection stop the skip - the game
 *     never skips a question it asked.
 *
 * Map event note:  <skippable>
 * Plugin command:  SkipMode on / SkipMode off / SkipMode toggle
 *
 * @param Map Event Note Tag
 * @desc Note tag that makes a map event skippable.
 * @default <skippable>
 *
 * @param Skippable Common Event IDs
 * @desc Common events that may be skipped, comma separated.
 * @default
 *
 * @param Skip Switch ID
 * @desc A switch that mirrors the mode for event conditions. 0 = none.
 * @default 0
 *
 * @param Toggle Keycode
 * @desc Key that toggles Skip Mode. 17 is Ctrl.
 * @default 17
 *
 * @param Indicator Text
 * @desc Text shown while Skip Mode is on.
 * @default Skip Mode: ON
 */
//=============================================================================

var MonlineEventSkipper = MonlineEventSkipper || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineEventSkipper');
    var CFG = {
        NOTE_TAG: String(parameters['Map Event Note Tag'] || '<skippable>'),
        COMMON_IDS: String(parameters['Skippable Common Event IDs'] || '')
            .split(',').map(Number).filter(function (n) { return n > 0; }),
        SWITCH_ID: Number(parameters['Skip Switch ID'] || 0),
        KEYCODE: Number(parameters['Toggle Keycode'] || 17),
        INDICATOR: String(parameters['Indicator Text'] || 'Skip Mode: ON')
    };
    MonlineEventSkipper.CFG = CFG;

    if (CFG.KEYCODE > 0) {
        Input.keyMapper[CFG.KEYCODE] = 'monlineSkip';
    }

    //-------------------------------------------------------------------------
    // The mode itself
    //-------------------------------------------------------------------------
    function isSkipMode() {
        return !!($gameSystem && $gameSystem._eventSkipMode);
    }
    MonlineEventSkipper.isSkipMode = isSkipMode;

    function setSkipMode(state) {
        $gameSystem._eventSkipMode = !!state;
        if (CFG.SWITCH_ID > 0) {
            $gameSwitches.setValue(CFG.SWITCH_ID, !!state);
        }
    }
    MonlineEventSkipper.setSkipMode = setSkipMode;

    //-------------------------------------------------------------------------
    // What may be skipped (the reference's whitelist)
    //-------------------------------------------------------------------------
    // 101 Show Text          105 Show Scrolling Text
    // 204 Scroll Map         212 Show Animation    221 Fadeout Screen
    // 224 Flash Screen       225 Shake Screen      230 Wait
    // 242 Change BGM         246 Play Memory       249 Play SE
    // 250 Stop SE            251 Play Movie
    var COMMANDS_TO_SKIP = [101, 105, 204, 212, 221, 224, 225, 230,
                            242, 246, 249, 250, 251];

    function isEventSkippable(interpreter) {
        if (!interpreter) { return false; }
        if (interpreter._commonEventId > 0) {
            return CFG.COMMON_IDS.indexOf(interpreter._commonEventId) >= 0;
        }
        if (interpreter.eventId() > 0) {
            var ev = $gameMap.event(interpreter.eventId());
            return !!(ev && ev.event() && ev.event().note &&
                      ev.event().note.indexOf(CFG.NOTE_TAG) >= 0);
        }
        return false;
    }
    MonlineEventSkipper.isEventSkippable = isEventSkippable;
    MonlineEventSkipper.COMMANDS_TO_SKIP = COMMANDS_TO_SKIP;

    //-------------------------------------------------------------------------
    // Forced move routes, processed in one pass (the reference's
    // processRouteInstantly, minus the Yanfly interceptor)
    //-------------------------------------------------------------------------
    function processRouteInstantly(character) {
        if (!character || !character._moveRoute) { return; }
        var routeList = character._moveRoute.list;
        var maxIterations = routeList.length * 2;
        var iterations = 0;

        if (character.isMoving()) {
            character._realX = character.x;
            character._realY = character.y;
            character._moving = false;
        }

        while (character._moveRouteIndex < routeList.length &&
               iterations < maxIterations) {
            iterations++;
            var command = routeList[character._moveRouteIndex];
            if (!command || command.code === 0) { break; }
            if (command.code === 15) {          // Wait
                character._moveRouteIndex++;
                continue;
            }
            character.processMoveCommand(command);
            character._realX = character.x;
            character._realY = character.y;
            character._moving = false;
            character._jumpCount = 0;
            character._jumpPeak = 0;
            character._moveRouteIndex++;
        }

        character.refreshBushDepth();
        character._waitCount = 0;

        if (character._moveRouteForcing) {
            character._moveRouteForcing = false;
            character.restoreMoveRoute();
        } else {
            character._moveRoute = null;
            character._moveRouteIndex = 0;
        }
    }

    //-------------------------------------------------------------------------
    // Game_Character - routes run instantly while skipping
    //-------------------------------------------------------------------------
    var _Game_Character_update = Game_Character.prototype.update;
    Game_Character.prototype.update = function () {
        if (!$gameParty.inBattle() && isSkipMode() &&
                this.isMoveRouteForcing() && $gameMap.isEventRunning()) {
            processRouteInstantly(this);
            return;
        }
        _Game_Character_update.call(this);
    };

    //-------------------------------------------------------------------------
    // Game_Interpreter - eat the padding commands
    //-------------------------------------------------------------------------
    var _Game_Interpreter_executeCommand =
        Game_Interpreter.prototype.executeCommand;
    Game_Interpreter.prototype.executeCommand = function () {
        var command = this.currentCommand();
        if (command && isSkipMode() && isEventSkippable(this)) {
            // 102 Show Choices, 103 Input Number, 104 Select Item - the game
            // is about to ask something, so drop out of skip mode instead.
            if (command.code === 102 || command.code === 103 ||
                    command.code === 104) {
                setSkipMode(false);
            } else if (COMMANDS_TO_SKIP.indexOf(command.code) >= 0) {
                this._index++;
                return true;
            }
        }
        return _Game_Interpreter_executeCommand.call(this);
    };

    var _Game_Interpreter_command205 = Game_Interpreter.prototype.command205;
    Game_Interpreter.prototype.command205 = function () {
        if (isSkipMode() && isEventSkippable(this)) {
            var character = this.character(this._params[0]);
            if (character) {
                character.forceMoveRoute(this._params[1]);
                processRouteInstantly(character);
            }
            if (this._params[1] && this._params[1].wait) { this._waitCount = 0; }
            return true;
        }
        return _Game_Interpreter_command205.call(this);
    };

    //-------------------------------------------------------------------------
    // Scene_Map - the toggle, the indicator, and the fast message close
    //-------------------------------------------------------------------------
    var _Scene_Map_createWindowLayer = Scene_Map.prototype.createWindowLayer;
    Scene_Map.prototype.createWindowLayer = function () {
        _Scene_Map_createWindowLayer.call(this);
        this._skipIndicator = new Sprite(new Bitmap(300, 40));
        this._skipIndicator.x = 16;
        this._skipIndicator.y = 12;
        this._skipIndicator.visible = false;
        this.addChild(this._skipIndicator);
    };

    var _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
    Scene_Map.prototype.updateScene = function () {
        _Scene_Map_updateScene.call(this);
        if (this._skipIndicator) {
            var on = isSkipMode();
            if (this._skipIndicator.visible !== on) {
                this._skipIndicator.visible = on;
                if (on) {
                    var bmp = this._skipIndicator.bitmap;
                    bmp.clear();
                    bmp.fontSize = 20;
                    bmp.outlineColor = 'rgba(0,0,0,0.8)';
                    bmp.outlineWidth = 4;
                    bmp.drawText(CFG.INDICATOR, 0, 0, 290, 32, 'left');
                }
            }
        }
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        // the reference auto-offs BEFORE reading the toggle, so a mode switched
        // on while the player is free survives this frame and dies on the next
        // one unless a cutscene actually started
        if (isSkipMode() && $gamePlayer.canMove() &&
                !$gameMap.isEventRunning()) {
            setSkipMode(false);
        }
        if (CFG.KEYCODE > 0 && Input.isTriggered('monlineSkip')) {
            setSkipMode(!isSkipMode());
            SoundManager.playCursor();
            // closing the current message makes the effect feel immediate
            if (isSkipMode() && this._messageWindow && $gameMessage.isBusy()) {
                this._messageWindow.terminateMessage();
            }
        }
    };

    //-------------------------------------------------------------------------
    // Plugin commands
    //-------------------------------------------------------------------------
    var _Game_Interpreter_pluginCommand =
        Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command.toLowerCase() === 'skipmode') {
            var arg = (args[0] || '').toLowerCase();
            if (arg === 'on') { setSkipMode(true); }
            if (arg === 'off') { setSkipMode(false); }
            if (arg === 'toggle') { setSkipMode(!isSkipMode()); }
        }
    };

    console.log('[MonlineEventSkipper] loaded');
})();
