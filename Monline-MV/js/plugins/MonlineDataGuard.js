//=============================================================================
// MonlineDataGuard.js
//=============================================================================
/*:
 * @plugindesc Defensive guards for data shaped by the VX Ace -> MV conversion.
 * @author Monline MV port
 *
 * @help
 * The engine assumes the JSON it reads is well formed.  Converted data can be
 * malformed in ways that are not obvious until the exact code path runs, and an
 * uncaught exception inside the game loop stops the game for good.
 *
 * The one that actually bit us:
 *
 *   Sprite_Animation.prototype.updateCellSprite does
 *       sprite.opacity = cell[6];
 *   If a cell array is shorter than 8 entries, cell[6] is undefined and the
 *   Sprite opacity setter calls undefined.clamp(0, 255) -> TypeError ->
 *   SceneManager.catchException -> the whole game freezes.
 *
 * This plugin normalises animation cells (and any frame that is not an array)
 * before the engine sees them, so a bad cell degrades to "one neutral cell"
 * instead of a crash.
 */

(function() {
    'use strict';

    var TAG = 'MonlineDataGuard';

    // pattern, x, y, zoom, rotation, mirror, opacity, blendMode
    var NEUTRAL_CELL = [0, 0, 0, 100, 0, 0, 255, 0];

    var _updateCellSprite = Sprite_Animation.prototype.updateCellSprite;
    Sprite_Animation.prototype.updateCellSprite = function(sprite, cell) {
        if (!cell || typeof cell.length !== 'number') {
            sprite.visible = false;
            return;
        }
        if (cell.length < 8) {
            var pad = cell.slice(0, 8);
            for (var i = pad.length; i < 8; i++) {
                pad[i] = NEUTRAL_CELL[i];
            }
            if (typeof pad[0] !== 'number') {
                sprite.visible = false;
                return;
            }
            console.warn(TAG + ': padded a short animation cell (' + cell.length + ' -> 8)');
            cell = pad;
        }
        for (var j = 0; j < 8; j++) {
            if (typeof cell[j] !== 'number') {
                sprite.visible = false;
                return;
            }
        }
        return _updateCellSprite.call(this, sprite, cell);
    };

    var _updateAllCellSprites = Sprite_Animation.prototype.updateAllCellSprites;
    Sprite_Animation.prototype.updateAllCellSprites = function(frame) {
        if (!frame || typeof frame.length !== 'number') {
            this._cellSprites.forEach(function(sprite) { sprite.visible = false; });
            return;
        }
        return _updateAllCellSprites.call(this, frame);
    };
})();
