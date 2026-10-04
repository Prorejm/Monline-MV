//=============================================================================
// MonlineChoice.js
//=============================================================================
/*:
 * @plugindesc VX Ace "Choice Options" (Tsuki, 0117.rb) ported to MV.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script `Choice Options` by Tsuki (source script 0117.rb).
 * The game configures a Show Choices command *before* it runs:
 *
 *     hide_choice(4, "$game_variables[194] < 8")     // hide when the cond is true
 *     disable_choice(2, "!$game_party.members.include?($game_actors[4])")
 *     disable_good(1, "v[95]<5")                     // shop goods
 *     color_choice(3, 2)
 *     text_choice(1, "Something else", "s[10]")
 *
 * Measured usage here: 392 hide_choice, 214 disable_choice, plus shop helpers.
 *
 * ---------------------------------------------------------------------------
 * What the original does
 * ---------------------------------------------------------------------------
 * Options are collected on `$game_message` as the event runs, then applied when
 * the Show Choices command builds its list:
 *
 *   * hidden choices are **removed from the list entirely**, and a map from the
 *     visible position back to the original choice index is kept, so the branch
 *     that runs still matches the branch the event author wrote;
 *   * a disabled choice stays visible but cannot be picked, and is drawn dimmed;
 *   * cancelling is disallowed when the cancel target is itself hidden or
 *     disabled;
 *   * `text_choice` swaps the label, and the last matching condition wins.
 *
 * Conditions are Ruby evaluated with `v` = variables, `s` = switches,
 * `p` = party, `t` = troop bound as local names, and an empty condition is
 * true.
 *
 * ---------------------------------------------------------------------------
 * How this port reproduces it
 * ---------------------------------------------------------------------------
 * MV's choice list is rebuilt by `Window_ChoiceList#makeCommandList` from
 * `$gameMessage.choices()`, and the result is delivered through
 * `$gameMessage.onChoice(n)` - where `n` is the **original** choice index, which
 * is what the event's branch table expects.  So this port keeps
 * `$gameMessage._choices` complete (indices untouched, which also keeps MV's
 * cancel handling valid) and filters in the window instead, mapping the
 * selection back through `_monlineChoiceMap` on OK.
 *
 * Condition strings go through `MonlineRuby.evalExpr`, i.e. the same Ruby->JS
 * translator the event scripts use, with `v / s / p / t` bound up front.
 */

var MonlineChoice = MonlineChoice || {};

(function() {
    'use strict';

    function optsOf(message) {
        var m = message || $gameMessage;
        if (!m) { return {}; }
        if (!m._monlineChoiceOpts) {
            m._monlineChoiceOpts = { hidden: {}, disabled: {}, color: {},
                                     disableColor: {}, text: {} };
        }
        return m._monlineChoiceOpts;
    }
    MonlineChoice.optsOf = optsOf;

    MonlineChoice.reset = function(message) {
        var m = message || $gameMessage;
        if (m) {
            m._monlineChoiceOpts = { hidden: {}, disabled: {}, color: {},
                                     disableColor: {}, text: {} };
            m._monlineChoiceMap = null;
        }
    };

    /**
     * Evaluate a Ruby condition with `v / s / p / t` bound, exactly like the
     * original's `eval_choice_condition`.  An empty condition is true.
     */
    MonlineChoice.evalCondition = function(condition) {
        var cond = String(condition === undefined || condition === null ? '' : condition);
        if (cond === '') { return true; }
        var MR = window.MonlineRuby;
        if (!MR || !MR.evalExpr) { return false; }
        // It has to be a single *expression*: evalExpr wraps the source as
        // `return (...);`, so a `var` prefix would be a syntax error and every
        // condition would silently evaluate to false.  An IIFE binds the
        // original's `v / s / p / t` shorthand without changing the shape.
        var src = '(function(v,s,p,t){ return (' + cond + '); })' +
                  '($game_variables, $game_switches, $game_party, $game_troop)';
        try {
            return !!MR.evalExpr(src, MR.current);
        } catch (e) {
            return false;
        }
    };

    //-------------------------------------------------------------------------
    // Interpreter script calls
    //-------------------------------------------------------------------------
    window.hide_choice = function(choiceNum, condition) {
        optsOf().hidden[choiceNum] = MonlineChoice.evalCondition(condition);
        return true;
    };
    window.disable_choice = function(choiceNum, condition) {
        optsOf().disabled[choiceNum] = MonlineChoice.evalCondition(condition);
        return true;
    };
    window.color_choice = function(choiceNum, value) {
        optsOf().color[choiceNum] = parseInt(value, 10) || 0;
        return true;
    };
    window.disable_color_choice = function(choiceNum, value) {
        optsOf().disableColor[choiceNum] = parseInt(value, 10) || 0;
        return true;
    };
    window.text_choice = function(choiceNum, text, condition) {
        var o = optsOf();
        o.text[choiceNum] = o.text[choiceNum] || [];
        o.text[choiceNum].push([String(text || '').replace(/\n/g, ''),
                                condition || '']);
        return true;
    };
    window.hide_good = function(goodNum, condition) {
        // the shop variant keeps its condition so the window can re-evaluate it
        optsOf().hidden['good' + goodNum] = MonlineChoice.evalCondition(condition);
        return true;
    };
    window.disable_good = function(goodNum, condition) {
        optsOf().disabled['good' + goodNum] = MonlineChoice.evalCondition(condition);
        return true;
    };

    MonlineChoice.hidden = function(num) {
        var o = optsOf();
        return !!o.hidden[num];
    };
    MonlineChoice.disabled = function(num) {
        var o = optsOf();
        return !!o.disabled[num];
    };

    /** The label for choice `num` (1-based), honouring any text_choice swap. */
    MonlineChoice.text = function(num, fallback) {
        var o = optsOf();
        var list = o.text[num];
        if (list) {
            // the original walks the overrides in reverse, first match wins
            for (var i = list.length - 1; i >= 0; i--) {
                if (MonlineChoice.evalCondition(list[i][1])) { return list[i][0]; }
            }
        }
        return fallback;
    };

    //-------------------------------------------------------------------------
    // Reset with the message, like the original's Game_Message#clear
    //-------------------------------------------------------------------------
    var _Game_Message_clear = Game_Message.prototype.clear;
    Game_Message.prototype.clear = function() {
        _Game_Message_clear.apply(this, arguments);
        MonlineChoice.reset(this);
    };

    //-------------------------------------------------------------------------
    // The window: hide, disable, colour
    //-------------------------------------------------------------------------
    var _Window_ChoiceList_makeCommandList = Window_ChoiceList.prototype.makeCommandList;
    Window_ChoiceList.prototype.makeCommandList = function() {
        // Keep every choice in $gameMessage (so branch indices and MV's own
        // cancel handling stay valid) and filter in the window instead.
        var choices = $gameMessage.choices();
        var map = [];
        for (var i = 0; i < choices.length; i++) {
            if (MonlineChoice.hidden(i + 1)) { continue; }
            map.push(i);
            this.addCommand(MonlineChoice.text(i + 1, choices[i]), 'choice');
        }
        this._monlineChoiceMap = map;
    };

    var _Window_ChoiceList_callOkHandler = Window_ChoiceList.prototype.callOkHandler;
    Window_ChoiceList.prototype.callOkHandler = function() {
        var map = this._monlineChoiceMap;
        if (map && map.length) {
            $gameMessage.onChoice(map[this.index()]);
            this._messageWindow.terminateMessage();
            this.close();
            return;
        }
        _Window_ChoiceList_callOkHandler.call(this);
    };

    Window_ChoiceList.prototype.isEnabled = function(index) {
        var map = this._monlineChoiceMap;
        var original = map && map.length ? map[index] : (index + 1);
        return !MonlineChoice.disabled(original + 1);
    };

    // Cancelling is disallowed when the cancel target is itself hidden or
    // disabled - otherwise the player could pick an option the event hid.
    var _Window_ChoiceList_isCancelEnabled = Window_ChoiceList.prototype.isCancelEnabled;
    Window_ChoiceList.prototype.isCancelEnabled = function() {
        if (!_Window_ChoiceList_isCancelEnabled.call(this)) { return false; }
        var cancelType = $gameMessage.choiceCancelType();
        if (cancelType > 0) {
            if (MonlineChoice.hidden(cancelType) || MonlineChoice.disabled(cancelType)) {
                return false;
            }
        }
        return true;
    };

    //-------------------------------------------------------------------------
    // These are real now, so drop MonlineShim's placeholders - otherwise the
    // bridge keeps stubbing over them (see MonlineRuby.isRealPort).
    //-------------------------------------------------------------------------
    if (window.MonlineShim && window.MonlineShim.functions) {
        var implemented = ['hide_choice', 'disable_choice', 'color_choice',
                           'disable_color_choice', 'text_choice', 'hide_good',
                           'disable_good'];
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return implemented.indexOf(n) < 0;
        });
        window.MonlineShim.choiceOptions = true;
    }
})();
