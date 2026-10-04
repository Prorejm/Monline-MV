//=============================================================================
// MonlineSelfSwitch.js
//=============================================================================
//
// Faithful port of 0250.rb "Simple Self Switches" (Nicke), 724 references.
//
//   setSelfSwitch(map, eID, selfSwitch, trueFalse)  # "A".."D"
//   isSelfSwitch?(map, eID, selfSwitch)
//   setAllSelf(map, eID, trueFalse)                 # all four letters at once
//
// The Ruby builds the key as `[map, eID, selfSwitch]`, which is byte-for-byte
// what MV's `$gameSelfSwitches.setValue([mapId, eventId, letter])` expects, so
// the port is a direct mapping.
//
// Why this file exists at all: the bridge already carried a `setAllSelf`, but
// with the wrong signature.  It read `(letter, value)` and wrote one letter to
// every event on the current map.  Every real call site passes three arguments
// - measured shapes are `setAllSelf(N, N, false)` - so the first argument (the
// map id) was being used as the switch letter and a single event's A-D block
// was never touched.  `setAllSelf` means "set A, B, C and D of THIS event".
//=============================================================================

/*:
 * @plugindesc Port of Nicke Simple Self Switches (0250.rb): setSelfSwitch / isSelfSwitch / setAllSelf.
 * @author Monline port
 */

(function () {
    'use strict';

    var LETTERS = ['A', 'B', 'C', 'D'];

    function toInt(v, fallback) {
        var n = parseInt(v, 10);
        return isNaN(n) ? fallback : n;
    }

    // 0250.rb: `switch = [map, eID, selfSwitch]; $game_self_switches[switch] = trueFalse`
    function setSelfSwitch(mapId, eventId, letter, value) {
        mapId = toInt(mapId, -1);
        if (mapId < 0 && $gameMap) { mapId = $gameMap.mapId(); }
        eventId = toInt(eventId, -1);
        if (eventId < 0) { return false; }
        $gameSelfSwitches.setValue([mapId, eventId, String(letter)], !!value);
        return true;
    }

    // 0250.rb: `switch = [map, eID, selfSwitch]; $game_self_switches[switch]`
    function isSelfSwitch(mapId, eventId, letter) {
        mapId = toInt(mapId, -1);
        if (mapId < 0 && $gameMap) { mapId = $gameMap.mapId(); }
        eventId = toInt(eventId, -1);
        if (eventId < 0) { return false; }
        return $gameSelfSwitches.value([mapId, eventId, String(letter)]) === true;
    }

    // 0250.rb: `switches = ["A","B","C","D"]; for i in switches ... end`
    // Sets every self switch of ONE event on ONE map - not one letter on many.
    function setAllSelf(mapId, eventId, value) {
        mapId = toInt(mapId, -1);
        if (mapId < 0 && $gameMap) { mapId = $gameMap.mapId(); }
        eventId = toInt(eventId, -1);
        if (eventId < 0) { return false; }
        for (var i = 0; i < LETTERS.length; i++) {
            $gameSelfSwitches.setValue([mapId, eventId, LETTERS[i]], !!value);
        }
        return true;
    }

    // Unconditional: MonlineShim / the bridge may already hold a placeholder.
    window.setSelfSwitch = setSelfSwitch;
    window.isSelfSwitch = isSelfSwitch;
    window.setAllSelf = setAllSelf;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        F.setSelfSwitch = setSelfSwitch;
        F.isSelfSwitch = isSelfSwitch;
        F.setAllSelf = setAllSelf;
    }

    // Tell the shim's bookkeeping these are real now, so `isRealPort` (used by
    // the bridge when deciding whether to shadow a name with a stub) agrees.
    if (window.MonlineShim && window.MonlineShim.functions) {
        ['setSelfSwitch', 'isSelfSwitch', 'setAllSelf'].forEach(function (n) {
            var i = window.MonlineShim.functions.indexOf(n);
            if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
        });
    }

    console.log('[MonlineSelfSwitch] loaded');
})();
