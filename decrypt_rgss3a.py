#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RGSSAD v3 (RPG Maker VX Ace .rgss3a) 解密提取器。
算法：fux2 经典实现。
 - 头部 8 字节 = b'RGSSAD\x00\x03'
 - 接着 4 字节 = base key (小端 uint32)
 - metadata key = (base * 9 + 3) & 0xFFFFFFFF  (v3: metadata key 不随每条记录滚动)
 - 每条文件记录: 16 字节头 [offset, length, filekey, namelen] 各与 metadata key XOR
   - offset==0 表示归档结束
   - 随后 namelen 字节文件名，逐字节与 metadata key 的 4 字节循环 XOR
 - 文件数据位于绝对 offset，逐 4 字节与 filekey XOR，每异或一次 filekey = (filekey*7+3)&0xFFFFFFFF
可选：base key 可能以 XOR 0xDEADCAFE 存储，脚本自动尝试两种。
"""
import struct, os, sys

SRC = "G:/新建文件夹 (20)/Monline 0.9.8/Game.rgss3a"
OUT = "G:/新建文件夹 (22)/Monline_MV/extracted"

def parse_index(data, base_key):
    """返回 (成功?, [(offset,length,filekey,name), ...]) 用于校验密钥"""
    magickey = (base_key * 9 + 3) & 0xFFFFFFFF
    files = []
    p = 12  # 8字节magic + 4字节key 之后
    n = len(data)
    while True:
        if p + 16 > n:
            return False, None
        hdr = data[p:p+16]
        d_off, d_len, f_key, name_len = (
            struct.unpack('<I', bytes(hdr[i:i+4]))[0] ^ magickey for i in (0, 4, 8, 12)
        )
        if d_off == 0 and d_len == 0 and name_len == 0:
            break
        if d_off == 0:
            # 有些实现用 offset==0 作为结束标志
            break
        p += 16
        if p + name_len > n or name_len <= 0 or name_len > 4096:
            return False, None
        name_bytes = data[p:p+name_len]
        name = bytes(b ^ ((magickey >> ((i % 4) * 8)) & 0xFF) for i, b in enumerate(name_bytes))
        try:
            name_str = name.decode('utf-8')
        except Exception:
            return False, None
        p += name_len
        files.append((d_off, d_len, f_key, name_str))
        if len(files) > 100000:
            break
    return True, files

def decrypt_file(data, d_off, d_len, f_key):
    chunk = bytearray(data[d_off:d_off + d_len])
    k = f_key & 0xFFFFFFFF
    i = 0
    n = len(chunk)
    while i + 4 <= n:
        v = struct.unpack('<I', chunk[i:i+4])[0] ^ k
        chunk[i:i+4] = struct.pack('<I', v)
        k = (k * 7 + 3) & 0xFFFFFFFF
        i += 4
    # 剩余不足 4 字节
    while i < n:
        chunk[i] ^= (k & 0xFF)
        k = (k * 7 + 3) & 0xFFFFFFFF
        i += 1
    return bytes(chunk)

def main():
    with open(SRC, 'rb') as f:
        data = f.read()
    assert data[:8] == b'RGSSAD\x00\x03', "不是 RGSSAD v3 归档"
    stored = struct.unpack('<I', data[8:12])[0]
    ok = False
    files = None
    used_xor = 0
    for xor in (0, 0xDEADCAFE):
        base = stored ^ xor
        ok, files = parse_index(data, base)
        if ok and files:
            used_xor = xor
            break
    if not ok or not files:
        print("ERROR: 无法解密，密钥不匹配")
        sys.exit(1)
    print(f"[OK] 解密成功 (base key={stored}^0x{used_xor:X}={stored ^ used_xor}), 共 {len(files)} 个文件")
    if "--list" in sys.argv:
        for fo, ln, fk, nm in files[:40]:
            print(f"  {nm}  (offset={fo}, len={ln})")
        if len(files) > 40:
            print(f"  ... 其余 {len(files)-40} 个")
        return
    # 全量提取
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for fo, ln, fk, nm in files:
        outpath = os.path.join(OUT, nm.replace('\\', '/'))
        os.makedirs(os.path.dirname(outpath), exist_ok=True)
        with open(outpath, 'wb') as o:
            o.write(decrypt_file(data, fo, ln, fk))
        total += 1
    print(f"[DONE] 已提取 {total} 个文件到 {OUT}")

if __name__ == '__main__':
    main()
