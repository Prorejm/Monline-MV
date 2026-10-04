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
  const errs = [], warns = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push('CONSOLE: ' + t);
    if (m.type() === 'warning' && /MonlineShim/.test(t)) warns.push(t);
  });

  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'load', timeout: 30000 });
  await p.waitForTimeout(5000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await p.waitForTimeout(6000);

  // 压力测试:加载多张地图(含高 tile-id)并构建 tilemap
  const mapTest = await p.evaluate(async () => {
    const ids = [1, 50, 100, 238, 300, 400, 499, 510];
    const res = [];
    for (const id of ids) {
      try {
        await new Promise(r => DataManager.loadMapData(id, r));
        const gm = new Game_Map(); gm.setup(id);
        const sp = new Spriteset_Map();
        sp.update();
        res.push({ id, ok: true, ts: $dataMap.tilesetId });
      } catch (e) { res.push({ id, err: (e && e.message) || String(e) }); }
    }
    return res;
  }).catch(e => ({ evalErr: e.message }));

  await p.screenshot({ path: OUT + 'verify.png' });
  console.log('MAPSTRESS ' + JSON.stringify(mapTest));
  console.log('SHIM_WARNINGS ' + warns.length);
  console.log('WARN_SAMPLE ' + warns.slice(0, 3).join(' | '));
  console.log('HARD_ERRORS ' + (errs.length ? errs.join(' || ') : 'none'));
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });
