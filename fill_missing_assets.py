#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Fill the picture names the game asks for but that no source ever shipped.

26 `img/pictures/` names are referenced by literal `Show Picture` (231) commands
and exist in neither the game archive nor the VX Ace / MV RTP -- the original
game itself is missing them, so they are not a porting defect.  Left alone they
produce a "Loading Error"-style degradation the moment the scene runs.

Strategy, chosen per name after looking at how it is actually used:

1. **Invisible** -> a transparent 544x416 PNG.  `Beret1` is shown with opacity 0,
   so the honest substitute is nothing at all; this only stops the load error.

2. **Same-character family exists** -> the numerically nearest sibling.  These
   names are `<monster><number>` stage/variant CGs (`PrincessMaid` has 221
   files, `Echidna` 28, `Dullahan` 13), so a sibling is the same character at a
   neighbouring stage.  `Wurm2/8` are the creature whose picture family is
   actually named `Sandwurm*` (the source has no `Wurm*.png` at all).

3. **No family at all, but the character's own art exists elsewhere** ->
   build a 544x416 picture from that art.  `Lamia` has a battler
   (`img/enemies/Lamia.png`), so the substitute is the Lamia on a dark
   backdrop rather than an unrelated character.

4. **`Pentagram1..9`** -> generated.  The game ships a grayscale pentagram as a
   character sprite (`Characters/$Pentagram.png`, 3x4 frames of 96x96); the
   nine pictures are a ritual effect shown one after another, so the frames are
   that graphic colourised to a violet glow and rotated in nine 40-degree steps.

Everything is written at the family's own 544x416 size and as `.png`, which is
the only extension MV ever requests.

Existing files are never overwritten.

Usage:
    python fill_missing_assets.py [--project Monline-MV] [--dry-run]
"""
import argparse
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIC_SIZE = (544, 416)
PIC_W, PIC_H = PIC_SIZE

# name -> (source picture family, note)
SIBLING = {
    "Echidna6": "Echidna", "Echidna8": "Echidna", "Echidna11": "Echidna",
    "Echidna12": "Echidna",
    "Nereid1": "Nereid",
    "Dullahan2": "Dullahan",
    "PrincessMaid48": "PrincessMaid", "PrincessMaid266": "PrincessMaid",
    "PrincessMaid271": "PrincessMaid", "PrincessMaid325": "PrincessMaid",
    "PrincessMaid2148": "PrincessMaid", "PrincessMaid2149": "PrincessMaid",
    # the creature's picture family is `Sandwurm*`, not `Wurm*`
    "Wurm2": "Sandwurm", "Wurm8": "Sandwurm",
}
INVISIBLE = ["Beret1"]
PENTAGRAM = ["Pentagram%d" % i for i in range(1, 10)]
PENTAGRAM_SPRITE = os.path.join(SCRIPT_DIR, "extracted", "Graphics",
                                "Characters", "$Pentagram.png")
BATTLER_BACKDROP = {
    # name -> battler art to composite on a dark backdrop
    "Lamia265": ("Lamia", "extracted/Graphics/Battlers/Lamia.png"),
    "Lamia288": ("Lamia", "extracted/Graphics/Battlers/Lamia.png"),
}

MISSING = (INVISIBLE + PENTAGRAM + sorted(SIBLING) +
           sorted(BATTLER_BACKDROP))


def pic_dir(project):
    return os.path.join(project, "img", "pictures")


def numeric_part(name, base):
    """The digits right after the family name, or None."""
    tail = name[len(base):]
    m = re.match(r"^(\d+)", tail)
    return int(m.group(1)) if m else None


def leading_number(name):
    """The first digit run of a missing name.

    This is the number the *missing* name carries, not the sibling family's --
    `Wurm2` maps onto the `Sandwurm*` family, so asking `numeric_part('Wurm2',
    'Sandwurm')` would return None.  `PrincessMaid2148` -> 2148, `Wurm2` -> 2.
    """
    m = re.search(r"(\d+)", name)
    return int(m.group(1)) if m else None


def nearest_sibling(pic_dir, base, want):
    """The existing `<base><digits>*` file whose number is closest to `want`.
    Falls back to the first file of the family when nothing numeric matches."""
    best = None
    best_gap = None
    for f in sorted(os.listdir(pic_dir)):
        if not f.lower().endswith(".png"):
            continue
        if not f.startswith(base):
            continue
        n = numeric_part(f, base)
        if n is None:
            continue
        gap = abs(n - want)
        if best_gap is None or gap < best_gap:
            best_gap, best = gap, f
    return best


def load_rgb(path):
    return Image.open(path).convert("RGB")


def paste_cover(canvas, art):
    """Scale `art` to cover the 544x416 canvas, cropping the overflow, and
    centre it -- the way a full-screen CG is normally framed."""
    w, h = art.size
    scale = max(PIC_W / w, PIC_H / h)
    art = art.resize((max(1, int(w * scale)), max(1, int(h * scale))),
                     Image.LANCZOS)
    x = (art.size[0] - PIC_W) // 2
    y = (art.size[1] - PIC_H) // 2
    canvas.paste(art.crop((x, y, x + PIC_W, y + PIC_H)), (0, 0))
    return canvas


def make_invisible():
    img = Image.new("RGBA", PIC_SIZE, (0, 0, 0, 0))
    return img.convert("RGB")


def make_lamia(battler_path):
    """The character's own battler art, on a dark backdrop, sized like a CG."""
    art = Image.open(battler_path).convert("RGBA")
    back = Image.new("RGB", PIC_SIZE, (10, 8, 16))
    # a faint radial light behind the figure so it does not sit on flat black
    glow = Image.new("L", PIC_SIZE, 0)
    d = ImageDraw.Draw(glow)
    cx, cy, r = PIC_W // 2, PIC_H // 2 + 40, 300
    for i in range(r, 0, -6):
        d.ellipse((cx - i, cy - i, cx + i, cy + i), fill=int(70 * (i / r)))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    back = Image.composite(Image.new("RGB", PIC_SIZE, (46, 32, 66)), back, glow)

    scale = min((PIC_W * 0.7) / art.size[0], (PIC_H * 0.8) / art.size[1])
    art = art.resize((int(art.size[0] * scale), int(art.size[1] * scale)),
                     Image.LANCZOS)
    back.paste(art, ((PIC_W - art.size[0]) // 2,
                     (PIC_H - art.size[1]) // 2), art)
    return back


def make_pentagram(frame_index, total=9):
    """A rotating magic circle built from the game's own pentagram sprite."""
    sheet = Image.open(PENTAGRAM_SPRITE).convert("RGBA")
    fw, fh = sheet.size[0] // 3, sheet.size[1] // 4
    glyph = sheet.crop((0, 0, fw, fh)).convert("RGBA")

    canvas = Image.new("RGBA", PIC_SIZE, (0, 0, 0, 0))
    angle = frame_index * 360.0 / total

    # colourise the grayscale glyph: luminance -> dark violet .. near-white
    lum = glyph.convert("L")
    violet = Image.new("RGBA", glyph.size, (168, 108, 255, 255))
    white = Image.new("RGBA", glyph.size, (246, 236, 255, 255))
    tinted = Image.composite(white, violet, lum)
    tinted.putalpha(glyph.split()[3].point(lambda a: int(a * 0.92)))

    # fit the glyph to ~86% of the frame height and rotate it
    side = int(PIC_H * 0.86)
    scale = side / max(fw, fh)
    glyph_big = tinted.resize((int(fw * scale), int(fh * scale)),
                              Image.LANCZOS)
    rot = glyph_big.rotate(angle, resample=Image.BICUBIC, expand=True)

    # a soft radial glow behind it, brighter as the series advances
    glow = Image.new("L", PIC_SIZE, 0)
    d = ImageDraw.Draw(glow)
    cx, cy, r = PIC_W // 2, PIC_H // 2, int(PIC_H * 0.42)
    for i in range(r, 0, -4):
        v = int((38 + 26 * frame_index / max(total - 1, 1)) * (i / r))
        d.ellipse((cx - i, cy - i, cx + i, cy + i), fill=v)
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    canvas = Image.composite(Image.new("RGBA", PIC_SIZE, (72, 30, 132, 255)),
                             canvas, glow)

    x = (PIC_W - rot.size[0]) // 2
    y = (PIC_H - rot.size[1]) // 2
    canvas.alpha_composite(rot, (max(0, x), max(0, y)))
    return canvas.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.path.join(SCRIPT_DIR, "Monline-MV"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    d = pic_dir(args.project)
    if not os.path.isdir(d):
        print("no %s" % d)
        return 2

    written = []
    skipped = []
    for name in MISSING:
        out = os.path.join(d, name + ".png")
        if os.path.isfile(out):
            skipped.append(name)
            continue

        if name in INVISIBLE:
            img = make_invisible()
            how = "transparent 544x416 (the scene shows it at opacity 0)"
        elif name in PENTAGRAM:
            idx = PENTAGRAM.index(name)
            img = make_pentagram(idx)
            how = "rotating magic circle, frame %d/9, from the game's own sprite" % (idx + 1)
        elif name in SIBLING:
            base = SIBLING[name]
            want = leading_number(name)
            sib = nearest_sibling(d, base, want)
            if not sib:
                print("   !! no %s* sibling found for %s" % (base, name))
                continue
            img = load_rgb(os.path.join(d, sib))
            how = "nearest %s* sibling: %s" % (base, sib)
        else:
            label, battler = BATTLER_BACKDROP[name]
            path = os.path.join(SCRIPT_DIR, battler)
            if not os.path.isfile(path):
                print("   !! battler missing for %s: %s" % (name, path))
                continue
            img = make_lamia(path)
            how = "the character's own battler art on a dark backdrop"

        print("%-20s %s" % (name, how))
        if not args.dry_run:
            img.save(out, "PNG", compress_level=9)
        written.append(name)

    print("-" * 62)
    print("written : %d   skipped (already present): %d" % (len(written), len(skipped)))
    for s in skipped:
        print("   already there: %s" % s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
