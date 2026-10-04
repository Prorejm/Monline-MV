// Why is the map black?  Transfer to a named map and report the tileset state.
// Run: NODE_PATH=<playwright-core workspace> node probe_map.js
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const fs = require('fs');
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { const t = m.text(); if (/error|fail|missing/i.test(t)) errs.push('CONSOLE: ' + t.slice(0, 160)); });

  await p.goto(URL, { waitUntil: 'load' });
  await sleep(6000);

  const info = await p.evaluate(() => {
    let target = null;
    for (const k in $dataMapInfos) {
      const mi = $dataMapInfos[k];
      if (mi && /prehistoric/i.test(mi.name)) { target = Number(k); break; }
    }
    return { target: target, mapInfos: target ? $dataMapInfos[target] : null };
  });
  console.log('mapInfos match:', JSON.stringify(info));

  if (!info.target) { console.log('no map matched; aborting'); await b.close(); return; }

  // skip the opening cutscene the way the smoke test does, or the transfer is
  // deferred while a message window is up
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  for (let i = 0; i < 60; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; }).catch(() => {});
    await sleep(120);
    const busy = await p.evaluate(() => $gameMessage.isBusy()).catch(() => false);
    if (!busy) { break; }
  }
  await p.evaluate(id => { $gamePlayer.reserveTransfer(id, 5, 5, 2, 0); }, info.target);
  await sleep(4500);
  await p.screenshot({ path: OUT + 'probe_map.png' });

  const st = await p.evaluate(() => {
    const r = { mapId: $gameMap.mapId(), name: $dataMap.displayName, tilesetId: $dataMap.tilesetId };
    const ts = $dataTilesets[$dataMap.tilesetId];
    r.tilesetName = ts && ts.name;
    r.tilesetNames = ts ? ts.tilesetNames : null;
    r.bitmaps = {};
    if (ts) {
      ts.tilesetNames.forEach((n, i) => {
        if (!n) { r.bitmaps[i] = '(unused)'; return; }
        const bmp = ImageManager.loadTileset(n);
        r.bitmaps[i] = { name: n, w: bmp.width, h: bmp.height, ready: bmp.isReady() };
      });
    }
    const sc = SceneManager._scene;
    r.scene = sc && sc.constructor.name;
    r.tilemap = !!(sc && sc._tilemap);
    r.screen = { x: $gameMap.displayX(), y: $gameMap.displayY() };
    r.events = ($dataMap.events || []).filter(Boolean).length;
    return r;
  }).catch(e => ({ err: e.message }));

  console.log(JSON.stringify(st, null, 1));
  console.log('--- notes ---');
  errs.slice(0, 10).forEach(e => console.log('  ' + e));
  await b.close();
})();
