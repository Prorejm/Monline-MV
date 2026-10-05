// Read RPG::System#terms out of the original VX Ace System.rvdata2.
//
// The MV System.json was converted once and never checked against the source,
// and its terms.commands looks shifted.  This reads the authoritative values
// straight out of the Marshal dump so the two can be compared.
//
//   node _shots/marshal_terms.js
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'vxace_data_backup', 'System.rvdata2');
const buf = fs.readFileSync(FILE);

let pos = 0;
const syms = [];
const objs = [];

function byte() { return buf[pos++]; }

function readInt() {
  const b = byte();
  if (b === 0) return 0;
  if (b >= 1 && b <= 5) {
    let v = 0;
    for (let i = 0; i < b; i++) v += buf[pos + i] * Math.pow(256, i);
    pos += b;
    return v;
  }
  if (b >= 251) {
    const n = 256 - b;
    let t = 0;
    for (let i = 0; i < n; i++) t += buf[pos + i] * Math.pow(256, i);
    pos += n;
    return t - Math.pow(256, n);
  }
  return b - 5;
}

function readRaw(n) {
  const s = buf.slice(pos, pos + n);
  pos += n;
  return s;
}

function reg(v) { objs.push(v); return v; }

function readValue() {
  const t = String.fromCharCode(byte());
  switch (t) {
    case '0': return null;
    case 'T': return true;
    case 'F': return false;
    case 'i': return readInt();
    case '"': {
      const n = readInt();
      const s = readRaw(n).toString('utf8');
      return reg(s);
    }
    case ':': {
      const n = readInt();
      const s = readRaw(n).toString('utf8');
      syms.push(s);
      return s;
    }
    case ';': return syms[readInt()];        // link to an earlier symbol
    case '@': return objs[readInt()];        // link to an earlier object
    case '[': {
      const n = readInt();
      const a = [];
      objs.push(a);
      for (let i = 0; i < n; i++) a.push(readValue());
      return a;
    }
    case '{': {
      const n = readInt();
      const h = {};
      objs.push(h);
      for (let i = 0; i < n; i++) {
        const k = readValue();
        h[k] = readValue();
      }
      return h;
    }
    case '}': {
      const n = readInt();
      const h = {};
      objs.push(h);
      for (let i = 0; i < n; i++) {
        const k = readValue();
        h[k] = readValue();
      }
      readValue();               // default value
      return h;
    }
    case 'o': {
      const name = readValue();
      const n = readInt();
      const o = { __class: name };
      objs.push(o);
      for (let i = 0; i < n; i++) {
        const k = readValue();
        o[k] = readValue();
      }
      return o;
    }
    case 'I': {
      const inner = readValue();
      const n = readInt();
      for (let i = 0; i < n; i++) { readValue(); readValue(); }
      return inner;
    }
    case 'u': {
      readValue();                       // class symbol
      return reg(readValue());           // wrapped value
    }
    case 'C': {
      readValue();                       // class symbol
      return readValue();
    }
    case 'e': {
      readValue();                       // module symbol
      return readValue();
    }
    case 'S': {
      const name = readValue();
      const n = readInt();
      const o = { __struct: name };
      objs.push(o);
      for (let i = 0; i < n; i++) {
        const k = readValue();
        o[k] = readValue();
      }
      return o;
    }
    case 'f': {
      const n = readInt();
      return parseFloat(readRaw(n).toString('utf8'));
    }
    case 'c': case 'm': {
      const n = readInt();
      return readRaw(n).toString('utf8');
    }
    case 'l': {
      const sign = byte();
      const n = readInt();
      let t = 0;
      for (let i = 0; i < n; i++) t += buf[pos + i] * Math.pow(256, i);
      pos += n;
      return sign === 0x2d ? -t : t;
    }
    default:
      throw new Error('unhandled marshal type ' + t + ' at ' + pos);
  }
}

// Marshal 4.8 header
if (byte() !== 4 || byte() !== 8) {
  throw new Error('not a Marshal 4.8 dump');
}

const root = readValue();
console.log('root class:', root && root.__class);
const terms = root && root['@terms'];
if (!terms) { console.log('NO @terms FOUND'); process.exit(1); }
console.log('terms class:', terms.__class, 'keys:', Object.keys(terms).join(','));
const cmds = terms['@commands'];
if (!Array.isArray(cmds)) { console.log('NO @commands'); process.exit(1); }
console.log('\n== VX Ace terms.commands (' + cmds.length + ') ==');
cmds.forEach((v, i) => console.log(String(i).padStart(2), JSON.stringify(v)));
