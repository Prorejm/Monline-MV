const { chromium } = require('playwright-core');
const EXE='C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const fs=require('fs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const target = process.argv[2] || 'https://monlinewiki.miraheze.org/wiki/Bad_End';
const out = process.argv[3] || '_shots/wiki_page.txt';
(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,
    args:['--no-sandbox','--disable-gpu','--disable-blink-features=AutomationControlled']});
  const ctx=await b.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'});
  const p=await ctx.newPage();
  await p.goto(target,{waitUntil:'domcontentloaded',timeout:60000});
  // Do NOT reload: the interstitial restarts on every navigation. Just let the
  // challenge script finish and follow its own redirect.
  let title='';
  for(let i=0;i<40;i++){
    await sleep(2000);
    title=await p.title().catch(()=>'');
    if(title && !/checking your connection|请稍候|Just a moment/i.test(title)) break;
  }
  const url=p.url();
  const txt=await p.evaluate(()=>{
    const c=document.querySelector('#mw-content-text')||document.body;
    return c.innerText||'';
  }).catch(e=>'EVAL ERR '+e.message);
  console.log('TITLE: '+title);
  console.log('URL: '+url);
  console.log('len '+txt.length);
  fs.writeFileSync(out,'TITLE: '+title+'\nURL: '+url+'\n\n'+txt,'utf8');
  console.log(txt.slice(0,800));
  await b.close();
})();
