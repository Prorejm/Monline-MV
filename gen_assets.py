# -*- coding: utf-8 -*-
"""Deliverable B (part 1): compute missing RTP assets for the Monline MV project.

Scans ``mv_project/data`` for referenced asset names and cross-checks them against
the files actually present in ``mv_project/img`` / ``mv_project/audio``.

Output: ``missing_assets.json`` at the project root with the missing basenames:
  - tilesets  : missing tileset component names (from Tilesets.json tilesetNames)
  - characters: missing character sprite basenames (characterName refs)
  - faces     : missing face basenames (faceName refs)
  - audio     : missing audio names per category (BGM/ME/BGS/SE) referenced in data

Audio note: the source game's audio was never extracted (only Data + Graphics),
so every referenced audio file is considered missing. Categories with *no*
references in the data are left as empty lists; ``copy_rtp.py`` will then copy the
entire RTP sub-directory for that category ("all missing").
"""
import json
import glob
import os

ROOT = "mv_project"
DATA = os.path.join(ROOT, "data")
IMG = os.path.join(ROOT, "img")
AUDIO = os.path.join(ROOT, "audio")

IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")


def img_exists(sub, name):
    """Return True if ``name`` (with or without extension) exists under IMG/sub."""
    if not name:
        return True  # empty slot -> nothing to resolve
    base = os.path.splitext(name)[0]
    for ext in IMG_EXTS:
        if os.path.isfile(os.path.join(IMG, sub, base + ext)):
            return True
    if os.path.isfile(os.path.join(IMG, sub, name)):
        return True
    return False


def collect_tileset_components():
    """All non-empty component names referenced by Tilesets.json."""
    out = []
    with open(os.path.join(DATA, "Tilesets.json"), encoding="utf-8") as f:
        tilesets = json.load(f)
    for ts in tilesets:
        if not ts:
            continue
        for comp in ts.get("tilesetNames", []):
            if comp and comp not in out:
                out.append(comp)
    return out


def walk_refs(obj, chars, faces, audio):
    """Recursively collect characterName / faceName refs and audio refs."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "characterName" and isinstance(v, str) and v:
                chars.add(v)
            elif k == "faceName" and isinstance(v, str) and v:
                faces.add(v)
            elif k in ("titleBgm", "titleBgs") and isinstance(v, dict) \
                    and isinstance(v.get("name"), str) and v.get("name"):
                cat = "BGM" if k == "titleBgm" else "BGS"
                audio[cat].add(v["name"])
            elif k == "sound" and isinstance(v, dict) \
                    and isinstance(v.get("name"), str) and v.get("name"):
                audio["SE"].add(v["name"])
            else:
                walk_refs(v, chars, faces, audio)
    elif isinstance(obj, list):
        # Event command lists carry audio via code + parameters[0].
        is_cmd_list = all(
            isinstance(it, dict) and "code" in it and "parameters" in it
            for it in obj if isinstance(it, dict)
        ) and len(obj) > 0
        if is_cmd_list:
            code_to_cat = {241: "BGM", 245: "BGS", 249: "ME", 250: "SE"}
            for it in obj:
                if not isinstance(it, dict):
                    continue
                cat = code_to_cat.get(it.get("code"))
                if cat:
                    params = it.get("parameters") or []
                    a = params[0] if params else None
                    if isinstance(a, dict) and isinstance(a.get("name"), str) \
                            and a.get("name"):
                        audio[cat].add(a["name"])
                # also descend into non-audio structures (choices, etc.)
                for key, val in it.items():
                    if key not in ("code", "parameters"):
                        walk_refs(val, chars, faces, audio)
        else:
            for it in obj:
                walk_refs(it, chars, faces, audio)


def main():
    # --- tilesets ---
    components = collect_tileset_components()
    tilesets_missing = sorted(
        c for c in components if not img_exists("tilesets", c)
    )

    # --- characters / faces / audio ---
    chars = set()
    faces = set()
    audio = {"BGM": set(), "ME": set(), "BGS": set(), "SE": set()}
    for jf in glob.glob(os.path.join(DATA, "*.json")):
        with open(jf, encoding="utf-8") as f:
            obj = json.load(f)
        walk_refs(obj, chars, faces, audio)

    chars_missing = sorted(c for c in chars if not img_exists("characters", c))
    faces_missing = sorted(f for f in faces if not img_exists("faces", f))

    audio_missing = {k: sorted(v) for k, v in audio.items()}

    missing = {
        "tilesets": tilesets_missing,
        "characters": chars_missing,
        "faces": faces_missing,
        "audio": audio_missing,
    }

    out_path = "missing_assets.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(missing, f, indent=2, ensure_ascii=False)

    # --- report ---
    print("=== missing_assets.json ===")
    print("tilesets  missing : %d (of %d referenced components)"
          % (len(tilesets_missing), len(components)))
    print("characters missing: %d (of %d referenced names)"
          % (len(chars_missing), len(chars)))
    print("faces      missing: %d (of %d referenced names)"
          % (len(faces_missing), len(faces)))
    for cat in ("BGM", "ME", "BGS", "SE"):
        print("audio %-3s missing : %d referenced names"
              % (cat, len(audio_missing[cat])))
    print("written ->", out_path)


if __name__ == "__main__":
    main()
