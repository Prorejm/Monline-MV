//=============================================================================
// MonlineUIStyle.js
//=============================================================================
/*:
 * @plugindesc Give the ported project a modern, MV-native presentation layer.
 * @author Monline port
 *
 * @help
 * The port is faithful before it is pretty: every third-party system was made
 * to *work* first, and the presentation layer was left as whatever VX Ace had
 * in 2011.  This plugin (plus a few data fields) is where the modernisation
 * happens.  Everything here is cosmetic - removing it must not break gameplay.
 *
 * ---------------------------------------------------------------------------
 * 1. Font
 * ---------------------------------------------------------------------------
 * MV picks the UI font from `$dataSystem.locale`, NOT from a font field:
 * `Window_Base#standardFontFace` returns 'SimHei...' for a `zh` locale,
 * 'Dotum...' for `ko`, and otherwise the literal 'GameFont'.  MV's bundled
 * `GameFont` is **M+ 1m**, a 2000s-era Japanese face - which is exactly the
 * dated look this pass exists to remove, and there is no data field to change
 * it with.  So the font is overridden here.
 *
 * The stack leads with the modern system UI faces and keeps CJK-capable faces
 * behind them, so Latin text is crisp today and a future Chinese localisation
 * still resolves instead of falling back to a default serif.
 *
 * ---------------------------------------------------------------------------
 * 2. Window tone
 * ---------------------------------------------------------------------------
 * `System.json` shipped VX Ace's purple window tint (`[34,0,34,0]`).  With MV's
 * own blue window skin that reads as muddy; it is reset to MV's default
 * `[0,0,0,0]` in the data (see the report).  The value is not forced here so
 * the project stays data-driven and a future style change is one JSON edit.
 *
 * ---------------------------------------------------------------------------
 * What is NOT here
 * ---------------------------------------------------------------------------
 * `Window.png` / `Balloon.png` are MV RTP files now (replaced on disk), and the
 * IconSet is handled by MonlineIconSet.js.  This plugin only covers what has to
 * be done in code.
 */

var MonlineUIStyle = MonlineUIStyle || {};

(function() {
    'use strict';

    // Leading faces are the modern system UI fonts; the trailing ones keep CJK
    // coverage so a Chinese localisation does not silently fall back to a serif.
    var FONT_STACK = [
        'Segoe UI',            // Windows 10/11 system UI - crisp Latin
        'Microsoft YaHei UI',  // Windows CJK
        'Microsoft YaHei',
        'PingFang SC',         // macOS CJK
        'Hiragino Sans GB',
        'Noto Sans SC',        // Linux / Android
        'Helvetica Neue',
        'Arial',
        'sans-serif'
    ].join(', ');

    Window_Base.prototype.standardFontFace = function() {
        return FONT_STACK;
    };

    MonlineUIStyle.FONT_STACK = FONT_STACK;
})();
