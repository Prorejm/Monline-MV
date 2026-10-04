// QA: verify both plugins.js files are parseable and register MonlineJp
// AFTER MonlineScenes (MonlineJp calls gainJp defined by MonlineScenes).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV';
const files = [
    path.join(ROOT, 'Monline-MV/js/plugins.js'),
    path.join(ROOT, 'mv_project/js/plugins.js')
];

let fails = 0;
for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const ctx = { $plugins: null };
    try {
        vm.createContext(ctx);
        vm.runInContext(src, ctx, { filename: f });
    } catch (e) {
        console.log('FAIL parse ' + f + ': ' + e.message);
        fails++;
        continue;
    }
    const list = ctx.$plugins;
    if (!Array.isArray(list)) { console.log('FAIL $plugins not array in ' + f); fails++; continue; }
    const names = list.map(p => p.name);
    const iJp = names.indexOf('MonlineJp');
    const iScenes = names.indexOf('MonlineScenes');
    console.log('OK parse ' + f);
    console.log('   entries: ' + list.length);
    console.log('   MonlineJp index=' + iJp + '  MonlineScenes index=' + iScenes);
    if (iJp < 0) { console.log('   FAIL MonlineJp not registered'); fails++; }
    else {
        console.log('   status: ' + list[iJp].status);
        if (list[iJp].status !== true) { console.log('   FAIL MonlineJp status is not true'); fails++; }
        if (iScenes < 0) { console.log('   FAIL MonlineScenes missing'); fails++; }
        else if (iJp < iScenes) { console.log('   FAIL MonlineJp is BEFORE MonlineScenes'); fails++; }
        else { console.log('   OK MonlineJp loaded after MonlineScenes'); }
    }
    // every registered plugin must have a real file
    for (const p of list) {
        const fp = path.join(path.dirname(f), 'plugins', p.name + '.js');
        if (!fs.existsSync(fp)) { console.log('   FAIL missing file for ' + p.name); fails++; }
    }
}
console.log(fails === 0 ? 'PLUGINS CHECK PASSED' : 'PLUGINS CHECK FAILED: ' + fails);
process.exit(fails === 0 ? 0 : 1);
