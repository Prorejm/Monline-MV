// Screenshot the windows whose icon placement the player reported wrong
// (item / skill / equip / status) and dump exactly where each icon lands.
//   node probe_menu_icons.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(6000);
  for (let i = 0; i < 40; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(120);
    const st = await p.evaluate(() => ({ b: $gameMessage.isBusy(), e: $gameMap.isEventRunning() }));
    if (!st.b && !st.e) break;
  }

  // the new-game party has an empty bag, so seed it with one of everything
  await p.evaluate(() => {
    for (let i = 1; i < $dataItems.length; i++) { if ($dataItems[i]) $gameParty.gainItem($dataItems[i], 3); }
    for (let i = 1; i < $dataWeapons.length; i++) { if ($dataWeapons[i]) $gameParty.gainItem($dataWeapons[i], 3); }
    for (let i = 1; i < $dataArmors.length; i++) { if ($dataArmors[i]) $gameParty.gainItem($dataArmors[i], 3); }
    $gameParty.setMenuActor($gameActors.actor(1));
  });

  await p.evaluate(() => {
    window.__icons = [];
    const real = Window_Base.prototype.drawIcon;
    Window_Base.prototype.drawIcon = function (iconIndex, x, y) {
      window.__icons.push({ i: iconIndex, x: x, y: y,
        w: Window_Base._iconWidth, h: Window_Base._iconHeight,
        win: this.constructor.name });
      return real.apply(this, arguments);
    };
  });

  for (const sc of ['Scene_Item', 'Scene_Equip', 'Scene_Status', 'Scene_Skill']) {
    await p.evaluate(() => { window.__icons = []; });
    await p.evaluate(n => { SceneManager.push(window[n]); }, sc);
    await sleep(2600);
    await p.screenshot({ path: OUT + 'icons_' + sc + '.png' });
    const info = await p.evaluate(() => ({
      scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
      err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
             .replace(/<[^>]+>/g, '').slice(0, 160),
      icons: window.__icons.slice(0, 10),
      total: window.__icons.length,
      windows: Object.keys(SceneManager._scene)
        .filter(k => /^_/.test(k) && SceneManager._scene[k] &&
                     SceneManager._scene[k] instanceof Window)
        .map(k => ({ k: k, cls: SceneManager._scene[k].constructor.name,
                     x: Math.round(SceneManager._scene[k].x),
                     y: Math.round(SceneManager._scene[k].y),
                     w: Math.round(SceneManager._scene[k].width),
                     h: Math.round(SceneManager._scene[k].height) }))
    }));
    console.log('=== ' + sc + ' ===');
    console.log(JSON.stringify(info));
    // back to the map for the next one
    let guard = 0;
    while (guard++ < 6) {
      const back = await p.evaluate(() => {
        if (SceneManager._scene.constructor.name === 'Scene_Map') { return true; }
        SceneManager.pop();
        return false;
      });
      if (back) { break; }
      await sleep(700);
    }
    await sleep(700);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
