//=============================================================================
// MonlineBattleLog.js
//=============================================================================
//
// `SceneManager.scene.log_window.add_text("...")` followed by
// `SceneManager.scene.log_window.wait_and_clear` appears 88 times (176
// references) in Troops.json and CommonEvents.json.
//
// Until now `log_window` was a permissive stub on Scene_Base: every one of
// those lines was swallowed and the player never saw any of it.  In VX Ace it
// is `Scene_Battle`'s `Window_BattleLog`, so the text belongs on screen during
// battle - it is the game's battle narration ("The Mimic's body has turned to
// metal!").
//
// Ported:
//   Scene_Battle#log_window            -> the real MV Window_BattleLog
//   Window_BattleLog#add_text(text)    -> push a line and refresh (no wait;
//                                         Ruby's `add_text` does not wait)
//   Window_BattleLog#wait_and_clear    -> queue a clear, then wait, exactly
//                                         like VX Ace, so the line is readable
//                                         before it disappears.
//
// On a non-battle scene VX Ace would raise NoMethodError; nothing in the data
// does that, so we keep the bridge's neutral stand-in rather than crashing.
//=============================================================================

/*:
 * @plugindesc Real battle log window for SceneManager.scene.log_window.add_text / wait_and_clear.
 * @author Monline port
 */

(function () {
    'use strict';

    // VX Ace `Window_BattleLog#add_text` - put the line on screen and refresh.
    // MV's own `addText` additionally waits, which would double the delay once
    // `wait_and_clear` waits again, so the Ruby spelling is bound to the Ruby
    // behaviour and MV's `addText` is left untouched.
    Window_BattleLog.prototype.add_text = function (text) {
        this._lines.push(text);
        this.refresh();
    };

    // VX Ace `wait_and_clear`: wait, then clear once the wait runs out.
    Window_BattleLog.prototype.wait_and_clear = function () {
        this.push('clear');
        this.wait();
    };

    // `Scene_Battle#log_window` - the real window.
    Object.defineProperty(Scene_Battle.prototype, 'log_window', {
        configurable: true,
        get: function () {
            if (this._logWindow) { return this._logWindow; }
            // Before createLogWindow() / after dispose the Ruby would have
            // handed back nil and crashed.  Fall back to the neutral stand-in
            // the bridge already keeps on Scene_Base instead.
            if (!this._monlineLogWindow) {
                var MR = window.MonlineRuby;
                if (MR && typeof MR.permissiveStub === 'function') {
                    this._monlineLogWindow = MR.permissiveStub('log_window');
                } else {
                    var self = this;
                    this._monlineLogWindow = {
                        add_text: function () { return self; },
                        wait_and_clear: function () { return true; },
                        wait: function () { return true; },
                        clear: function () { return true; }
                    };
                }
            }
            return this._monlineLogWindow;
        }
    });

    console.log('[MonlineBattleLog] loaded');
})();
