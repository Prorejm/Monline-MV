//=============================================================================
// MonlineNewItem.js
//=============================================================================
/*:
 * @plugindesc A "NEW" ribbon over items obtained for the first time.
 * @author Monline port
 *
 * @help
 * Port of Galv's New Item Indication v1.2 (Galv_NewItemIndication.js), which
 * is also what the TSF Dungeon reference build uses, with one change: the
 * ribbon is drawn on the fly instead of being an image in /img/system/, so
 * there is no asset to ship and it stays crisp on the game's 24px icon grid.
 *
 * Behaviour is Galv's exactly:
 *   * gaining an item/weapon/armour for the first time marks it NEW;
 *   * the ribbon shows in every item list (inventory, shop, equip, ...);
 *   * examining the entry (cursor over it, then away) clears the mark;
 *   * the seen-item table lives in $gameSystem, so it is saved with the game.
 */
//=============================================================================

var MonlineNewItem = MonlineNewItem || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // The seen table
    //-------------------------------------------------------------------------
    function seenItems() {
        if (!$gameSystem._seenItems) {
            $gameSystem._seenItems = { items: [], weapons: [], armors: [] };
        }
        return $gameSystem._seenItems;
    }
    MonlineNewItem.seenItems = seenItems;

    function typeOf(item) {
        if (!item) { return null; }
        if (item.itypeId) { return 'items'; }
        if (item.wtypeId) { return 'weapons'; }
        if (item.atypeId) { return 'armors'; }
        return null;
    }

    /** Galv.NII.becomeOld - true the first time an entry is examined. */
    function becomeOld(item) {
        var type = typeOf(item);
        if (!type) { return false; }
        if (!seenItems()[type][item.id]) {
            seenItems()[type][item.id] = 1;
            return true;
        }
        return false;
    }
    MonlineNewItem.becomeOld = becomeOld;

    function isNew(item) {
        var type = typeOf(item);
        return !!type && !seenItems()[type][item.id];
    }
    MonlineNewItem.isNew = isNew;

    //-------------------------------------------------------------------------
    // The ribbon - drawn, not blitted (the game's icons are 24px on a custom
    // chunked sheet, so there is no 32px overlay image to lean on)
    //-------------------------------------------------------------------------
    var RIBBON_W = 23;
    var RIBBON_H = 10;

    function drawNewRibbon(window, x, y) {
        var contents = window.contents;
        var ctx = contents && contents._context;
        if (!ctx) { return; }
        var old = ctx.globalAlpha;
        ctx.globalAlpha = 0.85;
        contents.fillRect(x, y, RIBBON_W, RIBBON_H, '#202020');
        ctx.globalAlpha = old;
        window.changeTextColor('#ffe38a');
        contents.fontSize = 9;
        contents.drawText('NEW', x + 3, y - 1, RIBBON_W - 3, RIBBON_H + 2);
        window.resetFontSettings();
    }

    //-------------------------------------------------------------------------
    // Window_ItemList - Galv's hooks
    //-------------------------------------------------------------------------
    var _Window_ItemList_drawItemName = Window_ItemList.prototype.drawItemName;
    Window_ItemList.prototype.drawItemName = function (item, x, y, width) {
        _Window_ItemList_drawItemName.call(this, item, x, y, width);
        if (item && isNew(item)) {
            drawNewRibbon(this, x, y);
        }
    };

    var _Window_ItemList_initialize = Window_ItemList.prototype.initialize;
    Window_ItemList.prototype.initialize = function (x, y, width, height) {
        _Window_ItemList_initialize.call(this, x, y, width, height);
        this._viewedNewIndex = null;
    };

    // the mark clears when the cursor moves away from the entry
    var _Window_ItemList_updateHelp = Window_ItemList.prototype.updateHelp;
    Window_ItemList.prototype.updateHelp = function () {
        _Window_ItemList_updateHelp.call(this);
        if (this._viewedNewIndex !== null && this._viewedNewIndex !== undefined) {
            this.redrawItem(this._viewedNewIndex);
            this._viewedNewIndex = null;
        }
        if (becomeOld(this.item())) {
            this._viewedNewIndex = this.index();
        }
    };

    // ...or when the list closes
    var _Window_ItemList_deactivate = Window_ItemList.prototype.deactivate;
    Window_ItemList.prototype.deactivate = function () {
        _Window_ItemList_deactivate.call(this);
        if (this._viewedNewIndex !== null && this._viewedNewIndex !== undefined) {
            this.refresh();
            this._viewedNewIndex = null;
        }
    };

    console.log('[MonlineNewItem] loaded');
})();
