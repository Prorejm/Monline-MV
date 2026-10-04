"""Verify the port's extraction really came from the original Game.rgss3a.

Compares SHA256 of key archive members against the already-extracted copies in
Monline_MV/extracted.  If they match byte-for-byte, the port's source IS this
original and every later decision can trust it.  If anything differs, the whole
port has been reasoning about a stale/foreign source.

Uses mmap so a 1.2 GB archive never has to be fully loaded into RAM, and only
the handful of members we care about get decrypted.
"""
import struct, hashlib, os, mmap, sys

SRC = "G:/新建文件夹 (20)/Monline 0.9.8/Game.rgss3a"
EXT = "G:/新建文件夹 (22)/Monline_MV/extracted"

TARGETS = [
    "Data/Scripts.rvdata2",
    "Data/Classes.rvdata2",
    "Data/Skills.rvdata2",
    "Data/MapInfos.rvdata2",
    "Data/System.rvdata2",
    "Data/CommonEvents.rvdata2",
    "Data/Actors.rvdata2",
    "Data/Items.rvdata2",
    "Data/Weapons.rvdata2",
    "Data/Armors.rvdata2",
    "Data/Enemies.rvdata2",
    "Data/Troops.rvdata2",
    "Data/States.rvdata2",
    "Data/Animations.rvdata2",
    "Data/Tilesets.rvdata2",
]


def parse_index(mm, base_key):
    magickey = (base_key * 9 + 3) & 0xFFFFFFFF
    files = {}
    p, n = 12, len(mm)
    while True:
        if p + 16 > n:
            return None
        hdr = mm[p:p + 16]
        d_off, d_len, f_key, name_len = (
            struct.unpack('<I', bytes(hdr[i:i + 4]))[0] ^ magickey
            for i in (0, 4, 8, 12)
        )
        if d_off == 0:
            break
        p += 16
        if p + name_len > n or name_len <= 0 or name_len > 4096:
            return None
        nb = mm[p:p + name_len]
        name = bytes(b ^ ((magickey >> ((i % 4) * 8)) & 0xFF)
                     for i, b in enumerate(nb))
        try:
            name = name.decode('utf-8').replace('\\', '/')
        except Exception:
            return None
        p += name_len
        files[name] = (d_off, d_len, f_key)
        if len(files) > 200000:
            break
    return files


def decrypt(mm, off, ln, fk):
    chunk = bytearray(mm[off:off + ln])
    k, i, n = fk & 0xFFFFFFFF, 0, len(chunk)
    while i + 4 <= n:
        v = struct.unpack('<I', chunk[i:i + 4])[0] ^ k
        chunk[i:i + 4] = struct.pack('<I', v)
        k = (k * 7 + 3) & 0xFFFFFFFF
        i += 4
    while i < n:
        chunk[i] ^= (k & 0xFF)
        k = (k * 7 + 3) & 0xFFFFFFFF
        i += 1
    return bytes(chunk)


def sha(b):
    return hashlib.sha256(b).hexdigest()[:16]


with open(SRC, 'rb') as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)

if mm[:8] != b'RGSSAD\x00\x03':
    sys.exit("not an RGSSAD v3 archive")

stored = struct.unpack('<I', mm[8:12])[0]
files = None
for xor in (0, 0xDEADCAFE):
    files = parse_index(mm, stored ^ xor)
    if files:
        print("[OK] index decrypted (base key=%d ^ 0x%X), %d members"
              % (stored, xor, len(files)))
        break
if not files:
    sys.exit("ERROR: key mismatch")

print("%-30s %-18s %-18s %s" % ("member", "archive sha", "extracted sha", "result"))
diffs = 0
for t in TARGETS:
    if t not in files:
        print("%-30s MISSING IN ARCHIVE" % t)
        diffs += 1
        continue
    off, ln, fk = files[t]
    a_raw = decrypt(mm, off, ln, fk)
    a_h = sha(a_raw)
    ext = os.path.join(EXT, t.replace('/', os.sep))
    if not os.path.exists(ext):
        print("%-30s %s  (extracted copy MISSING)" % (t, a_h))
        diffs += 1
        continue
    e_h = sha(open(ext, 'rb').read())
    ok = (a_h == e_h)
    if not ok:
        diffs += 1
    print("%-30s %s  %s  %s" % (t, a_h, e_h,
                                "IDENTICAL" if ok else "*** DIFFERS ***"))

print()
print("VERDICT: %s" % ("SOURCE IS AUTHORITATIVE - extracted data matches the original archive byte-for-byte"
                       if diffs == 0 else "%d member(s) differ - port may be based on a stale/foreign source" % diffs))
