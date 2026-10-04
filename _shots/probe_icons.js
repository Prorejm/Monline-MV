// Focused probe: do the system assets actually resolve under MV's own metrics?
// Run: NODE_PATH=<playwright-core workspace> node probe_icons.js
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
  const warns = [];
  p.on('console', m => { const t = m.text(); if (/texture|IconSet|WebGL/i.test(t)) warns.push(m.type() + ': ' + t.slice(0, 200)); });
  p.on('pageerror', e => warns.push('PAGEERROR: ' + e.message));

  await p.goto(URL, { waitUntil: 'load' });
  await sleep(6000);

  const out = await p.evaluate(() => {
    const r = {};
    const gl = Graphics._renderer && Graphics._renderer.gl;
    r.renderer = gl ? 'webgl' : 'canvas';
    r.maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : null;
    r.iconW = Window_Base._iconWidth;
    r.iconH = Window_Base._iconHeight;
    r.faceW = Window_Base._faceWidth;
    r.faceH = Window_Base._faceHeight;

    const bmp = ImageManager.loadSystem('IconSet');
    r.iconSetSize = [bmp.width, bmp.height];
    r.iconSetReady = bmp.isReady();
    const bt = bmp._baseTexture;
    r.baseTexture = !!bt;
    if (bt) {
      r.texSourceSize = [bt.width, bt.height];
      r.glTexture = !!(bt._glTexture || bt._glTextures && Object.keys(bt._glTextures).length);
      r.overLimit = r.maxTextureSize ? (bt.height > r.maxTextureSize) : null;
    }

    // Exercise the *plugin's* real path, not a copy of its arithmetic: take the
    // frame/bitmap from MonlineIconSet and draw through the real drawIcon into a
    // real window's contents, then count the pixels that came back.
    const win = new Window_Base(0, 0, 400, 200);
    win.contents.clear();
    const usedChunks = {};
    const probe = (idx) => {
      const f = MonlineIconSet.frameFor(idx);
      const bmp = MonlineIconSet.bitmapFor(idx);
      usedChunks[f.chunk] = (usedChunks[f.chunk] || 0) + 1;
      const t = new Bitmap(24, 24);
      try { t.blt(bmp, f.sx, f.sy, f.width, f.height, 0, 0); } catch (e) { return 'blt: ' + e.message; }
      let lit = 0;
      for (let y = 0; y < 24; y++) { for (let x = 0; x < 24; x++) { if (t.getAlphaPixel(x, y) > 0) lit++; } }
      return { chunk: f.chunk, sx: f.sx, sy: f.sy, bmpH: bmp.height, litPx: lit };
    };
    // 0, 1, 13 (the column that used to be off-sheet), 4095/4096 (chunk seam), max
    r.icon0 = probe(0);
    r.icon1 = probe(1);
    r.icon13 = probe(13);
    r.iconLastOfChunk0 = probe(4095);
    r.iconFirstOfChunk1 = probe(4096);
    r.iconMax = probe(13321);
    r.usedChunks = usedChunks;

    // and through the engine's own entry point
    win.contents.clear();
    win.drawIcon(0, 0, 0);
    win.drawIcon(13321, 40, 0);
    let drawn = 0;
    for (let y = 0; y < 24; y++) { for (let x = 0; x < 90; x++) { if (win.contents.getAlphaPixel(x, y) > 0) drawn++; } }
    r.drawIconLitPx = drawn;

    r.windowSkin = [ImageManager.loadSystem('Window').width, ImageManager.loadSystem('Window').height];
    // 32 text colours come from the skin; with a 128x128 skin all of them were #000000
    r.windowSkinColor0 = ImageManager.loadSystem('Window').getPixel(102, 150);
    r.windowSkinColor1 = ImageManager.loadSystem('Window').getPixel(114, 150);
    r.windowTone = $dataSystem.windowTone;
    r.fontFace = Window_Base.prototype.standardFontFace.call({});
    // what actually renders: build a window and ask its bitmap for the face
    var w = new Window_Base(0, 0, 300, 120);
    r.resolvedFont = w.contents.fontFace;
    r.resolvedFontSize = w.contents.fontSize;
    w.contents.fontFace = Window_Base.prototype.standardFontFace.call(w);
    w.contents.fontSize = 28;
    w.contents.drawText('Ag测试', 0, 0, 280, 36);
    var lit = 0;
    for (var y = 0; y < 36; y += 3) { for (var x = 0; x < 280; x += 3) { if (w.contents.getAlphaPixel(x, y) > 0) lit++; } }
    r.textLitCells = lit;
    // chunk switching: are the extra sheets actually loading?
    r.sheets = {};
    for (var c = 0; c < 4; c++) {
      var nm = c === 0 ? 'IconSet' : 'IconSet_' + c;
      var b2 = ImageManager.loadSystem(nm);
      r.sheets[nm] = [b2.width, b2.height, b2.isReady()];
    }
    return r;
  }).catch(e => ({ err: e.message }));

  console.log(JSON.stringify(out, null, 1));
  console.log('--- console notes ---');
  warns.slice(0, 12).forEach(w => console.log('  ' + w));
  await b.close();
})();
