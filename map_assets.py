# -*- coding: utf-8 -*-
"""把 VX Ace extracted/Graphics 映射到 MV 工程的 img/。
VX Ace 基准 32px，MV 基准 48px -> 对 tilesets/characters/enemies/faces 做 1.5x 缩放。
其余(animations/battlebacks/parallaxes/pictures/system/titles/fogs/weather)原样拷贝。
"""
import os
import shutil
from PIL import Image

SRC = "extracted/Graphics"
OUT = "mv_project/img"
SCALE = 1.5

# VX Ace 子目录 -> (MV img 子目录, 是否 1.5x 缩放)
MAP = {
    "Animations":   ("animations",   False),
    "Battlebacks1": ("battlebacks1", False),
    "Battlebacks2": ("battlebacks2", False),
    "Battlers":     ("enemies",      True),   # VX Ace Battlers -> MV enemies
    "Characters":   ("characters",   True),
    "Encyclopedia": ("encyclopedia", False),
    "Faces":        ("faces",        True),
    "Fogs":         ("fogs",         False),
    "Parallaxes":   ("parallaxes",   False),
    "Pictures":     ("pictures",     False),
    "System":       ("system",       False),
    "Tilesets":     ("tilesets",     True),
    "Titles1":      ("titles1",      False),
    "Weather":      ("weather",      False),
}

IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")


def resize_copy(src_file, dst_file, scale):
    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
    if not scale or scale == 1.0:
        shutil.copy2(src_file, dst_file)
        return "copy"
    with Image.open(src_file) as im:
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA") if im.mode == "RGBA" else im
        w, h = im.size
        nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
        res = im.resize((nw, nh), Image.LANCZOS)
        res.save(dst_file)
    return "scale"


def main():
    total = 0
    scaled = 0
    copied = 0
    for sub, (mv_sub, do_scale) in MAP.items():
        sdir = os.path.join(SRC, sub)
        if not os.path.isdir(sdir):
            print("skip (no source):", sub)
            continue
        ddir = os.path.join(OUT, mv_sub)
        os.makedirs(ddir, exist_ok=True)
        for fn in os.listdir(sdir):
            sp = os.path.join(sdir, fn)
            if os.path.isdir(sp):          # 跳过子目录
                continue
            if not fn.lower().endswith(IMG_EXT):
                # 非图片文件也原样拷贝(如 .txt 说明)
                shutil.copy2(sp, os.path.join(ddir, fn))
                continue
            sf = os.path.join(sdir, fn)
            df = os.path.join(ddir, fn)
            r = resize_copy(sf, df, SCALE if do_scale else 1.0)
            total += 1
            if r == "scale":
                scaled += 1
            else:
                copied += 1
        print("  %-12s -> img/%-12s (scale=%s)" % (sub, mv_sub, do_scale))
    print("\nDone. total=%d scaled=%d copied=%d" % (total, scaled, copied))


if __name__ == "__main__":
    main()
