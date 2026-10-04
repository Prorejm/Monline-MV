//=============================================================================
// MonlineMenuModern.js
//=============================================================================
/*:
 * @plugindesc Modern menu shell: a horizontal command bar, the party row
 * beneath it, gold at the bottom right.
 * @author Monline port
 *
 * @help
 * Adapted from the RPG Maker MV sample plugin AltMenuScreen (Yoji Ojima),
 * which is also what the TSF Dungeon reference build uses.  The sample's
 * 4-column layout assumed a four-hero party; Monline travels alone, so this
 * is retuned for this game:
 *
 *   * the command bar is 5 columns x 2 rows across the top, which fits the
 *     menu's ten commands (Items / Abilities / Equipment / Status / Group /
 *     Tasks / Item Book / Options / Save / Quit) without scrolling;
 *   * the party row spans the full width under the bar, in the sample's
 *     wide-face style;
 *   * the gold window moves to the bottom right, opposite the command bar;
 *   * the item/skill target window sits just below the command bar;
 *   * every command keeps its Yanfly glyph (MonlineCommandIcons).
 *
 * The two commands this pack adds get glyphs too: Tasks -> the Guide icon
 * (8912) and Item Book -> the red book (8928).
 */
//=============================================================================

var MonlineMenuModern = MonlineMenuModern || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Glyphs for the commands the modern pack adds (see MonlineCommandIcons).
    //-------------------------------------------------------------------------
    if (window.MonlineCommandIcons && MonlineCommandIcons.ICON_HASH) {
        MonlineCommandIcons.ICON_HASH['Tasks'] = 8912;      // Guide
        MonlineCommandIcons.ICON_HASH['Item Book'] = 8928;  // red book
    }

    //-------------------------------------------------------------------------
    // Command bar - full width, 5 x 2 (AltMenuScreen's layout, retuned)
    //-------------------------------------------------------------------------
    Window_MenuCommand.prototype.windowWidth = function () {
        return Graphics.boxWidth;
    };
    Window_MenuCommand.prototype.maxCols = function () {
        return 5;
    };
    Window_MenuCommand.prototype.numVisibleRows = function () {
        return 2;
    };

    //-------------------------------------------------------------------------
    // Party row - full width under the bar (AltMenuScreen's wide-face style)
    //-------------------------------------------------------------------------
    Window_MenuStatus.prototype.windowWidth = function () {
        return Graphics.boxWidth;
    };
    Window_MenuStatus.prototype.windowHeight = function () {
        var h1 = this.fittingHeight(1);   // the gold window height
        var h2 = this.fittingHeight(2);   // the command bar height
        return Graphics.boxHeight - h1 - h2;
    };
    Window_MenuStatus.prototype.maxCols = function () {
        return 4;
    };
    Window_MenuStatus.prototype.numVisibleRows = function () {
        return 1;
    };
    Window_MenuStatus.prototype.drawItemImage = function (index) {
        var actor = $gameParty.members()[index];
        var rect = this.itemRectForText(index);
        var w = Math.min(rect.width, 144);
        var h = Math.min(rect.height, 144);
        var lineHeight = this.lineHeight();
        this.changePaintOpacity(actor.isBattleMember());
        this.drawActorFace(actor, rect.x, rect.y + lineHeight * 2.5, w, h);
        this.changePaintOpacity(true);
    };
    Window_MenuStatus.prototype.drawItemStatus = function (index) {
        var actor = $gameParty.members()[index];
        var rect = this.itemRectForText(index);
        var x = rect.x;
        var y = rect.y;
        var width = rect.width;
        var bottom = y + rect.height;
        var lineHeight = this.lineHeight();
        this.drawActorName(actor, x, y + lineHeight * 0, width);
        this.drawActorLevel(actor, x, y + lineHeight * 1, width);
        this.drawActorClass(actor, x, bottom - lineHeight * 4, width);
        this.drawActorHp(actor, x, bottom - lineHeight * 3, width);
        this.drawActorMp(actor, x, bottom - lineHeight * 2, width);
        this.drawActorIcons(actor, x, bottom - lineHeight * 1, width);
    };

    //-------------------------------------------------------------------------
    // Scene_Menu - place the panels, gold to the far corner
    //-------------------------------------------------------------------------
    var _Scene_Menu_create = Scene_Menu.prototype.create;
    Scene_Menu.prototype.create = function () {
        _Scene_Menu_create.call(this);
        this._statusWindow.x = 0;
        this._statusWindow.y = this._commandWindow.height;
        this._goldWindow.x = Graphics.boxWidth - this._goldWindow.width;
    };

    // the item/skill target window opens just below the command bar
    var _Window_MenuActor_initialize = Window_MenuActor.prototype.initialize;
    Window_MenuActor.prototype.initialize = function () {
        _Window_MenuActor_initialize.call(this);
        this.y = this.fittingHeight(2);
    };

    console.log('[MonlineMenuModern] loaded');
})();
