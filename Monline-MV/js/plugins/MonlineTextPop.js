//=============================================================================
// MonlineTextPop.js
//=============================================================================
/*:
 * @plugindesc VX Ace "N.A.S.T.Y. Text Pop Over Events" (Nelderson, 0230.rb) ported to MV.
 * @author Monline port
 *
 * @help
 * Port of Nelderson's "Text Pop Over Events" (source 0230.rb).  The game drives
 * it from event scripts with a hash call:
 *
 *     nel_textpop(
 *       :text     => "Arousal Up",
 *       :event_id => 13,      // 0 = this event, -1 = player, -2..-4 = followers
 *       :time     => 120,     // frames; nil/-1 => forever
 *     )
 *
 * Measured usage: 604 call sites (307 distinct text strings).  The data only
 * ever sets :text / :event_id / :time - size, color, font, bold and italic are
 * supported for completeness but never used here, so the port favours the
 * common path and still honours the rest when present.
 *
 * ---------------------------------------------------------------------------
 * Faithful behaviour
 * ---------------------------------------------------------------------------
 *   * The text floats above the character's head (one tile up) and follows it.
 *   * :time in frames; it fades out over the last 60 frames, then disappears.
 *     :time => nil / -1 (or omitted) keeps it up until replaced or cleared.
 *   * :event_id -1 targets the player, <-1 targets the Nth follower, 0 targets
 *     the running event, >0 targets that map event - exactly like the Ruby
 *     nel_get_character.
 *   * In battle the call is a no-op (the original returns nil there).
 *
 * The colour is stored as [r,g,b,a] and converted to an MV CSS colour string;
 * the font/size/bold/italic map onto Bitmap's own font fields.
 */

var MonlineTextPop = MonlineTextPop || {};

(function() {
    'use strict';

    var DEF_TEXT_FONT = 'Myriad';
    var DEF_TEXT_SIZE = 16;
    var DEF_TEXT_COLOR = [255, 255, 255, 255];

    //-------------------------------------------------------------------------
    // Colour helper
    //-------------------------------------------------------------------------
    function colorToCss(c) {
        if (Array.isArray(c)) {
            var a = (c.length >= 4 && c[3] !== undefined) ? c[3] / 255 : 1;
            return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' +
                   (c[2] | 0) + ',' + a + ')';
        }
        return typeof c === 'string' ? c : 'rgba(255,255,255,1)';
    }

    //-------------------------------------------------------------------------
    // Character resolution (mirrors VX Ace nel_get_character)
    //-------------------------------------------------------------------------
    function nelGetCharacter(evId, curEventId) {
        if (!$gameParty || $gameParty.inBattle()) { return null; }
        var id = (evId === undefined || evId === null) ? 0 : evId;
        if (id < 0) {
            if (id === -1) { return $gamePlayer; }
            var idx = (id + 2) * -1;            // -2 -> 0, -3 -> 1, -4 -> 2
            var f = $gamePlayer.followers();
            var data = (f && typeof f.data === 'function') ? f.data()
                      : (f ? f._data : null);
            return (data && data[idx]) ? data[idx] : null;
        }
        var eid = id > 0 ? id : curEventId;
        return $gameMap.event(eid);
    }

    function currentEventId() {
        var interp = (window.MonlineRuby && MonlineRuby.current) ||
                     (window.$gameMap && $gameMap._interpreter);
        if (interp && typeof interp.event_id === 'function') {
            return interp.event_id();
        }
        return 0;
    }

    //-------------------------------------------------------------------------
    // The call, hung on window because the scripts call it bare
    //-------------------------------------------------------------------------
    function nel_textpop(hash) {
        var curEventId = currentEventId();
        var args = Array.prototype.slice.call(arguments);
        var text, evId, time, size, color, font, bold, ital;
        if (hash && typeof hash === 'object' && !Array.isArray(hash)) {
            text = hash.text; evId = hash.event_id; time = hash.time;
            size = hash.size; color = hash.color; font = hash.font;
            bold = hash.bold; ital = hash.italic;
        } else {
            text = args[0]; evId = args[1]; time = args[2]; size = args[3];
            color = args[4]; font = args[5]; bold = args[6]; ital = args[7];
        }
        var char = nelGetCharacter(evId, curEventId);
        if (!char) { return true; }
        char.namepop = (text == null) ? '' : String(text);
        char.namepopSize = size || DEF_TEXT_SIZE;
        char.namepopColor = color || DEF_TEXT_COLOR;
        char.namepopTime = (time === undefined || time === null) ? null : time;
        char.namepopFont = font || DEF_TEXT_FONT;
        char.namepopBold = !!bold;
        char.namepopItal = !!ital;
        char.textpopFlag = true;
        return true;
    }
    // Expose the resolver for the unit tests / other ports.
    MonlineTextPop.nel_textpop = nel_textpop;
    MonlineTextPop.nelGetCharacter = nelGetCharacter;
    window.nel_textpop = nel_textpop;

    //-------------------------------------------------------------------------
    // Rendering on the character sprite
    //-------------------------------------------------------------------------
    function disposeNamePop(sprite) {
        var ns = sprite._monlineNamePop;
        if (!ns) { return; }
        if (ns.parent && ns.parent.removeChild) { ns.parent.removeChild(ns); }
        if (ns.bitmap && ns.bitmap.destroy) { ns.bitmap.destroy(); }
        if (ns.destroy) { ns.destroy(); }
        sprite._monlineNamePop = null;
    }

    function startNamePop(sprite, char) {
        disposeNamePop(sprite);
        var text = char.namepop;
        if (text === 'none' || text === '' || text == null) {
            sprite._monlineNamePop = null;
            return;
        }
        var size = char.namepopSize || DEF_TEXT_SIZE;
        var font = char.namepopFont || DEF_TEXT_FONT;
        var bold = !!char.namepopBold;
        var ital = !!char.namepopItal;

        var probe = new Bitmap(4, 4);
        probe.fontFace = font;
        probe.fontSize = size;
        probe.fontBold = bold;
        probe.fontItalic = ital;
        var tw = probe.measureTextWidth(text);
        var w = Math.ceil(tw) + 16;
        var h = size + 12;

        var bmp = new Bitmap(w, h);
        bmp.fontFace = font;
        bmp.fontSize = size;
        bmp.fontBold = bold;
        bmp.fontItalic = ital;
        bmp.textColor = colorToCss(char.namepopColor);
        bmp.drawText(text, 0, 0, w, h, 'center');

        var sp = new Sprite();
        sp.bitmap = bmp;
        sp.anchor.x = 0.5;
        sp.anchor.y = 1;                 // bottom-centre: sits on the head
        if (sprite.parent) { sprite.parent.addChild(sp); }
        sprite._monlineNamePop = sp;
        sprite._monlineNamePopTimer = (char.namepopTime === null ||
                                       char.namepopTime === undefined)
            ? -1 : char.namepopTime;
        sprite._monlineNamePopFade = undefined;
    }

    function updateNamePop(sprite) {
        var char = sprite._character;
        if (!char) { return; }
        var built = false;
        if (char.textpopFlag) {
            char.textpopFlag = false;
            startNamePop(sprite, char);
            built = true;   // build frame must not count the timer down yet
        }
        var ns = sprite._monlineNamePop;
        if (!ns) { return; }
        var charH = (sprite.bitmap && sprite.bitmap.height) ? sprite.bitmap.height : 48;
        ns.x = sprite.x;
        ns.y = sprite.y - charH;
        ns.z = sprite.z + 200;
        if (!built && sprite._monlineNamePopTimer > 0) {
            sprite._monlineNamePopTimer -= 1;
            if (sprite._monlineNamePopTimer <= 0) {
                disposeNamePop(sprite);
            } else if (sprite._monlineNamePopTimer < 60) {
                if (sprite._monlineNamePopFade === undefined) {
                    sprite._monlineNamePopFade =
                        255 / sprite._monlineNamePopTimer;
                }
                ns.opacity = Math.max(0, ns.opacity - sprite._monlineNamePopFade);
            }
        }
    }

    if (typeof Sprite_Character !== 'undefined' && Sprite_Character.prototype) {
        var _Sprite_Character_update = Sprite_Character.prototype.update;
        Sprite_Character.prototype.update = function() {
            if (_Sprite_Character_update) { _Sprite_Character_update.call(this); }
            updateNamePop(this);
        };

        var _Sprite_Character_dispose = Sprite_Character.prototype.dispose;
        Sprite_Character.prototype.dispose = function() {
            disposeNamePop(this);
            if (_Sprite_Character_dispose) { _Sprite_Character_dispose.call(this); }
        };
    }

    //-------------------------------------------------------------------------
    // Real now: drop MonlineShim's placeholder so the bridge stops stubbing it
    //-------------------------------------------------------------------------
    if (window.MonlineShim && window.MonlineShim.functions) {
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return n !== 'nel_textpop';
        });
        window.MonlineTextPop = window.MonlineTextPop; // keep the namespace
    }
})();
