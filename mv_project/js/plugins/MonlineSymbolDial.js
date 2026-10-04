//=============================================================================
// MonlineSymbolDial.js
//=============================================================================
/*:
 * @plugindesc Port of Hime "Symbol Dial System" (0118.rb): set_symbols + the symbol input window.
 * @author Monline port
 *
 * @help
 * 0118.rb replaces the event command [Input Number] with a dial the player
 * scrolls through arbitrary symbols instead of digits:
 *
 *     set_symbols(1, ["A", "B", "C"])     # right-most dial
 *     set_symbols(2, ["1", "2", "3"])     # one to its left
 *     ...                                  # 15 calls measured in this game
 *     # then: event command [Input Number] -> variable, 11 digits
 *
 * The value written to the variable is a **string** built by joining the
 * currently displayed symbols, so the event compares it with
 * `$game_variables[n] == "..."`.
 *
 * Measured usage: 15 `set_symbols` calls (67 identifier references), always
 * `set_symbols(N, [S, S, ...])`.  Before this port `set_symbols` was a shim
 * no-op and the Input Number command opened MV's ordinary digit window, so the
 * combination could never be entered.
 *
 * ---------------------------------------------------------------------------
 * Mapping onto MV
 * ---------------------------------------------------------------------------
 * Ruby's `Window_Message#input_number` is what MV calls
 * `Window_Message#startInput`, and Ruby's `Window_SymbolInput < Window_NumberInput`
 * maps onto MV's `Window_NumberInput`.  The port therefore:
 *
 *   * adds `key_inputs` to `Game_Message` (cleared by `#clear`, like the Ruby);
 *   * adds `Window_SymbolInput` with the Ruby's `start / get_value / init_value /
 *     process_digit_change / refresh / process_ok`;
 *   * diverts `startInput` to it whenever `key_inputs` is non-empty.
 *
 * The one deliberate difference: Ruby's window shows no on-screen buttons
 * (MV's `Window_NumberInput` draws a ButtonSet sprite row), so they are hidden
 * for the symbol window.
 */
//=============================================================================

var MonlineSymbolDial = MonlineSymbolDial || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Game_Message#key_inputs (0118.rb:114)
    //-------------------------------------------------------------------------
    var _Game_Message_clear = Game_Message.prototype.clear;
    Game_Message.prototype.clear = function () {
        _Game_Message_clear.apply(this, arguments);
        this._keyInputs = [];
    };

    Game_Message.prototype.keyInputs = function () {
        if (!this._keyInputs) { this._keyInputs = []; }
        return this._keyInputs;
    };

    // 0118.rb:123
    Game_Message.prototype.isSymbolInput = function () {
        return (this._keyInputs && this._keyInputs.length > 0);
    };

    //-------------------------------------------------------------------------
    // Window_SymbolInput (0118.rb:128)
    //-------------------------------------------------------------------------
    function Window_SymbolInput() {
        this.initialize.apply(this, arguments);
    }
    Window_SymbolInput.prototype = Object.create(Window_NumberInput.prototype);
    Window_SymbolInput.prototype.constructor = Window_SymbolInput;

    Window_SymbolInput.prototype.initialize = function (messageWindow) {
        Window_NumberInput.prototype.initialize.call(this, messageWindow);
        this._inputs = [];
        this._data = [];
        this._value = '';
    };

    // 0118.rb:138
    Window_SymbolInput.prototype.start = function () {
        this._data = $gameMessage.keyInputs().slice();
        this._maxDigits = this._data.length;
        this._value = this.getValue();
        this._index = 0;
        this.updatePlacement();
        this.updateButtonsVisiblity();
        this.createContents();
        this.refresh();
        this.select(0);
        this.open();
        this.activate();
    };

    // 0118.rb:150 - restore a previously entered combination if it still fits
    Window_SymbolInput.prototype.getValue = function () {
        var raw = String($gameVariables.value($gameMessage.numInputVariableId()));
        var value = raw.split('');
        if (value.length !== this._data.length) { return this.initValue(); }
        for (var i = 0; i < value.length; i++) {
            var list = this._data[i] || [];
            var idx = list.indexOf(value[i]);
            if (idx < 0) { return this.initValue(); }
            this._inputs[i] = idx;
        }
        return value;
    };

    // 0118.rb:164
    Window_SymbolInput.prototype.initValue = function () {
        this._inputs = [];
        var value = [];
        for (var i = 0; i < this._maxDigits; i++) {
            this._inputs[i] = 0;
            var list = this._data[i] || [];
            value.push(list[0]);
        }
        return value;
    };

    // 0118.rb:169 - UP cycles forward, DOWN cycles back, per dial
    Window_SymbolInput.prototype.processDigitChange = function () {
        if (!this.isOpenAndActive()) { return; }
        var list = this._data[this.index()] || [];
        var size = list.length;
        if (!size) { return; }
        if (Input.isRepeated('up')) {
            SoundManager.playCursor();
            var n = this._inputs[this.index()] || 0;
            n = (n + 1) % size;
            this._inputs[this.index()] = n;
            this.refresh();
        } else if (Input.isRepeated('down')) {
            SoundManager.playCursor();
            var m = this._inputs[this.index()] || 0;
            m = (m + size - 1) % size;
            this._inputs[this.index()] = m;
            this.refresh();
        }
    };

    // 0118.rb:182
    Window_SymbolInput.prototype.refresh = function () {
        this.contents.clear();
        this.resetTextColor();
        var value = [];
        for (var i = 0; i < this._maxDigits; i++) {
            var list = this._data[i] || [];
            value.push(list[this._inputs[i] || 0]);
        }
        this._value = value;
        for (var j = 0; j < this._maxDigits; j++) {
            var rect = this.itemRect(j);
            rect.x += 1;
            this.drawText(String(value[j] === undefined ? '' : value[j]),
                          rect.x, rect.y, rect.width, 'center');
        }
    };

    // 0118.rb:193 - the variable receives a STRING, not a number
    Window_SymbolInput.prototype.processOk = function () {
        SoundManager.playOk();
        var value = [];
        for (var i = 0; i < this._maxDigits; i++) {
            var list = this._data[i] || [];
            value.push(list[this._inputs[i] || 0]);
        }
        this._value = value;
        $gameVariables.setValue($gameMessage.numInputVariableId(), value.join(''));
        this._messageWindow.terminateMessage();
        this.deactivate();
        this.close();
    };

    // The Ruby dial has no on-screen up/down buttons.
    Window_SymbolInput.prototype.updateButtonsVisiblity = function () {
        this.hideButtons();
    };

    Window_SymbolInput.prototype.maxItems = function () {
        return this._maxDigits;
    };

    MonlineSymbolDial.Window_SymbolInput = Window_SymbolInput;

    //-------------------------------------------------------------------------
    // Window_Message (0118.rb:201)
    //-------------------------------------------------------------------------
    var _createSubWindows = Window_Message.prototype.createSubWindows;
    Window_Message.prototype.createSubWindows = function () {
        _createSubWindows.call(this);
        this._symbolWindow = new Window_SymbolInput(this);
    };

    var _subWindows = Window_Message.prototype.subWindows;
    Window_Message.prototype.subWindows = function () {
        return _subWindows.call(this).concat([this._symbolWindow]);
    };

    var _isAnySubWindowActive = Window_Message.prototype.isAnySubWindowActive;
    Window_Message.prototype.isAnySubWindowActive = function () {
        if (this._symbolWindow && this._symbolWindow.active) { return true; }
        return _isAnySubWindowActive.call(this);
    };

    // 0118.rb:221 - `input_number` becomes `input_symbol` when symbols are set
    var _startInput = Window_Message.prototype.startInput;
    Window_Message.prototype.startInput = function () {
        if ($gameMessage.isSymbolInput && $gameMessage.isSymbolInput()) {
            this._symbolWindow.start();
            return true;
        }
        return _startInput.call(this);
    };

    //-------------------------------------------------------------------------
    // Game_Interpreter#set_symbols (0118.rb:237)
    //-------------------------------------------------------------------------
    function set_symbols(id, inputs) {
        var i = parseInt(id, 10);
        if (isNaN(i) || i < 1) { return false; }
        var list = inputs;
        if (!list || typeof list.length !== 'number') {
            list = Array.prototype.slice.call(arguments, 1);
        }
        var out = [];
        for (var k = 0; k < list.length; k++) { out.push(String(list[k])); }
        $gameMessage.keyInputs()[i - 1] = out;
        return true;
    }

    window.set_symbols = set_symbols;
    MonlineSymbolDial.set_symbols = set_symbols;

    if (window.MonlineShim && window.MonlineShim.functions) {
        var i = window.MonlineShim.functions.indexOf('set_symbols');
        if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
    }
    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.set_symbols = set_symbols;
        var C = window.MonlineRuby.COSMETIC;
        if (C) {
            var j = C.indexOf('set_symbols');
            if (j >= 0) { C.splice(j, 1); }
        }
    }

    console.log('[MonlineSymbolDial] loaded');
})();
