//=============================================================================
// MonlineGlobalSave.js
//=============================================================================
//
// Faithful port of 0180.rb "Global Save System" [v1.0] by theLEECH.
//
//   global_save    596 references
//   global_load     11 references
//
// A "global" save is a second file that lives outside the numbered save slots,
// holding the variables and switches the author listed in the configuration.
//
// IMPORTANT, and the reason this was worth reading instead of guessing: in
// this project BOTH configuration arrays are empty.
//
//       VARIABLES_TO_SAVE = []
//       SWITCHES_TO_SAVE  = []
//
// `save` therefore writes an empty record and `load` iterates an empty list,
// so neither call changes any game state - they are provably inert here.  The
// port reproduces the mechanism rather than hard-coding a no-op, so the
// behaviour is identical *by construction*: with the shipped configuration it
// stores and restores nothing.
//
// Ruby writes `Global.rvdata2` next to the game; MV has no free file access, so
// the record goes to localStorage under the same conceptual name.
//=============================================================================

/*:
 * @plugindesc Port of theLEECH Global Save System (0180.rb): global_save / global_load plus the DataManager hooks.
 * @author Monline port
 */

(function () {
    'use strict';

    var LGlobalSave = {
        // ---- configuration, copied verbatim from 0180.rb -------------------
        SAVE_ON_SAVE: true,
        LOAD_ON_LOAD: true,
        LOAD_ON_NEW: true,
        VARIABLES_TO_SAVE: [],
        SWITCHES_TO_SAVE: [],
        FILE_NAME: 'Global.rvdata2',

        // ---- LGlobalSaveFile -----------------------------------------------
        makeNewFile: function () {
            return { var: [], 'switch': [] };
        },
        getVar: function (f, id) { return f.var[id]; },
        setVar: function (f, id, val) { f.var[id] = val; },
        getSwitch: function (f, id) { return f['switch'][id]; },
        setSwitch: function (f, id, val) { f['switch'][id] = val; },

        // ---- persistence ----------------------------------------------------
        saveTheFile: function (f) {
            try {
                if (window.localStorage) {
                    localStorage.setItem('Monline.' + this.FILE_NAME, JSON.stringify(f));
                }
            } catch (e) { /* storage unavailable - the original would simply fail */ }
        },
        loadTheFile: function () {
            var raw = null;
            try {
                if (window.localStorage) {
                    raw = localStorage.getItem('Monline.' + this.FILE_NAME);
                }
            } catch (e) { raw = null; }
            if (raw === null || raw === undefined) { return this.makeNewFile(); }
            try {
                var f = JSON.parse(raw);
                if (f && f.var && f['switch']) { return f; }
            } catch (e) { /* fall through to a fresh file */ }
            return this.makeNewFile();
        },

        // ---- module methods -------------------------------------------------
        saveVariables: function (f) {
            for (var i = 0; i < this.VARIABLES_TO_SAVE.length; i++) {
                var id = this.VARIABLES_TO_SAVE[i];
                this.setVar(f, id, $gameVariables.value(id));
            }
        },
        saveSwitches: function (f) {
            for (var i = 0; i < this.SWITCHES_TO_SAVE.length; i++) {
                var id = this.SWITCHES_TO_SAVE[i];
                this.setSwitch(f, id, $gameSwitches.value(id));
            }
        },
        loadVariables: function (f) {
            for (var i = 0; i < this.VARIABLES_TO_SAVE.length; i++) {
                var id = this.VARIABLES_TO_SAVE[i];
                $gameVariables.setValue(id, this.getVar(f, id));
            }
        },
        loadSwitches: function (f) {
            for (var i = 0; i < this.SWITCHES_TO_SAVE.length; i++) {
                var id = this.SWITCHES_TO_SAVE[i];
                $gameSwitches.setValue(id, this.getSwitch(f, id));
            }
        },
        save: function () {
            var f = this.makeNewFile();
            this.saveVariables(f);
            this.saveSwitches(f);
            this.saveTheFile(f);
        },
        load: function () {
            var f = this.loadTheFile();
            this.loadVariables(f);
            this.loadSwitches(f);
        }
    };

    window.LGlobalSave = LGlobalSave;

    //-------------------------------------------------------------------------
    // Event script calls
    //-------------------------------------------------------------------------
    function global_save() { LGlobalSave.save(); return true; }
    function global_load() { LGlobalSave.load(); return true; }

    window.global_save = global_save;
    window.global_load = global_load;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.global_save = global_save;
        window.MonlineRuby.F.global_load = global_load;
        ['global_save', 'global_load'].forEach(function (n) {
            var i = window.MonlineRuby.COSMETIC.indexOf(n);
            if (i >= 0) { window.MonlineRuby.COSMETIC.splice(i, 1); }
        });
    }

    //-------------------------------------------------------------------------
    // DataManager hooks (0180.rb overwrites all three)
    //-------------------------------------------------------------------------
    var _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);
        // Ruby: `LGlobalSave.load if LGlobalSave::LOAD_ON_NEW`
        if (LGlobalSave.LOAD_ON_NEW) { LGlobalSave.load(); }
    };

    var _DataManager_saveGame = DataManager.saveGame;
    DataManager.saveGame = function (savefileId) {
        var result = _DataManager_saveGame.call(this, savefileId);
        // Ruby saves the global file after the (rescued) slot save, whether or
        // not it succeeded.
        if (LGlobalSave.SAVE_ON_SAVE) { LGlobalSave.save(); }
        return result;
    };

    var _DataManager_loadGame = DataManager.loadGame;
    DataManager.loadGame = function (savefileId) {
        var result = _DataManager_loadGame.call(this, savefileId);
        if (LGlobalSave.LOAD_ON_LOAD) { LGlobalSave.load(); }
        return result;
    };

    console.log('[MonlineGlobalSave] loaded');
})();
