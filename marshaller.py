# -*- coding: utf-8 -*-
"""自包含的 Ruby Marshal (RGSS .rvdata2) 解析器。
仅依赖标准库。把 Ruby 对象归一化为 Python 结构：
  nil/true/false -> None/True/False
  fixnum/bignum  -> int
  float          -> float
  symbol/string  -> str
  array          -> list
  hash           -> dict(str键) 或 list(配对)
  object/userdef -> RbObject(ruby_class_name, attributes/dump)
符号链接 0-based（与 Ruby marshal 一致）；对象链接 '@' 按分配顺序登记。
"""
import struct

# Marshal token 常量
T_NIL='0'.encode(); T_TRUE='T'.encode(); T_FALSE='F'.encode()
T_FIXNUM='i'.encode(); T_BIGNUM='l'.encode(); T_FLOAT='f'.encode()
T_SYMBOL=':'.encode(); T_SYMLINK=';'.encode(); T_IVAR='I'.encode()
T_OBJECT='o'.encode(); T_USERDEF='u'.encode(); T_USRMARSHAL='U'.encode()
T_ARRAY='['.encode(); T_HASH='{'.encode(); T_CLASS='c'.encode()
T_MODULE='m'.encode(); T_LINK='@'.encode(); T_EXTENDED='e'.encode()
T_UCLASS='C'.encode(); T_DATA='d'.encode(); T_REGEXP='r'.encode()
T_STRING='"'.encode(); T_STRUCT='S'.encode()

class RbObject:
    def __init__(self, cls, attributes=None, dump=None):
        self.ruby_class_name = cls
        self.attributes = attributes if attributes is not None else {}
        self.dump = dump  # bytes for Table/UserDef
    def table_values(self):
        """解析 Table 的 _dump 二进制：header(4*int32 LE) + int16 LE 瓦片，可能带尾部 int32。"""
        d = self.dump
        if not d or len(d) < 16:
            return None
        dim, xs, ys, zs = struct.unpack('<4i', d[:16])
        n = xs * ys * zs
        need = n * 2
        if len(d) - 16 < need:
            return None
        vals = list(struct.unpack('<%dh' % n, d[16:16+need]))
        return {'dim': dim, 'xs': xs, 'ys': ys, 'zs': zs, 'values': vals}

class RbClassRef:
    def __init__(self, name): self.name = name

class MarshalReader:
    def __init__(self, data: bytes):
        self.fd = data
        self.pos = 0
        self.symbols = []
        self.objects = []

    def _byte(self):
        b = self.fd[self.pos]
        self.pos += 1
        return b
    def _read(self, n):
        b = self.fd[self.pos:self.pos+n]
        self.pos += n
        return b
    def read_sbyte(self):
        b = self._byte()
        return b if b < 128 else b - 256
    def read_ubyte(self):
        return self._byte()
    def read_long(self):
        length = self.read_sbyte()
        if length == 0:
            return 0
        if 5 < length < 128:
            return length - 5
        if -129 < length < -5:
            return length + 5
        result = 0
        factor = 1
        for _ in range(abs(length)):
            result += self.read_ubyte() * factor
            factor *= 256
        if length < 0:
            result -= factor
        return result
    def read_blob(self):
        size = self.read_long()
        return self._read(size)
    def read_symreal(self):
        raw = self.read_blob()
        try:
            s = raw.decode('utf-8')
        except Exception:
            s = raw.decode('latin-1')
        self.symbols.append(s)
        return s

    def read(self):
        tok = self._byte()
        if tok == 0x30: return None          # '0' nil
        if tok == 0x54: return True          # 'T' true
        if tok == 0x46: return False         # 'F' false
        if tok == 0x69: return self._reg(self.read_long())       # 'i' fixnum
        if tok == 0x6c: return self._reg(self.read_bignum())     # 'l'
        if tok == 0x66: return self._reg(self.read_float())      # 'f'
        if tok == 0x3a: return self.read_symreal()    # ':' symbol (不入 objects)
        if tok == 0x3b: return self.symbols[self.read_long()]  # ';' symlink 0-based
        if tok == 0x49: return self.read_ivar()      # 'I'
        if tok == 0x6f: return self.read_object()    # 'o' (内部登记)
        if tok == 0x75: return self.read_userdef()   # 'u' (内部登记)
        if tok == 0x55: return self.read_usrmarshal()# 'U' (内部登记)
        if tok == 0x5b: return self.read_array()     # '[' (内部登记)
        if tok == 0x7b: return self.read_hash()      # '{' (内部登记)
        if tok == 0x63: return self._reg(RbClassRef(self.read()))  # 'c'
        if tok == 0x6d: return self._reg(RbClassRef(self.read()))  # 'm'
        if tok == 0x40:                              # '@' link
            idx = self.read_long()
            if 0 <= idx < len(self.objects): return self.objects[idx]
            if 0 < idx <= len(self.objects): return self.objects[idx-1]
            return None
        if tok == 0x65:                              # 'e' extended
            self.read()  # class
            return self._reg(self.read())
        if tok == 0x43:                              # 'C' uclass
            self.read()  # class
            return self._reg(self.read())
        if tok == 0x64:                              # 'd' data
            self.read()  # class
            return self._reg(self.read())
        if tok == 0x72:                              # 'r' regexp
            s = self.read_blob(); self._byte()  # opts
            return self._reg(s)
        if tok == 0x22: return self._reg(self.read_string_raw())  # '"' string
        if tok == 0x53: return self.read_object()      # 'S' struct (内部登记)
        raise ValueError("未知 marshal token 0x%02x @%d" % (tok, self.pos-1))

    def _reg(self, obj):
        # 把可链接的叶节点登记到对象表（与 Ruby marshal 一致），nil/true/false/符号不登记
        if obj is None or obj is True or obj is False:
            return obj
        self.objects.append(obj)
        return obj

    def read_string_raw(self):
        raw = self.read_blob()
        try:
            return raw.decode('utf-8')
        except Exception:
            try:
                return raw.decode('latin-1')
            except Exception:
                return raw.decode('utf-8', 'replace')

    def read_bignum(self):
        sign = self._byte()  # '+' or '-'
        n = self.read_long()
        result = 0
        factor = 1
        for _ in range(n):
            result += self.read_ubyte() * factor
            factor *= 65536
        if sign == 0x2d:  # '-'
            result = -result
        return result

    def read_float(self):
        raw = self.read_blob()
        try:
            return float(raw.decode('ascii'))
        except Exception:
            return 0.0

    def read_ivar(self):
        obj = self.read()
        count = self.read_long()
        for _ in range(count):
            self.read()  # key
            self.read()  # value
        return obj

    def read_object(self):
        cls = self.read()
        obj = RbObject(cls)
        self.objects.append(obj)
        count = self.read_long()
        for _ in range(count):
            k = self.read()
            v = self.read()
            key = k if isinstance(k, str) else str(k)
            obj.attributes[key] = v
        return obj

    def read_userdef(self):
        cls = self.read()
        tok = self._byte()
        if tok == 0x49:  # 'I' ivar-wrapped string dump (标准 Ruby：I" + 字符串 + ivar)
            inner = self._byte()  # 期望 0x22 '"'
            if inner != 0x22 and inner != 0x49:
                # 容错：inner 不是字符串 token，回退当原始 blob 处理
                self.pos -= 1
                raw = self.read_blob()
            else:
                raw = self.read_blob()
                if self._at_end() is False:
                    count = self.read_long()
                    for _ in range(count):
                        self.read(); self.read()
        elif tok == 0x22:  # '"' plain string dump
            raw = self.read_blob()
        else:
            # RGSS Table._dump 等：u + class + 直接 long length + bytes，无 I/" 包装
            # 回退刚读的 token 字节，作为 read_blob 长度首字节
            self.pos -= 1
            raw = self.read_blob()
        obj = RbObject(cls, dump=raw)
        self.objects.append(obj)
        return obj

    def _at_end(self):
        return self.pos >= len(self.fd)

    def read_usrmarshal(self):
        cls = self.read()
        dump = self.read()
        obj = RbObject(cls, dump=dump if isinstance(dump, bytes) else None)
        self.objects.append(obj)
        return obj

    def read_array(self):
        count = self.read_long()
        arr = []
        self.objects.append(arr)
        for _ in range(count):
            arr.append(self.read())
        return arr

    def read_hash(self):
        count = self.read_long()
        pairs = []
        self.objects.append(pairs)
        for _ in range(count):
            k = self.read()
            v = self.read()
            pairs.append((k, v))
        # 尽量转 dict（键为 str/symbol 时）
        try:
            d = {}
            for k, v in pairs:
                dk = k if isinstance(k, str) else str(k)
                d[dk] = v
            return d
        except Exception:
            return pairs

def load_rvdata(path):
    with open(path, 'rb') as f:
        data = f.read()
    # 跳过可能的文件头？.rvdata2 直接是 marshal 流，首字节应为 '0'/'i'/等
    r = MarshalReader(data)
    # 跳过 Marshal 版本魔数 0x04 0x08（固定 2 字节）
    if data[:2] == b'\x04\x08':
        r.pos = 2
    else:
        idx = data.find(b'\x04\x08')
        if idx < 0:
            raise ValueError("不是有效的 Marshal 流")
        r.pos = idx + 2
    return r.read()

if __name__ == '__main__':
    import sys
    o = load_rvdata(sys.argv[1])
    print("解析成功:", type(o).__name__)
    if isinstance(o, list):
        nz = [x for x in o if x is not None]
        print("列表长度", len(o), "非空", len(nz))
        if nz:
            print("首对象类:", getattr(nz[0],'ruby_class_name', type(nz[0]).__name__),
                  "键:", list(getattr(nz[0],'attributes',{}).keys())[:10])
    elif hasattr(o, 'attributes'):
        print("类:", o.ruby_class_name, "键:", list(o.attributes.keys())[:15])
