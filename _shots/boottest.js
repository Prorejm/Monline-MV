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
  await p.waitForTimeout(7000);

  const state = await p.evaluate(() => {
    const S = (typeof SceneManager !== 'undefined') ? SceneManager : null;
    return {
      hasSM: !!S,
      scene: (S && S._scene) ? S._scene.constructor.name : null,
      dataSystem: (typeof $dataSystem !== 'undefined') ? (($dataSystem && $dataSystem.gameTitle) || '?') : 'undef',
      termsMessages: (typeof $dataSystem !== 'undefined' && $dataSystem.terms && $dataSystem.terms.messages) ? Object.keys($dataSystem.terms.messages).length : -1,
      dataTilesets: (typeof $dataTilesets !== 'undefined' && $dataTilesets) ? $dataTilesets.length : -1,
      dataMapInfos: (typeof $dataMapInfos !== 'undefined' && $dataMapInfos) ? $dataMapInfos.length : -1,
    };
  }).catch(e => ({ evalErr: e.message }));

  await p.screenshot({ path: OUT + 'boot.png' });

  // 目标测试：强制加载 startMapId=238 并构建 map 场景，捕获 tilemap 崩溃
  const mapTest = await p.evaluate(async () => {
    try {
      if (typeof $dataSystem === 'undefined') return { skip: 'no dataSystem' };
      const id = $dataSystem.startMapId;
      await new Promise((res) => DataManager.loadMapData(id, res));
      if (!$dataMap) return { err: 'map not loaded', id };
      const gm = new Game_Map();
      gm.setup(id);
      const ts = new Spriteset_Map();
      return { ok: true, id, tilesetId: $dataMap.tilesetId, dataLen: $dataMap.data.length };
    } catch (e) {
      return { err: (e && e.message) || String(e), stack: (e && e.stack) ? e.stack.split('\n').slice(0, 3) : null };
    }
  }).catch(e => ({ evalErr: e.message }));

  console.log('STATE ' + JSON.stringify(state));
  console.log('MAPTEST ' + JSON.stringify(mapTest));
  console.log('ERRORS ' + (errs.length ? errs.join(' || ') : 'none'));
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
