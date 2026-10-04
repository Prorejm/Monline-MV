// Capture the full stack trace of the first exception raised while the opening
// cutscene plays.  SceneManager.catchException is replaced so that the game loop
// keeps running and we can record the very first failure instead of the
// error-screen freeze.
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
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message + '\n' + (e.stack || '')));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);

  await p.evaluate(() => {
    window.__errors = [];
    const orig = SceneManager.catchException;
    SceneManager.catchException = function (e) {
      window.__errors.push({
        msg: (e && e.message) || String(e),
        stack: (e && e.stack) || '',
        scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
        mapId: (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.mapId() : null,
        code: (function () {
          try {
            const it = $gameMap && $gameMap._interpreter;
            if (!it) return null;
            const c = it.currentCommand && it.currentCommand();
            return c ? { code: c.code, indent: c.indent, params: JSON.stringify(c.parameters).slice(0, 200) } : null;
          } catch (err) { return 'n/a'; }
        })()
      });
      // keep the loop alive
      if (SceneManager._scene && SceneManager._scene.constructor.name.indexOf('Scene_') === 0) { /* noop */ }
      console.log('CAUGHT ' + ((e && e.stack) || e));
    };
    console.log('patched catchException');
  });

  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(6000);

  // press OK to walk through the whole cutscene
  for (let i = 0; i < 120; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(110);
    const n = await p.evaluate(() => window.__errors.length);
    if (n > 0) break;
  }

  const errs = await p.evaluate(() => window.__errors);
  console.log('ERROR_COUNT ' + errs.length);
  errs.slice(0, 3).forEach((e, i) => {
    console.log('--- error #' + (i + 1) + ' ---');
    console.log('msg   : ' + e.msg);
    console.log('scene : ' + e.scene + '  mapId=' + e.mapId);
    console.log('cmd   : ' + JSON.stringify(e.code));
    console.log('stack :\n' + e.stack);
  });
  await p.screenshot({ path: 'G:/新建文件夹 (22)/Monline_MV/_shots/cutscene.png' });
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
