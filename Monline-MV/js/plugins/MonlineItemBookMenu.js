//=============================================================================
// MonlineItemBookMenu.js
//=============================================================================
/*:
 * @plugindesc Menu wiring for the stock ItemBook plugin.
 * @author Monline port
 *
 * @help
 * ItemBook.js (Yoji Ojima's MV sample, the same file the TSF Dungeon
 * reference build ships) registers the ItemBook scene and its plugin
 * commands but adds no way to open it.  This puts the command on the menu,
 * between Tasks and Options, with the red book glyph (8928).
 *
 * Items, weapons and armours are recorded when gained and persist in the
 * save ($gameSystem._ItemBookFlags), matching the plugin's own behaviour.
 *
 * Plugin commands (from ItemBook.js):
 *   ItemBook open / add weapon 3 / remove armor 5 / complete / clear
 */
//=============================================================================

var MonlineItemBookMenu = MonlineItemBookMenu || {};

(function () {
    'use strict';

    var _MenuCommand_addOriginalCommands =
        Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function () {
        _MenuCommand_addOriginalCommands.call(this);
        if (typeof window.Scene_ItemBook !== 'function') { return; }
        this.addCommand('Item Book', 'itemBook', true);
    };

    var _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _Scene_Menu_createCommandWindow.call(this);
        if (typeof window.Scene_ItemBook !== 'function') { return; }
        this._commandWindow.setHandler('itemBook',
            this.commandItemBook.bind(this));
    };

    Scene_Menu.prototype.commandItemBook = function () {
        SceneManager.push(window.Scene_ItemBook);
    };

    console.log('[MonlineItemBookMenu] loaded');
})();
