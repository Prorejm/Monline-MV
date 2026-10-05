// Repair terms.commands in the converted System.json.
//
// The VX Ace original stores 24 command terms and its Vocab reads them as
//   shutdown   = commands[20]   -> "Quit"
//   to_title   = commands[21]   -> "To Title"
//   cancel     = commands[22]   -> "Cancel"
// (see _vxace_scripts/0000.rb:142-144)
//
// The conversion filled MV's 26-slot array by copying slots 0..19 straight over
// and then dropping one, so slot 20 held "To Title" and slot 21 held "Cancel".
// MV reads toTitle from slot 21, which is why every "To Title" button in the
// port read "Cancel".  Slot 22 happened to land on "Cancel" anyway, which is
// what hid the mistake.
//
//   node _shots/fix_terms.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  path.join(ROOT, 'Monline-MV', 'data', 'System.json'),
  path.join(ROOT, 'mv_project', 'data', 'System.json')
];

const OLD = '"Continue", "To Title", "Cancel", "Cancel", null, "Buy", "Sell"';
const NEW = '"Continue", "Quit", "To Title", "Cancel", "", "Buy", "Sell"';

for (const f of FILES) {
  const s = fs.readFileSync(f, 'utf8');
  const n = s.split(OLD).length - 1;
  if (n !== 1) {
    console.log('SKIP ' + f + ' - pattern found ' + n + ' times');
    continue;
  }
  fs.writeFileSync(f, s.replace(OLD, NEW));
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('fixed ' + f);
  console.log('   20=' + JSON.stringify(j.terms.commands[20]) +
              '  21=' + JSON.stringify(j.terms.commands[21]) +
              '  22=' + JSON.stringify(j.terms.commands[22]) +
              '  23=' + JSON.stringify(j.terms.commands[23]));
}

// both copies have to be byte-identical
const a = fs.readFileSync(FILES[0]);
const b = fs.readFileSync(FILES[1]);
console.log('\ncopies identical: ' + a.equals(b));
