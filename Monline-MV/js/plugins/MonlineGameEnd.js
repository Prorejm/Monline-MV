//=============================================================================
// MonlineGameEnd.js
//=============================================================================
/*:
 * @plugindesc The game-end screen of Monline 0.9.8 (0103.rb Scene_End,
 * 0087.rb Window_GameEnd) plus the Shut Down command of the title screen
 * (0086.rb / 0263.rb / 0091.rb).
 * @author Monline port
 *
 * @param Shut Down Text
 * @desc Label of the Shut Down command.  VX Ace reads Vocab::shutdown; MV has
 * no such entry, so the wording is configurable.
 * @default Shut Down
 *
 * @param Title Shut Down
 * @desc Offer Shut Down on the title screen, as 0086.rb does.
 * @default true
 * @type boolean
 *
 * @param Game End Shut Down
 * @desc Offer Shut Down in the menu's Exit Game screen, as 0087.rb does.
 * @default true
 * @type boolean
 *
 * @param Confirm Shut Down
 * @desc Ask first, instead of quitting on the press.  Off matches the
 * original exactly.
 * @default false
 * @type boolean
 *
 * @param Confirm Text
 * @desc Question shown when Confirm Shut Down is on.
 * @default Shut down the game?
 *
 * @param Browser Fallback
 * @desc When window.close() does nothing (any plain browser tab), show a
 * readable "you may close this window" card instead of a black screen.
 * @default true
 * @type boolean
 *
 * @param Quit Message
 * @desc The fallback card's main line.
 * @default Monline has shut down.\nYou may close this window.
 *
 * @param Back Text
 * @desc Label of the fallback card's button that reopens the title screen.
 * @default Back to Title
 *
 * @help
 * What this ports
 *
 *   0087.rb Window_GameEnd#make_command_list builds THREE commands -
 *
 *       Vocab::to_title    -> :to_title
 *       Vocab::shutdown    -> :shutdown
 *       Vocab::cancel      -> :cancel
 *
 *   while MV's stock Window_GameEnd only builds two (toTitle, cancel).  So the
 *   original's Exit Game screen can end the process outright and MV's cannot.
 *
 *   0103.rb Scene_End then maps them -
 *
 *       :to_title   -> fadeout_all + SceneManager.goto(Scene_Title)
 *       :shutdown   -> fadeout_all + SceneManager.exit
 *       :cancel     -> return_scene
 *
 *   Scene_End#create_background sets the backdrop tone to (0,0,0,128); MV's
 *   Scene_GameEnd already does the same thing through setBackgroundOpacity(128),
 *   so nothing needs changing there.
 *
 *   0086.rb Window_TitleCommand likewise lists New Game / Continue / Shut Down,
 *   and the cheat script 0263.rb rewrites that same method to read
 *   New Game / Continue / Passwords / Shut Down - MonlineCheatCodes.js already
 *   adds the middle entry, this plugin adds the last one.  0091.rb:133 supplies
 *   the handler that Scene_Title was missing.
 *
 * Window width
 *   0087.rb asks for a 160px window; MV's Window_GameEnd already uses 240px and
 *   a third row would clip at the narrower size, so the wider one is kept.
 *
 * The browser fallback
 *   SceneManager.exit() blanks the scene and calls window.close(), which only
 *   works for windows a script opened.  In a normal tab nothing is left on
 *   screen at all - the game looks hung.  With Browser Fallback on, the plugin
 *   waits a moment and, if the page is still there, draws the Quit Message and
 *   a button that clears SceneManager._exiting and returns to Scene_Title.
 *
 * Public API
 *   MonlineGameEnd.quit()        - run the shutdown sequence
 *   Scene_GameEnd.prototype.commandShutdown
 *   Scene_Title.prototype.commandShutdown
 *   Ruby bridge: shutdown_game()
 */
(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Parameters
    //-------------------------------------------------------------------------
    var P = (typeof PluginManager !== 'undefined' && PluginManager.parameters)
        ? PluginManager.parameters('MonlineGameEnd') : {};
    function str(k, d) { return P[k] === undefined || P[k] === '' ? d : String(P[k]); }
    function bool(k, d) { var v = P[k]; return v === undefined ? d : (v === 'true' || v === true); }

    var CFG = {
        label: str('Shut Down Text', 'Shut Down'),
        onTitle: bool('Title Shut Down', true),
        onGameEnd: bool('Game End Shut Down', true),
        confirm: bool('Confirm Shut Down', false),
        confirmText: str('Confirm Text', 'Shut down the game?'),
        fallback: bool('Browser Fallback', true),
        quitMessage: str('Quit Message', 'Monline has shut down.\nYou may close this window.'),
        backText: str('Back Text', 'Back to Title')
    };

    var OVERLAY_ID = 'monline-quit-overlay';

    //-------------------------------------------------------------------------
    // The shutdown sequence - 0091.rb:133 / implicit in 0103.rb:56
    //-------------------------------------------------------------------------
    function removeOverlay() {
        var el = document.getElementById(OVERLAY_ID);
        if (el && el.parentNode) { el.parentNode.removeChild(el); }
    }

    function showQuitOverlay() {
        if (!CFG.fallback || typeof document === 'undefined') { return; }
        try {
            if (window.closed) { return; }
        } catch (e) { return; }
        if (document.getElementById(OVERLAY_ID)) { return; }

        var wrap = document.createElement('div');
        wrap.id = OVERLAY_ID;
        wrap.style.cssText = [
            'position:fixed', 'left:0', 'top:0', 'width:100%', 'height:100%',
            'z-index:100', 'background:#0d0b12', 'color:#f4e9d8',
            'display:flex', 'flex-direction:column', 'align-items:center',
            'justify-content:center', 'gap:26px', 'text-align:center',
            'font-family:GameFont,"mplus-1m-regular",monospace',
            'font-size:26px', 'line-height:1.6', 'letter-spacing:1px'
        ].join(';');

        String(CFG.quitMessage).split('\\n').forEach(function (line, i, arr) {
            var row = document.createElement('div');
            row.textContent = line;
            if (i === 0) { row.style.fontSize = '32px'; }
            if (i === arr.length - 1) { row.style.opacity = '0.72'; }
            wrap.appendChild(row);
        });

        if (CFG.backText) {
            var btn = document.createElement('div');
            btn.textContent = CFG.backText;
            btn.style.cssText = [
                'margin-top:8px', 'padding:10px 22px', 'cursor:pointer',
                'border:2px solid #c8a45c', 'border-radius:4px',
                'color:#c8a45c', 'font-size:22px', 'background:rgba(0,0,0,0.3)'
            ].join(';');
            btn.addEventListener('mouseenter', function () {
                btn.style.background = 'rgba(200,164,92,0.18)';
            });
            btn.addEventListener('mouseleave', function () {
                btn.style.background = 'rgba(0,0,0,0.3)';
            });
            btn.addEventListener('click', function () {
                removeOverlay();
                // SceneManager.exit() left a flag that would re-terminate any
                // scene we moved to, so it has to be cleared before going back.
                SceneManager._exiting = false;
                SceneManager.goto(Scene_Title);
            });
            wrap.appendChild(btn);
        }

        document.body.appendChild(wrap);
    }

    // Runs 0091.rb:133 command_shutdown regardless of which scene called it.
    function quit(scene) {
        if (scene && scene._commandWindow) { scene._commandWindow.close(); }
        if (scene && scene.fadeOutAll) { scene.fadeOutAll(); }
        SceneManager.exit();
        // window.close() only affects script-opened windows.  Give it a beat
        // and then tell the player something readable instead of nothing.
        if (typeof window !== 'undefined' && typeof Utils !== 'undefined' &&
            !Utils.isNwjs()) {
            setTimeout(showQuitOverlay, 420);
        }
    }

    //-------------------------------------------------------------------------
    // Confirmation - an added nicety, off by default
    //
    // A confirmation like this cannot go through $gameMessage: neither
    // Scene_GameEnd nor Scene_Title owns a message window, so the text would be
    // queued and never drawn.  A tiny own scene works from both.
    //-------------------------------------------------------------------------
    function Window_ShutDownConfirm() {
        this.initialize.apply(this, arguments);
    }

    Window_ShutDownConfirm.prototype = Object.create(Window_Command.prototype);
    Window_ShutDownConfirm.prototype.constructor = Window_ShutDownConfirm;

    Window_ShutDownConfirm.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.updatePlacement();
        this.openness = 0;
        this.open();
    };

    // One extra row carries the question; the two commands are pushed below it.
    Window_ShutDownConfirm.prototype.windowHeight = function () {
        return this.fittingHeight(CFG.confirmText ? 3 : 2);
    };

    Window_ShutDownConfirm.prototype.itemRect = function (index) {
        var r = Window_Command.prototype.itemRect.call(this, index);
        if (CFG.confirmText) { r.y += this.lineHeight(); }
        return r;
    };

    Window_ShutDownConfirm.prototype.windowWidth = function () { return 360; };

    Window_ShutDownConfirm.prototype.updatePlacement = function () {
        this.x = (Graphics.boxWidth - this.width) / 2;
        this.y = (Graphics.boxHeight - this.height) / 2;
    };

    Window_ShutDownConfirm.prototype.makeCommandList = function () {
        this.addCommand(CFG.label, 'yes');
        this.addCommand(TextManager.cancel, 'cancel');
    };

    Window_ShutDownConfirm.prototype.refresh = function () {
        Window_Command.prototype.refresh.call(this);
        if (CFG.confirmText) {
            this.drawText(CFG.confirmText, 0, 0, this.contentsWidth(), 'center');
        }
    };

    function Scene_ShutDownConfirm() {
        this.initialize.apply(this, arguments);
    }

    Scene_ShutDownConfirm.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_ShutDownConfirm.prototype.constructor = Scene_ShutDownConfirm;

    Scene_ShutDownConfirm.prototype.initialize = function () {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_ShutDownConfirm.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        this._confirmWindow = new Window_ShutDownConfirm();
        // Cancel is the default so an absent-minded Enter never quits.
        this._confirmWindow.select(1);
        this._confirmWindow.setHandler('yes', this.onAccept.bind(this));
        this._confirmWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._confirmWindow);
    };

    Scene_ShutDownConfirm.prototype.onAccept = function () {
        this.popScene();
        quit(null);
    };

    function requestQuit(scene) {
        if (!CFG.confirm) { quit(scene); return; }
        SceneManager.push(Scene_ShutDownConfirm);
    }

    //-------------------------------------------------------------------------
    // Window_GameEnd - 0087.rb:33 : to_title / shutdown / cancel
    //-------------------------------------------------------------------------
    if (CFG.onGameEnd) {
        var _gameEndMakeCommandList = Window_GameEnd.prototype.makeCommandList;
        Window_GameEnd.prototype.makeCommandList = function () {
            _gameEndMakeCommandList.call(this);
            // Same guard as MonlineCheatCodes: MV rebuilds the list more than
            // once before the window exists, so a once-flag drops the entry.
            var list = this._list;
            for (var n = 0; n < list.length; n++) {
                if (list[n].symbol === 'shutdown') { return; }
            }
            var at = list.length;
            for (var i = 0; i < list.length; i++) {
                if (list[i].symbol === 'cancel') { at = i; break; }
            }
            list.splice(at, 0, {
                name: CFG.label, symbol: 'shutdown', enabled: true, ext: null
            });
        };

        var _gameEndCreateCommandWindow =
            Scene_GameEnd.prototype.createCommandWindow;
        Scene_GameEnd.prototype.createCommandWindow = function () {
            _gameEndCreateCommandWindow.call(this);
            this._commandWindow.setHandler('shutdown',
                this.commandShutdown.bind(this));
        };

        // 0103.rb:56 command_shutdown
        Scene_GameEnd.prototype.commandShutdown = function () {
            requestQuit(this);
        };
    }

    //-------------------------------------------------------------------------
    // Title screen - 0086.rb:37 / 0263.rb / 0091.rb:95,133
    //-------------------------------------------------------------------------
    if (CFG.onTitle) {
        var _titleMakeCommandList = Window_TitleCommand.prototype.makeCommandList;
        Window_TitleCommand.prototype.makeCommandList = function () {
            _titleMakeCommandList.call(this);
            var list = this._list;
            for (var n = 0; n < list.length; n++) {
                if (list[n].symbol === 'shutdown') { return; }
            }
            list.push({
                name: CFG.label, symbol: 'shutdown', enabled: true, ext: null
            });
        };

        var _titleCreateCommandWindow = Scene_Title.prototype.createCommandWindow;
        Scene_Title.prototype.createCommandWindow = function () {
            _titleCreateCommandWindow.call(this);
            this._commandWindow.setHandler('shutdown',
                this.commandShutdown.bind(this));
        };

        // 0091.rb:133 command_shutdown
        Scene_Title.prototype.commandShutdown = function () {
            requestQuit(this);
        };
    }

    //-------------------------------------------------------------------------
    // Public surface
    //-------------------------------------------------------------------------
    var api = {
        quit: function () { quit(SceneManager._scene); },
        request: function () { requestQuit(SceneManager._scene); },
        label: CFG.label,
        overlay: showQuitOverlay,
        clearOverlay: removeOverlay
    };
    window.MonlineGameEnd = api;

    if (window.MonlineRuby && MonlineRuby.F) {
        MonlineRuby.F.shutdown_game = function () { api.quit(); return true; };
    }

    console.log('[MonlineGameEnd] loaded - game end ' +
        (CFG.onGameEnd ? 'with' : 'without') + ' shutdown, title ' +
        (CFG.onTitle ? 'with' : 'without') + ' shutdown');
})();
