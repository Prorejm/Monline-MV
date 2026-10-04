const { chromium } = require('playwright-core');
const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 30000 });
  await p.waitForTimeout(5000);
  const before = await p.evaluate(() => (typeof SceneManager !== 'undefined' && SceneManager._scene) ? SceneManager._scene.constructor.name : null);

  // 模拟“新游戏” -> 加载 startMapId 并构建地图场景(含 Tilemap)
  await p.evaluate(() => {
    try {
      DataManager.setupNewGame();
      SceneManager.goto(Scene_Map);
    } catch (e) { window.__ngErr = (e && e.message) || String(e); }
  });
  await p.waitForTimeout(7000);

  const after = await p.evaluate(() => {
    const S = (typeof SceneManager !== 'undefined') ? SceneManager._scene : null;
    return {
      scene: S ? S.constructor.name : null,
      newGameErr: window.__ngErr || null,
      mapId: (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.mapId() : null,
      hasSpriteset: !!(S && S._spriteset),
      partySize: (typeof $gameParty !== 'undefined' && $gameParty) ? $gameParty.members().length : -1,
      tilemapType: (S && S._spriteset && S._spriteset._tilemap) ? S._spriteset._tilemap.constructor.name : null
    };
  }).catch(e => ({ evalErr: e.message }));

  await p.screenshot({ path: OUT + 'newgame.png' });
  console.log('BEFORE ' + before);
  console.log('AFTER ' + JSON.stringify(after));
  console.log('ERRORS ' + (errs.length ? errs.join(' || ') : 'none'));
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
