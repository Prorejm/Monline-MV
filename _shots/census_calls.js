// Census of every script call the converted data makes, and whether the
// modernised build can actually RESOLVE it.
//
// The Ruby bridge auto-stubs anything unknown, so an unported call never
// throws - it silently does nothing.  That makes "0 errors" a weak signal.
// This walks every event in every map / common event / troop, pulls out the
// Ruby script payloads, and tests each bare call name in the live game.
//
//   NODE_PATH=<pw> node _shots/census_calls.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', () => {});
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);

  // 1) Pull every script payload out of the data, in the page (fetch is easy).
  const names = await p.evaluate(async () => {
    const files = [];
    const res = await fetch('data/MapInfos.json');
    const infos = await res.json();
    for (const info of infos) {
      if (info && info.id) { files.push('data/Map' + String(info.id).padStart(3, '0') + '.json'); }
    }
    files.push('data/CommonEvents.json', 'data/Troops.json');

    const payloads = [];
    function walk(list, where) {
      if (!Array.isArray(list)) { return; }
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || !c.code) { continue; }
        const code = c.code;
        // 355/655 script, 111 branch (script operand), 122 variable (script)
        if (code === 355 || code === 655) {
          payloads.push({ src: String(c.parameters[0] || ''), where });
        } else if (code === 111 && c.parameters[0] === 12) {
          payloads.push({ src: String(c.parameters[1] || ''), where });
        } else if (code === 122 && c.parameters[3] === 4) {
          payloads.push({ src: String(c.parameters[4] || ''), where });
        }
        if (Array.isArray(c.parameters)) {
          for (const sub of c.parameters) { walk(sub, where); }
        }
      }
    }

    for (const f of files) {
      let json;
      try {
        const r = await fetch(f);
        if (!r.ok) { continue; }
        json = await r.json();
      } catch (e) { continue; }
      if (Array.isArray(json)) {
        for (const ev of json) {
          if (!ev) { continue; }
          if (Array.isArray(ev.list)) { walk(ev.list, f + ' ev' + ev.id); }
          if (Array.isArray(ev.pages)) {
            for (const pg of ev.pages) { if (pg) { walk(pg.list, f + ' ev' + ev.id); } }
          }
        }
      } else if (json && Array.isArray(json.events)) {
        for (const ev of json.events) {
          if (!ev || !Array.isArray(ev.pages)) { continue; }
          for (const pg of ev.pages) { if (pg) { walk(pg.list, f + ' ev' + ev.id); } }
        }
      }
    }

    // 2) Collect call names: bare `name(` not preceded by a dot.
    const counts = {};
    const samples = {};
    for (const item of payloads) {
      const re = /(^|[^.\w$'"])([A-Za-z_$][\w$]*)\s*\(/g;
      let m;
      while ((m = re.exec(item.src)) !== null) {
        const n = m[2];
        counts[n] = (counts[n] || 0) + 1;
        if (!samples[n]) { samples[n] = item.where + ': ' + item.src.slice(0, 90); }
      }
    }
    return { total: payloads.length, counts, samples };
  });

  console.log('script payloads scanned: ' + names.total);
  console.log('distinct bare call names: ' + Object.keys(names.counts).length);

  // 3) Ask the running game which of them actually resolve to functions.
  const unresolved = await p.evaluate((list) => {
    const out = [];
    for (const n of list) {
      let v;
      try { v = eval('(typeof ' + n + ' !== "undefined") ? ' + n + ' : undefined'); }
      catch (e) { v = undefined; }
      if (typeof v !== 'function') { out.push(n); }
    }
    return out;
  }, Object.keys(names.counts));

  const rows = unresolved
    .map(n => ({ name: n, n: names.counts[n], sample: names.samples[n] }))
    .sort((a, b) => b.n - a.n);

  console.log('\nUNRESOLVED (auto-stubbed - silently does nothing): ' + rows.length);
  for (const r of rows) {
    console.log('  ' + String(r.n).padStart(5) + '  ' + r.name);
    console.log('         ' + r.sample);
  }

  await b.close();
  process.exit(0);
})().catch(e => { console.error('THREW: ' + e.stack); process.exit(2); });
