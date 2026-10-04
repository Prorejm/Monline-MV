// Focused diagnostic: why did $gamePlayer.reserveTransfer() not take effect?
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
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text().slice(0, 200)); });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(6000);

  const state = () => p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      scene: sc ? sc.constructor.name : null,
      mapId: $gameMap.mapId(),
      active: sc && sc.isActive ? sc.isActive() : null,
      msgBusy: $gameMessage.isBusy(),
      msgText: (function () { try { return ($gameMessage._texts || []).join('|').slice(0, 80); } catch (e) { return ''; } })(),
      changing: SceneManager.isSceneChanging(),
      next: SceneManager._nextScene ? SceneManager._nextScene.constructor.name : null,
      transferring: $gamePlayer.isTransferring(),
      interp: $gameMap._interpreter ? $gameMap._interpreter.isRunning() : null,
      evRunning: $gameMap.isEventRunning(),
      faders: (SceneManager._scene && SceneManager._scene._fadeSprite) ? true : false
    };
  });

  console.log('STATE(before) ' + JSON.stringify(await state()));

  // is anything auto-running on this map?
  const autorun = await p.evaluate(() => {
    const out = [];
    $gameMap.events().forEach(ev => {
      if (ev && ev._starting && ev.page()) {
        const t = ev.page().trigger;
        if (t === 0 || t === 1) out.push({ id: ev.eventId(), trigger: t, pages: ev.event().pages.length });
      }
    });
    return out.slice(0, 10);
  }).catch(e => 'err ' + e.message);
  console.log('AUTORUN/PARALLEL ' + JSON.stringify(autorun));

  console.log('--- reserveTransfer(1,5,5,2,0) ---');
  await p.evaluate(() => { $gamePlayer.reserveTransfer(1, 5, 5, 2, 0); });
  for (let i = 0; i < 10; i++) {
    await sleep(600);
    console.log('T+' + ((i + 1) * 0.6).toFixed(1) + 's ' + JSON.stringify(await state()));
  }
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
