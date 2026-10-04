//=============================================================================
// MonlineChoiceMerge.js
//=============================================================================
//
// Two separate defects around "Show Choices", both found by reading the real
// converted data rather than by guessing:
//
// (1) Cancel type convention was never converted.
//
//     The data still carries VX Ace's encoding for Show Choices parameters[1]:
//
//         0      = cancel is not allowed
//         1..n   = the Nth choice (1-based) doubles as the cancel option
//         > n    = cancel runs the "When Cancel" branch
//
//     MV encodes it completely differently:
//
//        -1      = cancel is not allowed
//         0..n-1 = 0-based index of the choice that acts as cancel
//        -2      = cancel runs the "When Cancel" branch
//
//     Measured over the whole project: 1244 Show Choices commands, cancel
//     values are only ever {0,1,2,3,4} - never -1/-2 - and 770 of them are
//     exactly `cancel == number of choices`, i.e. the VX Ace "last option
//     cancels" idiom that is out of range under MV's rule.  MV's own
//     `setupChoices` then clamps `cancelType >= choices.length` to -2, so every
//     one of those menus silently became a "branch" cancel: pressing cancel
//     jumped to a When Cancel branch that usually does not exist, and the menu
//     appeared to do nothing.
//
// (2) Hime's "Large Choices" (0116.rb) `combine_choices` was a stub.
//
//     VX Ace only allows 4 options per Show Choices command; MV only 6.  The
//     game builds bigger menus by stacking several Show Choices commands and
//     calling `combine_choices` first (Manual_Combine is true in this project).
//     76 event command lists combine two or more Show Choices; without the
//     merge those appear as two consecutive smaller menus instead of one.
//
// ---------------------------------------------------------------------------
// Faithful port of 0116.rb:
//   manual mode -> `combine_choices` sets @combine_choices = true
//   setup_choices -> merges every following 102 at the same indent:
//       * concatenates the option strings
//       * renumbers that command's 402 branches to continue the numbering
//       * moves the cancel option / cancel branch to the merged index
//       * deletes the merged 102 so its branches belong to the first command
//   Ruby works on `Marshal.load(Marshal.dump(@list))`, i.e. a deep copy, so
//   the event page itself is never modified.  We copy the same way - mutating
//   `this._list` in place would corrupt `$dataMap` for the next run and
//   re-renumber the branches a second time.
//=============================================================================

/*:
 * @plugindesc Ports Hime Large Choices (0116.rb) combine_choices and converts the VX Ace Show Choices cancel-type convention to MV.
 * @author Monline port
 */

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // VX Ace cancel type -> MV cancel type
    //-------------------------------------------------------------------------
    function convertCancelType(vx, numChoices) {
        if (vx <= 0) { return -1; }        // VX 0 = disallow      -> MV -1
        if (vx > numChoices) { return -2; } // VX 5 (or > n) branch -> MV -2
        return vx - 1;                      // VX 1..n (1-based)    -> MV 0..n-1
    }

    function isBranchCode(code) {
        return code === 402 || code === 403 || code === 404;
    }

    function cloneList(list) {
        var out = new Array(list.length);
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            out[i] = {
                code: c.code,
                indent: c.indent,
                parameters: deepCopy(c.parameters)
            };
        }
        return out;
    }

    function deepCopy(v) {
        if (window.JsonEx && typeof JsonEx.makeDeepCopy === 'function') {
            return JsonEx.makeDeepCopy(v);
        }
        return JSON.parse(JSON.stringify(v === undefined ? null : v));
    }

    //-------------------------------------------------------------------------
    // The merge itself (0116.rb `search_more_choices` and friends)
    //-------------------------------------------------------------------------
    //
    // Returns { choices, cancelType, first } where `first` is the parameters
    // array of the leading Show Choices command, already extended.
    Game_Interpreter.prototype.monlineMergeChoices = function (choices, cancelType) {
        var original = this._list;
        if (!original || original[this._index] === undefined) {
            return { choices: choices, cancelType: cancelType, first: null };
        }
        var indent = this._indent;

        // Ruby: `@list = Marshal.load(Marshal.dump(@list))`
        var list = cloneList(original);
        var first = list[this._index].parameters;

        var numChoices = choices.length;   // Ruby's @num_choices
        var search = this._index + 1;      // Ruby's @choice_search

        for (;;) {
            // skip_choice_branches: past the branches of the set we just did
            while (search < list.length &&
                   (isBranchCode(list[search].code) || list[search].indent !== indent)) {
                search++;
            }
            if (search >= list.length) { break; }
            var next = list[search];
            if (next.code !== 102) { break; }

            var nextParams = next.parameters || [[]];
            var extra = nextParams[0] || [];
            search++;

            // update_show_choices + concat into the first command
            for (var i = 0; i < extra.length; i++) { choices.push(extra[i]); }
            first[0] = first[0].concat(extra);

            // update_cancel_choice: the last cancel specification wins, and it
            // is re-based onto the merged list.  VX 0 means "disallow" and is
            // ignored, exactly like the Ruby `return if params[1] == 0`.
            var nextCancel = nextParams.length > 1 ? nextParams[1] : 0;
            if (nextCancel > 0) {
                if (nextCancel > extra.length) {
                    cancelType = -2;                       // branch cancel
                } else {
                    cancelType = (nextCancel - 1) + numChoices;
                }
            }

            // update_choice_numbers: renumber every "When" of this set so it
            // continues the merged numbering instead of restarting at 0.
            var j = search;
            while (j < list.length &&
                   (isBranchCode(list[j].code) || list[j].indent !== indent)) {
                if (list[j].code === 402 && list[j].indent === indent) {
                    list[j].parameters[0] = numChoices;
                    numChoices++;
                }
                j++;
            }

            // delete the merged command so its branches follow the first one
            list.splice(search - 1, 1);
        }

        this._list = list;
        return { choices: choices, cancelType: cancelType, first: first };
    };

    //-------------------------------------------------------------------------
    // Show Choices setup
    //-------------------------------------------------------------------------
    Game_Interpreter.prototype.setupChoices = function (params) {
        var choices = params[0].clone();
        var cancelType = params.length > 1 ? params[1] : 0;
        var defaultType = params.length > 2 ? params[2] : 0;
        var positionType = params.length > 3 ? params[3] : 2;
        var background = params.length > 4 ? params[4] : 0;

        // (1) VX Ace cancel convention -> MV cancel convention
        cancelType = convertCancelType(cancelType, choices.length);

        // (2) Large Choices merge
        if (this._combineChoices) {
            var merged = this.monlineMergeChoices(choices, cancelType);
            choices = merged.choices;
            cancelType = merged.cancelType;
        }

        $gameMessage.setChoices(choices, defaultType, cancelType);
        $gameMessage.setChoiceBackground(background);
        $gameMessage.setChoicePositionType(positionType);
        $gameMessage.setChoiceCallback(function (n) {
            this._branch[this._indent] = n;
        }.bind(this));
    };

    //-------------------------------------------------------------------------
    // `combine_choices` (0116.rb) - "the next Show Choices should merge"
    //-------------------------------------------------------------------------
    var _Game_Interpreter_clear = Game_Interpreter.prototype.clear;
    Game_Interpreter.prototype.clear = function () {
        _Game_Interpreter_clear.call(this);
        // Ruby's `clear` resets the flag; note it is deliberately NOT reset
        // after a merge - the original keeps it set until the interpreter is
        // cleared, which is what the data was authored against.
        this._combineChoices = false;
    };

    function combineChoices() {
        // `combine_choices` runs as an event Script command, so the bridge has
        // the running interpreter in MonlineRuby.current.
        var it = (window.MonlineRuby && window.MonlineRuby.current) || null;
        if (it) { it._combineChoices = true; }
        return true;
    }

    window.combine_choices = combineChoices;

    // Expose through the Ruby bridge scope as well, overriding its counting
    // stub so the call actually reaches this implementation.
    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.combine_choices = combineChoices;
        var idx = window.MonlineRuby.COSMETIC
            ? window.MonlineRuby.COSMETIC.indexOf('combine_choices') : -1;
        if (idx >= 0) { window.MonlineRuby.COSMETIC.splice(idx, 1); }
    }

    console.log('[MonlineChoiceMerge] loaded');
})();
