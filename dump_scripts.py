#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""提取 VX Ace 的 Scripts.rvdata2（Marshal 4.8）到本地文件。

rubymarshal 的 Reader 会把脚本正文按 UTF-8 解码，而正文是 zlib 压缩的二进制，
所以这里用一个只支持 Scripts.rvdata2 所需 token 的最小解析器，
把字符串一律按 latin-1 无损读成 bytes。

用法:
    python dump_scripts.py                 # 列出脚本名
    python dump_scripts.py --dump OUTDIR   # 解压全部脚本到 OUTDIR
    python dump_scripts.py --grep 关键词    # 在解压后的源码里搜索
"""
import io
import os
import re
import struct
import sys
import zlib

SRC = "extracted/Data/Scripts.rvdata2"


class MiniMarshal:
    """只覆盖 Scripts.rvdata2 用到的 Marshal token。"""

    def __init__(self, data: bytes):
        self.fd = io.BytesIO(data)
        self.symbols = []
        self.objects = []

    # ---- 基础读取 -------------------------------------------------------
    def byte(self):
        b = self.fd.read(1)
        if not b:
            raise EOFError
        return b

    def long(self):
        return struct.unpack('<i', self.fd.read(4))[0]

    def string_bytes(self, n):
        return self.fd.read(n)

    # ---- 主循环 ---------------------------------------------------------
    def read(self):
        b = self.byte()
        if b in (b'i',):                       # fixnum
            c = self.byte()[0]
            if c == 0:
                return self.byte()[0]
            if 5 <= c <= 127:
                return c - 5
            if 128 <= c <= 251:
                return c - 256 + 5
            if c == 255:
                return self.long()
            if c == 254:
                return struct.unpack('<h', self.fd.read(2))[0]
            if c == 253:
                return struct.unpack('<H', self.fd.read(2))[0]
            if c == 252:
                return self.long()
            return 0
        if b == b'l':                          # long
            return self.long()
        if b == b'T':
            return True
        if b == b'F':
            return False
        if b == b'0':
            return None
        if b == b':':                          # symbol
            n = self.long()
            s = self.string_bytes(n).decode('latin-1')
            self.symbols.append(s)
            return ('sym', s)
        if b == b';':                          # symlink
            idx = self.long()
            return ('sym', self.symbols[idx])
        if b == b'@':                          # object link
            idx = self.long()
            return ('link', idx)
        if b == b'"':                          # raw string
            n = self.long()
            return self.string_bytes(n)
        if b == b'I':                          # string with ivars (encoding)
            inner = self.read()
            attrs = self.read()
            return inner
        if b == b'[':                          # array
            n = self.long()
            out = []
            self.objects.append(out)
            for _ in range(n):
                out.append(self.read())
            return out
        if b == b'{':                          # hash
            n = self.long()
            out = {}
            self.objects.append(out)
            for _ in range(n):
                k = self.read()
                v = self.read()
                out[k] = v
            return out
        if b == b'u':                          # userdef
            cls = self.read()
            n = self.long()
            return self.string_bytes(n)
        if b == b'U':                          # usermarshal
            cls = self.read()
            n = self.long()
            return self.string_bytes(n)
        if b in (b'e', b'C', b'o', b'f', b'c', b'm', b'M', b'S', b'/', b'i'):
            return self.read()
        raise ValueError('unhandled token %r at %d' % (b, self.fd.tell()))


def load_scripts(path=SRC):
    data = open(path, 'rb').read()
    assert data[:2] == b'\x04\x08', 'not a Marshal 4.8 stream'
    m = MiniMarshal(data)
    m.fd.seek(2)
    arr = m.read()
    out = []
    for row in arr:
        if not isinstance(row, list) or len(row) < 3:
            continue
        sid, title, body = row[0], row[1], row[2]
        if isinstance(title, bytes):
            title = title.decode('latin-1')
        if isinstance(body, bytes):
            try:
                body = zlib.decompress(body).decode('utf-8', 'replace')
            except Exception as e:
                body = '<<inflate failed: %s>>' % e
        out.append((sid, title or '', body or ''))
    return out


def main():
    scripts = load_scripts()
    args = sys.argv[1:]
    if not args:
        print('scripts: %d' % len(scripts))
        for sid, title, body in scripts:
            print('%5d  %-46s %7d bytes' % (sid, title, len(body)))
        return
    if args[0] == '--dump':
        outdir = args[1]
        os.makedirs(outdir, exist_ok=True)
        for sid, title, body in scripts:
            safe = re.sub(r'[^\w\u4e00-\u9fff.\- ]+', '_', title).strip() or 'unnamed'
            with open(os.path.join(outdir, '%04d %s.rb' % (sid, safe)), 'w',
                      encoding='utf-8') as fh:
                fh.write(body)
        print('dumped %d scripts -> %s' % (len(scripts), outdir))
        return
    if args[0] == '--grep':
        pat = re.compile(args[1], re.I)
        hits = 0
        for sid, title, body in scripts:
            for i, line in enumerate(body.splitlines(), 1):
                if pat.search(line):
                    hits += 1
                    if hits <= 80:
                        print('%5d %-38s :%-5d %s' % (sid, title, i, line.strip()[:120]))
        print('--- %d matching line(s) ---' % hits)
        return


if __name__ == '__main__':
    main()
