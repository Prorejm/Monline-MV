//=============================================================================
// MonlineCommandIcons.js
//=============================================================================
/*:
 * @plugindesc Port of Yanfly Engine Ace - Command Window Icons v1.00 (0124.rb).
 * @author Monline port
 *
 * @help
 * 0124.rb draws an icon in front of any command whose *text* matches
 * YEA::COMMAND_WINDOW_ICONS::ICON_HASH exactly.  That table is why the
 * original's menu, item categories, skill types, battle commands, shop
 * commands and title commands all carry a small glyph:
 *
 *     Items 8891 · Weapons 8902 · Armour 8903 · Key Items 8904
 *     Techniques 8888 · Talents 8889 · Learn 8907
 *     Status 8894 · Equipment 8893 · Save 8897 · Quit 8899 ...
 *
 * Without this port every one of those windows draws the bare word - which is
 * exactly the "the icons on Status / Armour / Weapons / Items / Skills are in
 * the wrong place" report: they were not misplaced, they were missing, and the
 * only icons left on screen were the ones drawn by other systems.
 *
 * Faithful to the Ruby:
 *   * the lookup is on the exact command text, case sensitive;
 *   * the icon is drawn at the left edge of the item rect and the text keeps
 *     its original alignment inside a rect narrowed by one icon cell;
 *   * `enabled` drives the icon's opacity, like draw_icon's last argument.
 *
 * Not carried over: `\i[n]` in a Terms string.  The game's Terms do contain
 * three literal "\*i[nnnn]" entries (the VX Ace armor3/armor4/weapon1 slots),
 * and VX Ace's escape pass swallowed the unknown "\*" but MV draws them
 * literally - those now render as their icon too, which is what the original
 * showed once the dead code was consumed.
 */
//=============================================================================

var MonlineCommandIcons = MonlineCommandIcons || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // YEA::COMMAND_WINDOW_ICONS::ICON_HASH - verbatim from 0124.rb:55
    //-------------------------------------------------------------------------
    var ICON_HASH = {
        'New Game': 8880,       // Title scene.
        'Continue': 8881,       // Title scene.
        'Cheats': 8909,         // Title scene.

        'Fight': 8883,          // Battle scene.
        'Run Away': 8884,       // Battle scene.
        'Attack': 8885,         // Battle scene.
        'Guard': 8886,          // Battle scene.
        'Auto': 8908,           // Battle scene.
        'Log': 8887,            // Battle scene.

        'Techniques': 8888,     // Skill scene. Battle scene.
        'Talents': 8889,        // Skill scene. Battle scene.
        'Imitations': 8890,     // Skill scene. Battle scene.
        'Magic': 8927,          // Skill scene. Battle scene.
        'Stances': 8913,        // Skill scene. Battle scene.
        'Chants': 8914,         // Skill scene. Battle scene.
        'Functions': 8925,      // Skill scene. Battle scene.
        'Learn': 8907,          // Skill scene. Battle scene.

        'Items': 8891,          // Menu scene. Item scene. Battle scene.
        'Abilities': 8892,      // Menu scene.
        'Equipment': 8893,      // Menu scene.
        'Status': 8894,         // Menu scene.
        'Party': 8895,          // Menu scene.
        'Load': 8896,           // Menu scene.
        'Save': 8897,           // Menu scene.
        'Delete': 8898,         // Menu scene.
        'Quit': 8899,           // Menu scene.
        'Trade': 8901,          // Menu scene.
        'Guidance': 8912,       // Menu scene.
        'Options': 8915,        // Menu scene.

        'PXE': 8900,            // Menu scene.
        'PXEpedia': 9219,       // Menu scene.
        'Return': 9216,         // Menu scene.
        'Bestiary': 9217,       // Menu scene.
        'PXE Shop': 9218,       // Menu scene.
        'Augment': 9223,        // Menu scene.

        'Memories': 8926,       // Menu scene.

        'Buy': 8910,            // Shop scene.
        'Sell': 8911,           // Shop scene.

        'Weapons': 8902,        // Item scene.
        'Armour': 8903,         // Item scene.
        'Key Items': 8904,      // Item scene.

        'To Title': 8905,       // Game End scene.
        'Cancel': 8906,         // Game End scene.

        'Slot 1': 8919,         // Loadout scene.
        'Slot 2': 8920,         // Loadout scene.
        'Slot 3': 8921          // Loadout scene.
    };

    MonlineCommandIcons.ICON_HASH = ICON_HASH;

    /** 0124.rb:132 use_icon? */
    function useIcon(text) {
        return Object.prototype.hasOwnProperty.call(ICON_HASH, text);
    }
    /** 0124.rb:139 command_icon */
    function commandIcon(text) {
        return ICON_HASH[text];
    }
    MonlineCommandIcons.useIcon = useIcon;
    MonlineCommandIcons.commandIcon = commandIcon;

    /**
     * VX Ace's escape pass drops codes it does not understand, so the game's
     * Terms entries that read "\*i[nnnn]" rendered as the bare icon.  MV's
     * drawText has no escape pass, so those have to be resolved here.
     * Returns { icon: n|null, text: cleaned }.
     */
    function splitEscapeIcons(text) {
        var m = /\\[iI]\[\s*(\d+)\s*\]/.exec(text);
        if (!m) { return null; }
        return {
            icon: parseInt(m[1], 10),
            // strip every escape code - that is what RGSS3's
            // convert_escape_characters did to unknown ones
            text: text.replace(/\\[^\[]*(\[[^\]]*\])?/g, '')
        };
    }
    MonlineCommandIcons.splitEscapeIcons = splitEscapeIcons;

    //-------------------------------------------------------------------------
    // 0124.rb:146 - overwrite draw_item
    //-------------------------------------------------------------------------
    var _Window_Command_drawItem = Window_Command.prototype.drawItem;
    Window_Command.prototype.drawItem = function (index) {
        var text = this.commandName(index);
        var icon = null;
        var clean = null;

        if (useIcon(text)) {
            icon = commandIcon(text);
        } else {
            var esc = splitEscapeIcons(text);
            if (esc) { icon = esc.icon; clean = esc.text; }
        }

        if (icon === null) {
            _Window_Command_drawItem.call(this, index);
            return;
        }

        var enabled = this.isCommandEnabled(index);
        this.changePaintOpacity(enabled);
        var rect = this.itemRectForText(index);
        // 0124.rb:164 draw_icon_text - the icon takes a cell, the text keeps
        // its alignment in whatever rect is left.
        this.drawIcon(icon, rect.x, rect.y + 1);
        rect.x += 24;
        rect.width -= 24;
        this.changeTextColor(this.normalColor());
        if (clean === null) {
            clean = text;
            // the icon already identifies the command, matching the Ruby,
            // which still draws the (unchanged) text after the icon
        }
        this.drawText(clean, rect.x, rect.y, rect.width,
                      this.itemTextAlign ? this.itemTextAlign() : 'left');
    };

    console.log('[MonlineCommandIcons] loaded ' + Object.keys(ICON_HASH).length + ' entries');
})();
