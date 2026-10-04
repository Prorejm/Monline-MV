//=============================================================================
// MonlineIconSet.js
//=============================================================================
/*:
 * @plugindesc Read the ported VX Ace IconSet at its real cell size, in chunks.
 * @author Monline port
 *
 * @help
 * The game ships a custom 384 x 20000 IconSet on the **VX Ace 24px grid**
 * (16 columns).  MV makes two assumptions that both break on it, and neither
 * one throws - they just make every icon wrong or invisible:
 *
 *  1. `Window_Base._iconWidth = 32` (`js/rpg_windows.js:30`) and
 *     `Sprite_StateIcon._iconWidth = 32` are hard-coded.  Sampling a 32px cell
 *     out of a 24px grid crops each icon and pulls in a third of its neighbour,
 *     and columns 12..15 (x >= 384) fall off the 384px-wide sheet entirely.
 *
 *  2. A 20000px-tall texture exceeds `MAX_TEXTURE_SIZE` (16384 on most GPUs,
 *     8192 on the ANGLE path).  PIXI refuses the upload, so under WebGL the
 *     whole sheet draws as nothing.
 *
 * The fix is deliberately *not* to rescale the art: 24 -> 32 is a 4/3
 * non-integer scale and resampling turns crisp pixel icons ragged.  Instead:
 *
 *  - tell the engine the real cell size (MV derives all of its icon layout from
 *    those two constants, so nothing else drifts),
 *  - cut the sheet into texture-safe chunks with `split_iconset.py`
 *    (chunk 0 keeps the plain `IconSet` name), and
 *  - pick the chunk per icon row in the only two places MV reads the sheet.
 *
 * Verified with `_shots/probe_icons.js`, which draws real icons through the real
 * engine and counts the pixels that come back.
 *
 * KNOWN GAP: an `iconIndex` beyond the sheet (>= 833 * 16) resolves to a chunk
 * file that does not exist; MonlineAssetGuard degrades it to a blank icon
 * rather than crashing.  The game's highest reference is 13321, in range.
 */

var MonlineIconSet = MonlineIconSet || {};

(function() {
    'use strict';

    // These three must match split_iconset.py.  They are the only coupling
    // between the image processing and the runtime.
    var CELL = 24;              // the game's real icon cell (VX Ace grid)
    var COLUMNS = 16;           // MV's icon sheets are always 16 columns
    var ROWS_PER_CHUNK = 256;   // 256 * 24 = 6144px, safe on an 8192-limit GPU

    MonlineIconSet.CELL = CELL;
    MonlineIconSet.COLUMNS = COLUMNS;
    MonlineIconSet.ROWS_PER_CHUNK = ROWS_PER_CHUNK;

    function sheetName(chunk) {
        // chunk 0 keeps the plain name so MV's own preload
        // (`ImageManager.reserveSystem('IconSet')`) still fetches a real file.
        return chunk === 0 ? 'IconSet' : 'IconSet_' + chunk;
    }

    /** Which chunk holds this icon, and where inside it. */
    MonlineIconSet.frameFor = function(iconIndex) {
        var index = Math.max(0, Math.floor(iconIndex || 0));
        var row = Math.floor(index / COLUMNS);
        var chunk = Math.floor(row / ROWS_PER_CHUNK);
        return {
            chunk: chunk,
            sx: (index % COLUMNS) * CELL,
            sy: (row - chunk * ROWS_PER_CHUNK) * CELL,
            width: CELL,
            height: CELL
        };
    };

    MonlineIconSet.bitmapFor = function(iconIndex) {
        return ImageManager.loadSystem(sheetName(MonlineIconSet.frameFor(iconIndex).chunk));
    };

    //-------------------------------------------------------------------------
    // 1. Tell the engine the truth about the grid.
    //-------------------------------------------------------------------------
    Window_Base._iconWidth = CELL;
    Window_Base._iconHeight = CELL;
    Sprite_StateIcon._iconWidth = CELL;
    Sprite_StateIcon._iconHeight = CELL;

    //-------------------------------------------------------------------------
    // 2. The two consumers of the sheet.
    //-------------------------------------------------------------------------
    Window_Base.prototype.drawIcon = function(iconIndex, x, y) {
        var f = MonlineIconSet.frameFor(iconIndex);
        this.contents.blt(MonlineIconSet.bitmapFor(iconIndex),
                          f.sx, f.sy, f.width, f.height, x, y);
    };

    // `Sprite_StateIcon` (the battle status icons) reads the sheet directly
    // instead of going through drawIcon, so it needs the chunk switch too.  A
    // chunk change means swapping the whole bitmap, which is why this cannot
    // stay a `setFrame` on a fixed bitmap.
    Sprite_StateIcon.prototype.loadBitmap = function() {
        this.bitmap = ImageManager.loadSystem(sheetName(0));
        this.setFrame(0, 0, 0, 0);
    };

    Sprite_StateIcon.prototype.updateFrame = function() {
        var f = MonlineIconSet.frameFor(this._iconIndex);
        var bmp = MonlineIconSet.bitmapFor(this._iconIndex);
        if (this.bitmap !== bmp) { this.bitmap = bmp; }
        this.setFrame(f.sx, f.sy, f.width, f.height);
    };

    //-------------------------------------------------------------------------
    // 3. Warm every chunk.
    //
    // MV preloads only `IconSet`, so without this the first draw of any icon
    // above row 255 would be a blank frame on a real (WebGL) machine and the
    // player would see icons pop in as they browse the menu.
    //-------------------------------------------------------------------------
    var CHUNKS = 4;   // 833 rows / 256 -> 4; split_iconset.py prints the count
    for (var i = 1; i < CHUNKS; i++) {
        ImageManager.loadSystem(sheetName(i));
    }
})();
