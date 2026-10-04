//=============================================================================
// MonlineShopManager.js
//=============================================================================
/*:
 * @plugindesc Port of Hime Shop Manager (0177.rb) + Shop Stock (0178.rb): get_shop / price_good / hide_good / disable_good / @shop_stock.
 * @author Monline port
 *
 * @help
 * Two VX Ace scripts drive every shop in this game.  Before this port their
 * script calls were recorded-and-ignored (MonlineChoice.js evaluated the
 * condition and then dropped the answer on the floor), so the shops opened
 * with their full stock, at list price, with nothing ever disabled.
 *
 *   0177.rb  Shop Manager
 *     get_shop("Santa")            # this shop keeps its identity across visits
 *     disable_good(1, "v[95]<5")   # good 1 is greyed out while v[95] < 5
 *     hide_good(4,  "s[12]")       # good 4 is not listed at all
 *     price_good(2, "v[10] * 5")   # good 2 gets a computed price
 *
 *   0178.rb  Shop Stock
 *     @shop_stock[1] = 10          # good 1 has 10 in stock
 *     @shop_stock[5] = 1           # good 5 has 1
 *
 * Measured usage: disable_good 63, get_shop 9, hide_good 5, @shop_stock 103.
 *
 * ---------------------------------------------------------------------------
 * What the original actually does
 * ---------------------------------------------------------------------------
 * `get_shop(id)` makes the shop *persistent*: `ShopManager.setup_shop` returns
 * the cached `Game_Shop` when it does not need a refresh, so the goods - and
 * therefore their remaining stock - survive between visits and across saves.
 * That is the whole point of the Santa shop: you buy the 10-stock gifts once.
 *
 * Stock semantics (0178.rb:48):
 *   stock < 0  -> unlimited (no `[n]` shown, no cap)
 *   stock == 0 -> the good is not listed at all
 *   stock > 0  -> capped, drawn as `[n]`, decremented on purchase
 *
 * Conditions and price formulas are Ruby evaluated with `v` = variables,
 * `s` = switches, `p` = party, `t` = troop bound as local names.
 *
 * ---------------------------------------------------------------------------
 * How this port reproduces it
 * ---------------------------------------------------------------------------
 * MV's `command302` collects the goods and hands the raw
 * `[itemType, itemId, priceType, price]` rows to `Scene_Shop`.  This port
 * rebuilds that array at command time - dropping hidden and sold-out goods,
 * applying computed prices - and keeps a parallel array of
 * `{disabled, stock}` that `Window_ShopBuy` reads to grey items out, draw the
 * `[n]` counter and cap `Scene_Shop#maxBuy`.
 *
 * Only the stock has to be persisted (everything else is recomputed from the
 * event each time), so it lives on `$gameSystem` and rides along with the save.
 */
//=============================================================================

var MonlineShopManager = MonlineShopManager || {};

(function () {
    'use strict';

    var EMPTY = -1;                       // 0178.rb:89 `@stock = -1`

    //-------------------------------------------------------------------------
    // Persistent stock: $gameSystem._monlineShopStock[shopId][goodId]
    //-------------------------------------------------------------------------
    function stockTable() {
        if (!$gameSystem) { return {}; }
        if (!$gameSystem._monlineShopStock) { $gameSystem._monlineShopStock = {}; }
        return $gameSystem._monlineShopStock;
    }
    function shopStock(shopId, create) {
        var t = stockTable();
        var k = String(shopId);
        if (!t[k]) {
            if (!create) { return null; }
            t[k] = {};
        }
        return t[k];
    }
    MonlineShopManager.shopStock = shopStock;

    //-------------------------------------------------------------------------
    // Ruby formula evaluation - `v / s / p / t` bound like 0177.rb:608
    //-------------------------------------------------------------------------
    function evalRuby(src) {
        var MR = window.MonlineRuby;
        if (!MR || !MR.evalExpr) { return undefined; }
        var body = '(function(v,s,p,t){ return (' + src + '); })' +
                   '($game_variables, $game_switches, $game_party, $game_troop)';
        try {
            return MR.evalExpr(body, MR.current);
        } catch (e) {
            return undefined;
        }
    }
    /** A condition: empty means true (0177.rb:644 `return true`). */
    function evalCondition(src) {
        var s = String(src === undefined || src === null ? '' : src);
        if (s === '') { return false; }   // no option was set -> not hidden/disabled
        return !!evalRuby(s);
    }
    /** A price formula: empty/unset means "no formula, use the normal price". */
    function evalPrice(src) {
        var s = String(src === undefined || src === null ? '' : src);
        if (s === '') { return null; }
        var v = evalRuby(s);
        var n = parseInt(v, 10);
        return isNaN(n) ? null : n;
    }
    MonlineShopManager.evalCondition = evalCondition;
    MonlineShopManager.evalPrice = evalPrice;

    //-------------------------------------------------------------------------
    // Per-interpreter shop state
    //
    // 0177.rb:402 `clear` resets @shop_options / @shop_type / @shop_id, and
    // 0178.rb:69 resets @shop_stock = [].  Ruby calls `clear` from `setup`, so
    // hooking MV's `setup` reproduces both - including the fact that a child
    // interpreter (a common event) starts from a clean slate.
    //-------------------------------------------------------------------------
    function optionsOf(interp) {
        if (!interp._monlineShopOptions) {
            interp._monlineShopOptions = { hidden: {}, disabled: {}, price: {},
                                           sellPrice: {} };
        }
        return interp._monlineShopOptions;
    }

    // `@shop_stock[n] = x` is written by the event as a bare ivar, which
    // MR.translate turns into `__self.shop_stock[n] = x`.  The accessor makes
    // sure the array always exists, exactly like Ruby's `clear`.
    Object.defineProperty(Game_Interpreter.prototype, 'shop_stock', {
        configurable: true,
        get: function () {
            if (!this._shopStock) { this._shopStock = []; }
            return this._shopStock;
        },
        set: function (v) { this._shopStock = v || []; }
    });

    var _setup = Game_Interpreter.prototype.setup;
    Game_Interpreter.prototype.setup = function (list, eventId) {
        _setup.call(this, list, eventId);
        this._monlineShopOptions = { hidden: {}, disabled: {}, price: {},
                                     sellPrice: {} };
        this._shopStock = [];
        this._monlineShopId = null;
    };

    function currentInterp() {
        var MR = window.MonlineRuby;
        return (MR && MR.current) ? MR.current : null;
    }

    //-------------------------------------------------------------------------
    // Script calls (0177.rb:539-588)
    //-------------------------------------------------------------------------
    // 0177.rb:539 - remember the shop id; the next [Shop Processing] uses it
    function get_shop(id) {
        var i = currentInterp();
        if (!i) { return false; }
        i._monlineShopId = id;
        return true;
    }
    // 0177.rb:574
    function price_good(goodId, formula) {
        var i = currentInterp();
        if (!i) { return false; }
        optionsOf(i).price[goodId] = String(
            formula === undefined || formula === null ? '' : formula);
        return true;
    }
    // 0177.rb:578
    function hide_good(goodId, condition) {
        var i = currentInterp();
        if (!i) { return false; }
        optionsOf(i).hidden[goodId] = String(
            condition === undefined || condition === null ? '' : condition);
        return true;
    }
    // 0177.rb:582
    function disable_good(goodId, condition) {
        var i = currentInterp();
        if (!i) { return false; }
        optionsOf(i).disabled[goodId] = String(
            condition === undefined || condition === null ? '' : condition);
        return true;
    }
    // 0177.rb:527
    function add_shop_good(goodId, itemType, itemId, price) {
        var i = currentInterp();
        if (!i) { return false; }
        var t = itemType;
        if (t === 'item' || t === 0) { t = 0; }
        else if (t === 'weapon' || t === 1) { t = 1; }
        else if (t === 'armor' || t === 2) { t = 2; }
        if (!i._monlineCustomGoods) { i._monlineCustomGoods = []; }
        i._monlineCustomGoods.push([t, itemId,
                                    (price === undefined || price === null) ? 0 : 1,
                                    (price === undefined || price === null) ? 0 : price]);
        return true;
    }
    // 0177.rb:586
    function sell_price(itemStr, formula) {
        var i = currentInterp();
        if (!i) { return false; }
        optionsOf(i).sellPrice[String(itemStr)] = String(formula);
        return true;
    }
    // 0177.rb:252
    function refresh_shop(shopId) {
        var t = stockTable();
        delete t[String(shopId)];
        return true;
    }

    //-------------------------------------------------------------------------
    // Goods assembly (0177.rb:459 command_302 + :477 load_all_goods)
    //-------------------------------------------------------------------------
    function buildGoods(interp, rawGoods) {
        var shopId = interp._monlineShopId;
        if (shopId === undefined || shopId === null) {
            shopId = [interp._mapId, interp._eventId];
        }
        var key = String(shopId);
        var opts = optionsOf(interp);
        var written = interp.shop_stock || [];
        var persisted = shopStock(key, true);

        var rows = rawGoods.slice();
        if (interp._monlineCustomGoods) {
            rows = rows.concat(interp._monlineCustomGoods);
        }

        var goods = [];
        var meta = [];
        for (var i = 0; i < rows.length; i++) {
            var goodId = i + 1;                       // 0177.rb:478 1-based
            var row = rows[i];
            if (!row) { continue; }

            // 0177.rb:593 hidden
            if (evalCondition(opts.hidden[goodId])) { continue; }

            // 0178.rb:74 stock - a persisted value wins once the shop exists
            var stock;
            if (persisted[goodId] !== undefined) {
                stock = persisted[goodId];
            } else if (written[goodId] !== undefined && written[goodId] !== null) {
                stock = parseInt(written[goodId], 10);
                if (isNaN(stock)) { stock = EMPTY; }
                persisted[goodId] = stock;
            } else {
                stock = EMPTY;
            }
            // 0177.rb:113 / 0178.rb:128 - sold out means not listed at all
            if (stock === 0) { continue; }

            var type = row[0], itemId = row[1];
            var priceType = row[2], price = row[3];
            var custom = evalPrice(opts.price[goodId]);
            if (custom !== null && custom !== undefined) {
                priceType = 1;
                price = custom;
            }

            goods.push([type, itemId, priceType, price]);
            meta.push({ goodId: goodId, shopKey: key,
                        disabled: evalCondition(opts.disabled[goodId]),
                        stock: stock, unlimited: stock < 0 });
        }

        MonlineShopManager.current = meta;
        MonlineShopManager.currentShopKey = key;
        return goods;
    }
    MonlineShopManager.buildGoods = buildGoods;

    var _command302 = Game_Interpreter.prototype.command302;
    Game_Interpreter.prototype.command302 = function () {
        if (!$gameParty.inBattle()) {
            var goods = [this._params];
            while (this.nextEventCode() === 605) {
                this._index++;
                goods.push(this.currentCommand().parameters);
            }
            goods = buildGoods(this, goods);
            SceneManager.push(Scene_Shop);
            SceneManager.prepareNextScene(goods, this._params[4]);
        }
        return true;
    };

    //-------------------------------------------------------------------------
    // Window_ShopBuy (0178.rb:124 + the disable flag from 0177.rb)
    //-------------------------------------------------------------------------
    var _makeItemList = Window_ShopBuy.prototype.makeItemList;
    Window_ShopBuy.prototype.makeItemList = function () {
        _makeItemList.call(this);
        // `makeItemList` skips a row when the item id does not resolve, so the
        // metadata has to be re-aligned against what actually made it in.
        var meta = MonlineShopManager.current || [];
        var goods = this._shopGoods || [];
        var g = 0;
        this._monlineMeta = [];
        for (var i = 0; i < goods.length; i++) {
            var item = null;
            if (goods[i][0] === 0) { item = $dataItems[goods[i][1]]; }
            else if (goods[i][0] === 1) { item = $dataWeapons[goods[i][1]]; }
            else if (goods[i][0] === 2) { item = $dataArmors[goods[i][1]]; }
            if (item) { this._monlineMeta.push(meta[g] || null); }
            g++;
        }
    };

    Window_ShopBuy.prototype.monlineMeta = function (index) {
        if (!this._monlineMeta) { return null; }
        return this._monlineMeta[index] || null;
    };

    // 0178.rb:132 - the `[n]` counter, only for limited stock
    var _drawItem = Window_ShopBuy.prototype.drawItem;
    Window_ShopBuy.prototype.drawItem = function (index) {
        _drawItem.call(this, index);
        var m = this.monlineMeta(index);
        if (!m || m.unlimited) { return; }
        var rect = this.itemRect(index);
        rect.x += 75;
        this.changePaintOpacity(this.isEnabled(this._data[index]));
        this.drawText('[' + m.stock + ']', rect.x, rect.y, rect.width, 'center');
        this.changePaintOpacity(true);
    };

    var _isEnabled = Window_ShopBuy.prototype.isEnabled;
    Window_ShopBuy.prototype.isEnabled = function (item) {
        if (!_isEnabled.call(this, item)) { return false; }
        var idx = this._data ? this._data.indexOf(item) : -1;
        if (idx < 0) { return true; }
        var m = this.monlineMeta(idx);
        if (!m) { return true; }
        if (m.disabled) { return false; }
        if (m.stock === 0) { return false; }
        return true;
    };

    //-------------------------------------------------------------------------
    // Scene_Shop (0178.rb:152)
    //-------------------------------------------------------------------------
    Scene_Shop.prototype.selectedMeta = function () {
        var buy = this._buyWindow;
        if (!buy) { return null; }
        return buy.monlineMeta(buy.index());
    };

    // 0178.rb:157 - the cap is min(party room, money, stock)
    var _maxBuy = Scene_Shop.prototype.maxBuy;
    Scene_Shop.prototype.maxBuy = function () {
        var max = _maxBuy.call(this);
        var m = this.selectedMeta();
        if (m && !m.unlimited) { max = Math.min(max, m.stock); }
        return max;
    };

    // 0178.rb:166 - buying decrements the stock, and the decrease persists
    var _doBuy = Scene_Shop.prototype.doBuy;
    Scene_Shop.prototype.doBuy = function (number) {
        _doBuy.call(this, number);
        var m = this.selectedMeta();
        if (!m || m.unlimited) { return; }
        var t = shopStock(m.shopKey, true);
        var left = Math.max((t[m.goodId] === undefined ? m.stock : t[m.goodId]) - number, 0);
        t[m.goodId] = left;
        m.stock = left;
    };

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    var API = {
        get_shop: get_shop,
        price_good: price_good,
        hide_good: hide_good,
        disable_good: disable_good,
        add_shop_good: add_shop_good,
        sell_price: sell_price,
        refresh_shop: refresh_shop
    };
    Object.keys(API).forEach(function (k) { window[k] = API[k]; });
    MonlineShopManager.api = API;

    if (window.MonlineShim && window.MonlineShim.functions) {
        Object.keys(API).forEach(function (k) {
            var i = window.MonlineShim.functions.indexOf(k);
            if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
        });
    }
    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        Object.keys(API).forEach(function (k) { F[k] = API[k]; });
        var C = window.MonlineRuby.COSMETIC;
        if (C) {
            window.MonlineRuby.COSMETIC = C.filter(function (n) {
                return ['get_shop', 'price_good', 'disable_good', 'hide_good']
                    .indexOf(n) < 0;
            });
        }
    }

    console.log('[MonlineShopManager] loaded');
})();
