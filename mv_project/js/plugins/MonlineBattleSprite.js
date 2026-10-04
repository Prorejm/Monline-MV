//=============================================================================
// MonlineBattleSprite.js
//-----------------------------------------------------------------------------
// Two small battle-sprite scripts Monline's troop events drive, and which the
// census found still being swallowed by the Ruby bridge's auto-stub:
//
//   0238.rb  HimeWorks "Enemy Re-position"  (11 call sites)
//     position_enemy(index, x, y)      absolute screen position
//     move_enemy(index, x, y)          relative to where the sprite is now
//     enemy_index is 1-based: 1 is the first enemy of the troop
//
//   0256.rb  HimeWorks "Battle Sprite Zoom"  (9 call sites)
//     zoom_enemy_sprite(index, zoom)          or
//     zoom_enemy_sprite(index, zoom_x, zoom_y)
//
// Both were flagged because an unknown call in a script block does not throw -
// it is answered by a stub - so the battle simply carried on with the enemy
// standing in its default spot at default size.
//=============================================================================

/*:
 * @plugindesc Monline's battle sprite controls (0238/0256.rb): move and zoom
 * enemy sprites from troop events.
 * @author Monline MV port
 *
 * @param Move Speed
 * @desc Pixels per frame the sprite glides toward a new position.
 * @default 12
 *
 * @help Troop event script calls:
 *
 *   position_enemy(1, 400, 300)      move the first enemy to (400, 300)
 *   move_enemy(1, 0, 55)             shift the first enemy down 55 pixels
 *   zoom_enemy_sprite(1, 0.25)       quarter size
 *   zoom_enemy_sprite(1, 2, 1)       twice as wide, normal height
 *
 * The index is 1-based, matching the original scripts.
 */

var MonlineBattleSprite = MonlineBattleSprite || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineBattleSprite');
    var speed = parseInt(parameters['Move Speed'], 10);
    var CFG = { MOVE_SPEED: isNaN(speed) ? 12 : speed };
    MonlineBattleSprite.CFG = CFG;

    //-------------------------------------------------------------------------
    // Per-enemy sprite state
    //-------------------------------------------------------------------------
    function stateOf(battler) {
        if (!battler._mbs) {
            battler._mbs = {
                targetX: null, targetY: null, moving: false,
                curX: null, curY: null,
                zoomX: 1, zoomY: 1
            };
        }
        return battler._mbs;
    }
    MonlineBattleSprite.stateOf = stateOf;

    function troopEnemy(index) {
        var i = parseInt(index, 10);
        if (isNaN(i) || i < 1) { return null; }
        return $gameTroop.members()[i - 1] || null;
    }

    function baseOf(battler) {
        var st = stateOf(battler);
        if (st.curX === null) { st.curX = battler.screenX(); }
        if (st.curY === null) { st.curY = battler.screenY(); }
        return st;
    }

    //-------------------------------------------------------------------------
    // Script calls
    //-------------------------------------------------------------------------
    /** Absolute position, relative to the top-left of the screen. */
    window.position_enemy = function (index, x, y) {
        var e = troopEnemy(index);
        if (!e) { return false; }
        var st = baseOf(e);
        st.targetX = parseFloat(x) || 0;
        st.targetY = parseFloat(y) || 0;
        st.moving = true;
        return true;
    };

    /** Relative shift from wherever the sprite currently is. */
    window.move_enemy = function (index, x, y) {
        var e = troopEnemy(index);
        if (!e) { return false; }
        var st = baseOf(e);
        st.targetX = st.curX + (parseFloat(x) || 0);
        st.targetY = st.curY + (parseFloat(y) || 0);
        st.moving = true;
        return true;
    };

    /** 1 is normal size, 0.5 half, 2 double. Separate x/y is allowed. */
    window.zoom_enemy_sprite = function (index, zoomX, zoomY) {
        var e = troopEnemy(index);
        if (!e) { return false; }
        var st = stateOf(e);
        var zx = parseFloat(zoomX);
        if (isNaN(zx)) { zx = 1; }
        var zy = parseFloat(zoomY);
        st.zoomX = zx;
        st.zoomY = isNaN(zy) ? zx : zy;
        return true;
    };

    // The originals are Game_Interpreter methods; expose them there too, and
    // in the Ruby bridge's function table - that is the table event script
    // blocks resolve bare names against, and without it a troop event calling
    // `move_enemy(1, 0, 55)` is answered by the bridge's auto-stub and does
    // nothing at all.
    ['position_enemy', 'move_enemy', 'zoom_enemy_sprite'].forEach(function (n) {
        Game_Interpreter.prototype[n] = window[n];
        if (window.MonlineRuby && MonlineRuby.F) {
            MonlineRuby.F[n] = window[n];
        }
    });

    //-------------------------------------------------------------------------
    // Sprite_Battler
    //-------------------------------------------------------------------------
    var _Sprite_Battler_updatePosition =
        Sprite_Battler.prototype.updatePosition;
    Sprite_Battler.prototype.updatePosition = function () {
        _Sprite_Battler_updatePosition.call(this);
        var b = this._battler;
        if (!b || !b.isEnemy || !b.isEnemy()) { return; }
        var st = stateOf(b);
        // Remember where the sprite actually is, so a later relative
        // move_enemy() measures from the current spot rather than the
        // position the troop gave it at setup.
        st.curX = this._homeX;
        st.curY = this._homeY;
        if (st.moving && st.targetX !== null) {
            var dx = st.targetX - this._homeX;
            var dy = st.targetY - this._homeY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= CFG.MOVE_SPEED || dist === 0) {
                this._homeX = st.targetX;
                this._homeY = st.targetY;
                st.moving = false;
            } else {
                this._homeX += dx / dist * CFG.MOVE_SPEED;
                this._homeY += dy / dist * CFG.MOVE_SPEED;
            }
            this.x = this._homeX + this._offsetX;
            this.y = this._homeY + this._offsetY;
            st.curX = this._homeX;
            st.curY = this._homeY;
        }
        this.scale.x = st.zoomX;
        this.scale.y = st.zoomY;
    };

    // A new battle brings new Game_Enemy objects, so the state above starts
    // fresh - nothing to reset.

    console.log('[MonlineBattleSprite] loaded');
}());
