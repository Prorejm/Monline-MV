# -*- coding: utf-8 -*-
"""RGSS (.rvdata2) 解析器 —— 基于 rubymarshal 并针对 VX Ace / RGSS 变体做容错修复。
主要修复：
  * 字符串 :E 编码 ivar 值被写成非标准裸字节 -> 未识别 token 按 fixnum 读
  * 符号链接 ';' 与对象链接 '@' 在 RGSS 中为 1-based -> 容错回退
  * bignum/short 触及文件尾、unicode-escape 解码失败 -> 安全占位
仅依赖 rubymarshal（pip 安装）。
"""
import struct
import io
from rubymarshal.reader import Reader
from rubymarshal.classes import Symbol as SymbolFallback


real_read = Reader.read


class FixInt(int):
    """既是 int 又带 .name，用于未识别 token 的兜底，避免下游 .name 访问崩溃。"""
    @property
    def name(self):
        return str(self)


class FixReader(Reader):
    def read(self, in_ivar=False):
        before = self.fd.tell()
        tok = self.fd.read(1)
        if tok == b'':                       # EOF
            return FixInt(0)
        if tok == b'@':                       # TYPE_LINK 1-based 容错
            self.fd.seek(before + 1)
            link_id = self.read_long()
            objs = self.objects
            for cand in (link_id - 1, link_id):
                if 0 <= cand < len(objs) and objs[cand] is not None:
                    return objs[cand]
            for o in reversed(objs):
                if o is not None:
                    return o
            return None
        self.fd.seek(before)
        try:
            return real_read(self, in_ivar)
        except ValueError as e:
            if "not recognized" in str(e):
                self.fd.seek(self.fd.tell() - 1)
                try:
                    return FixInt(self.read_long())
                except Exception:
                    return FixInt(0)
            raise
        except (struct.error, UnicodeDecodeError, IndexError, TypeError):
            return FixInt(0)

    def read_symlink(self):
        sid = self.read_long()
        syms = self.symbols
        if sid < len(syms):
            return syms[sid]
        if 0 <= sid - 1 < len(syms):
            return syms[sid - 1]
        return syms[-1] if syms else SymbolFallback("s%d" % sid)

    def read_short(self):
        b = self.fd.read(2)
        if len(b) < 2:
            return 0
        return struct.unpack('<H', b)[0]


def load_fix(data: bytes):
    fd = io.BytesIO(data)
    assert fd.read(1) == b'\x04' and fd.read(1) == b'\x08'
    return FixReader(fd).read()


def obj_attrs(o):
    """把 RubyObject 的 attributes(dict, 键为 Symbol) 转成 str 键字典。"""
    if not hasattr(o, 'attributes'):
        return o
    out = {}
    for k, v in o.attributes.items():
        key = k.name if hasattr(k, 'name') else str(k)
        out[key] = v
    return out


def table_values(userdef):
    """解析 RGSS Table 的 _private_data：4*int32 LE(dim,xs,ys,zs) + int16 LE 瓦片。
    返回 dict: dim, xs, ys, zs, values(list[int])。
    """
    d = userdef._private_data
    if not d or len(d) < 16:
        return None
    dim, xs, ys, zs = struct.unpack('<4i', d[:16])
    n = xs * ys * zs
    need = n * 2
    if len(d) - 16 < need:
        return None
    vals = list(struct.unpack('<%dh' % n, d[16:16 + need]))
    return {'dim': dim, 'xs': xs, 'ys': ys, 'zs': zs, 'values': vals}


if __name__ == '__main__':
    import sys, glob
    p = sys.argv[1]
    o = load_fix(open(p, 'rb').read())
    a = obj_attrs(o)
    print("class:", getattr(o, 'ruby_class_name', type(o).__name__))
    print("keys:", list(a.keys()))
