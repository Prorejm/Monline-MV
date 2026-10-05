// Restore the battle-log wording that Monline customised in VX Ace.
//
// Most terms.messages differences from the original are just MV's %1
// placeholder convention, but a handful are real: the converter fell back to
// MV's stock English where the game had its own wording.  Sources are the
// Vocab constants at the top of _vxace_scripts/0000.rb.
//
//   node _shots/fix_messages.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  path.join(ROOT, 'Monline-MV', 'data', 'System.json'),
  path.join(ROOT, 'mv_project', 'data', 'System.json')
];

// key -> [MV value found in the port, the game's own wording]
const FIXES = {
  possession:       ['Possession', 'Owned'],
  commandRemember:  ['Command Remember', 'Remember Command Choice'],
  escapeStart:      ['%1 has started to escape!', '%1 is trying to escape!'],
  escapeFailure:    ['However, it was unable to escape!',
                     'However, they were unable to escape!'],
  enemyDrain:       ['%1 was drained of %2 %3!', 'Drained %1 %2 from %3!'],
  enemyNoHit:       ['Miss! %1 took no damage!', 'Missed! %1 took no damage!'],
  magicReflection:  ['%1 reflected the magic!', '%1 reflected the attack!']
};

for (const f of FILES) {
  let s = fs.readFileSync(f, 'utf8');
  let changed = 0;
  for (const k of Object.keys(FIXES)) {
    const [was, now] = FIXES[k];
    const needle = '"' + k + '": ' + JSON.stringify(was);
    const repl = '"' + k + '": ' + JSON.stringify(now);
    const n = s.split(needle).length - 1;
    if (n === 1) { s = s.replace(needle, repl); changed++; }
    else console.log('  ' + path.basename(path.dirname(f)) + ': "' + k +
                     '" pattern found ' + n + ' times, skipped');
  }
  fs.writeFileSync(f, s);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(path.basename(path.dirname(path.dirname(f))) + ': ' + changed +
              '/' + Object.keys(FIXES).length + ' applied; possession=' +
              JSON.stringify(j.terms.messages.possession));
}

const a = fs.readFileSync(FILES[0]);
const b = fs.readFileSync(FILES[1]);
console.log('copies identical: ' + a.equals(b));
