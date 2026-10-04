// Per-window icon verification.
//
// MonlineIconSet overrides `Window_Base#drawIcon` and `Sprite_StateIcon`, and
// every icon in the game funnels through those two.  But "the override works"
// is not the same as "the skill list shows its icons", so this probe draws real
// database rows through the *real window classes* and compares the rendered
// icon box against the icon's own pixels from the chunked sheet.
//
// Run: NODE_PATH=<playwright-core workspace> node probe_icon_windows.js
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', e => console.log('PAGEERROR: ' + e.message));

  await p.goto(URL, { waitUntil: 'load' });
  await sleep(6000);

  const out = await p.evaluate(() => {
    DataManager.setupNewGame();   // database + party; no map needed for windows

    const CW = Window_Base._iconWidth, CH = Window_Base._iconHeight;
    const r = { cell: [CW, CH], targets: {} };

    // the icon's own pixels, straight from the chunk the plugin picks
    function sourcePixels(iconIndex) {
      const f = MonlineIconSet.frameFor(iconIndex);
      const t = new Bitmap(CW, CH);
      t.blt(MonlineIconSet.bitmapFor(iconIndex), f.sx, f.sy, f.width, f.height, 0, 0);
      let n = 0;
      for (let y = 0; y < CH; y++) { for (let x = 0; x < CW; x++) { if (t.getAlphaPixel(x, y) > 0) n++; } }
      return n;
    }

    // draw one entry through a real window class and read back its icon box.
    // Paint opacity is forced to opaque first: drawItemName applies
    // `changePaintOpacity(isEnabled(item))`, and without an actor in context
    // `isEnabled` is false, which multiplies every pixel's alpha by
    // 160/255 and rounds the faint ones to zero.  That is correct MV
    // behaviour, not an icon defect -- so the equality test has to run at
    // full opacity to be meaningful.
    function probe(kind, entry, win) {
      win.contents.clear();
      win.changePaintOpacity(true);
      win.drawItemName(entry, 0, 1, 300, true);
      const drawn = [];
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          drawn.push(win.contents.getAlphaPixel(x + 2, y + 2));
        }
      }
      const want = sourcePixels(entry.iconIndex);
      // the drawn box must equal the source icon pixel-for-pixel
      const src = (() => {
        const f = MonlineIconSet.frameFor(entry.iconIndex);
        const t = new Bitmap(CW, CH);
        t.blt(MonlineIconSet.bitmapFor(entry.iconIndex), f.sx, f.sy, f.width, f.height, 0, 0);
        const a = [];
        for (let y = 0; y < CH; y++) { for (let x = 0; x < CW; x++) { a.push(t.getAlphaPixel(x, y)); } }
        return a;
      })();
      // where did the drawn icon actually land?  Scan a generous area and take
      // the bounding box of lit pixels, so an offset or a crop shows itself
      // immediately instead of hiding inside a per-pixel comparison.
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let y = 0; y < 60; y++) {
        for (let x = 0; x < 90; x++) {
          if (win.contents.getAlphaPixel(x, y) > 0) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      let same = 0;
      for (let i = 0; i < src.length; i++) { if (src[i] === drawn[i]) { same++; } }
      r.targets[kind] = {
        drawnBBox: [minX, minY, maxX, maxY], expectedBBox: [2, 3, 25, 26],
        iconIndex: entry.iconIndex,
        chunk: MonlineIconSet.frameFor(entry.iconIndex).chunk,
        srcPx: want, drawnPx: drawn.filter(v => v > 0).length,
        match: same === src.length
      };
    }

    // pick the highest-iconIndex row of each database, so the probe exercises
    // the highest chunk (the one that used to render as nothing at all)
    const best = (arr) => arr.reduce((a, v) => (v && v.iconIndex > (a ? a.iconIndex : -1)) ? v : a, null);

    const winItem = new Window_ItemList(0, 0, 400, 300);
    const winSkill = new Window_SkillList(0, 0, 400, 300);
    const winEquip = new Window_EquipItem(0, 0, 400, 300);
    const winBase = new Window_Base(0, 0, 400, 300);

    probe('item', best($dataItems), winItem);
    probe('skill', best($dataSkills), winSkill);
    probe('weapon', best($dataWeapons), winEquip);
    probe('armor', best($dataArmors), winEquip);

    // state icons ride on Sprite_StateIcon, which reads the sheet itself
    const state = best($dataStates.filter(s => s && s.iconIndex));
    r.targets.state = {
      iconIndex: state.iconIndex,
      chunk: MonlineIconSet.frameFor(state.iconIndex).chunk,
      srcPx: sourcePixels(state.iconIndex)
    };
    const si = new Sprite_StateIcon();
    si.loadBitmap();
    si._iconIndex = state.iconIndex;
    si.updateFrame();
    const f = MonlineIconSet.frameFor(state.iconIndex);
    r.targets.state.chunkBitmapH = si.bitmap.height;
    r.targets.state.frame = [si._frame.x, si._frame.y, si._frame.width, si._frame.height];
    r.targets.state.expectedFrame = [f.sx, f.sy, f.width, f.height];
    r.targets.state.correct = r.targets.state.frame.every((v, i) => v === r.targets.state.expectedFrame[i])
      && si.bitmap.height === (f.chunk === 3 ? 1560 : 6144);

    // actor state icons through the real window helper
    const actor = $gameActors.actor(1);
    r.targets.actorIcons = { count: actor.allIcons().length, viaWindow: !!winBase.drawActorIcons };

    // a battle scene, because state icons only render there
    r.battleProbe = (function () {
      try {
        const w = new Window_BattleLog(0, 0, 400, 300);
        w.contents.clear();
        w.drawIcon(best($dataSkills).iconIndex, 0, 0);
        let n = 0;
        for (let y = 0; y < CH; y++) { for (let x = 0; x < CW; x++) { if (w.contents.getAlphaPixel(x, y) > 0) n++; } }
        return { battleLogIconPx: n, ok: n > 0 };
      } catch (e) { return { err: e.message }; }
    })();

    r.summary = (function () {
      const t = r.targets;
      const keys = ['item', 'skill', 'weapon', 'armor'];
      return {
        allMatch: keys.every(k => t[k] && t[k].match && t[k].srcPx > 0),
        stateCorrect: !!t.state.correct,
        maxIconIndex: Math.max(t.item.iconIndex, t.skill.iconIndex, t.weapon.iconIndex, t.armor.iconIndex)
      };
    })();
    return r;
  }).catch(e => ({ err: e.message }));

  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
