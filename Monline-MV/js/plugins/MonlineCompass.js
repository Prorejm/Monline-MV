//=============================================================================
// MonlineCompass.js
//=============================================================================
//
// Faithful port of 0213.rb "Compass" v1.0.1 by Tidloc (28 references).
//
//   Tidloc::Set_Coord(map, x, y)     # remember a target for that map
//   Tidloc::Clear_Coord(map)         # forget it (no argument = forget all)
//
// Coordinates live in `$game_temp._tidloc_compass` (a sparse array indexed by
// map id).  Every frame `Scene_Map#update` draws picture 101 as a compass
// needle rotated towards the target, or erases it when the map has no target.
//
// Angle arithmetic - two separate corrections, both forced by the engines.
//
// (a) HALF-DEGREES.  The Ruby computes
//
//         angle = Math.atan2(xdif + 0.0, ydif + 0.0) * 360.0 / Math::PI
//
//     twice the usual radian->degree factor, with special cases
//     0 / 180 / -180 / 360.  Read as ordinary degrees those wrap (north and
//     south would both land on 0); they only make sense in half-degrees, which
//     is exactly what the project's own Game_Picture does - see 0014.rb:157,
//     `@angle += @rotate_speed / 2.0`.  So the Ruby value is halved.
//
// (b) ROTATION DIRECTION.  RGSS3's `Sprite#angle` is documented as
//     "up to 360 degrees of counterclockwise rotation"; MV hands `_angle`
//     straight to PIXI (`Sprite_Picture#update`: `this.rotation =
//     picture.angle() * Math.PI / 180`), where a positive rotation is
//     *clockwise*.  The two engines turn opposite ways, so the halved value is
//     negated - otherwise the needle would mirror east and west.
//
// With both applied the four cardinal directions come out right, which is also
// how you can tell (a) and (b) are correct: `compass_needle.png` is drawn
// pointing UP (its tip is 67px above the image centre), so 0 must mean north.
//=============================================================================

/*:
 * @plugindesc Port of Tidloc Compass (0213.rb): a needle on the map pointing at a set coordinate.
 * @author Monline port
 */

(function () {
    'use strict';

    var PICTURE_ID = 101;
    var GRAPHIC = 'compass_needle';
    var TARGET = 'compass_needle';

    function screenX() {
        // Ruby: `X = Graphics.width - 75`
        return (window.Graphics && Graphics.width ? Graphics.width : 816) - 75;
    }
    var SCREEN_Y = 82;

    //-------------------------------------------------------------------------
    // Game_Temp: `_tidloc_compass`
    //-------------------------------------------------------------------------
    var _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function () {
        this._tidloc_compass = [];
        _Game_Temp_initialize.call(this);
    };

    function store() {
        if (!$gameTemp) { return null; }
        if (!Array.isArray($gameTemp._tidloc_compass)) {
            $gameTemp._tidloc_compass = [];
        }
        return $gameTemp._tidloc_compass;
    }

    //-------------------------------------------------------------------------
    // Tidloc::Set_Coord / Tidloc::Clear_Coord
    //-------------------------------------------------------------------------
    var Tidloc = {
        Set_Coord: function (map, x, y) {
            var s = store();
            if (!s) { return false; }
            s[parseInt(map, 10) || 0] = [parseInt(x, 10) || 0, parseInt(y, 10) || 0];
            return true;
        },
        Clear_Coord: function (map) {
            var s = store();
            if (!s) { return false; }
            if (map === undefined || map === null) {
                $gameTemp._tidloc_compass = [];
            } else {
                s[parseInt(map, 10) || 0] = null;
            }
            return true;
        }
    };

    window.Tidloc = Tidloc;
    if (window.MonlineRuby && window.MonlineRuby.F) {
        // The bridge installs a permissive stub for `Tidloc`; replace it so
        // `Tidloc::Set_Coord(...)` (translated to `Tidloc.Set_Coord(...)`)
        // reaches this implementation instead of silently counting.
        window.MonlineRuby.F.Tidloc = Tidloc;
    }

    //-------------------------------------------------------------------------
    // Scene_Map#update - draw the needle
    //-------------------------------------------------------------------------
    function showNeedle(name, angleUnits) {
        var screen = $gameMap.screen();
        if (!screen) { return; }
        // Ruby: pictures[101].show(Graphic, 1, x, y, 50, 50, 255, 0)
        screen.showPicture(PICTURE_ID, name, 1, screenX(), SCREEN_Y, 50, 50, 255, 0);
        var pic = screen.picture(PICTURE_ID);
        if (pic) {
            // half-degree units, and RGSS3 counter-clockwise -> MV clockwise
            pic._angle = -(angleUnits / 2);
        }
    }

    function eraseNeedle() {
        var screen = $gameMap.screen();
        if (screen) { screen.erasePicture(PICTURE_ID); }
    }

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);

        var s = store();
        var mapId = $gameMap ? $gameMap.mapId() : 0;
        var coord = s ? s[mapId] : null;
        if (!coord) {
            eraseNeedle();
            return;
        }
        var xdif = $gamePlayer.x - coord[0];
        var ydif = $gamePlayer.y - coord[1];
        var angle = 0;
        if (ydif === 0 && xdif > 0) {
            angle = 180;
        } else if (ydif === 0 && xdif < 0) {
            angle = -180;
        } else if (xdif === 0 && ydif > 0) {
            angle = 0;
        } else if (xdif === 0 && ydif < 0) {
            angle = 360;
        } else if (xdif === 0 && ydif === 0) {
            // Standing exactly on the target: swap the needle for the target
            // graphic (Ruby erases and re-shows `Tidloc::Compass::Target`).
            eraseNeedle();
            if (TARGET) { showNeedle(TARGET, 0); }
            return;
        } else {
            angle = Math.atan2(xdif + 0.0, ydif + 0.0) * 360.0 / Math.PI;
        }
        showNeedle(GRAPHIC, angle);
    };

    console.log('[MonlineCompass] loaded');
})();
