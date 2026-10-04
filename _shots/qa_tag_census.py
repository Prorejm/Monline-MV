#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Census every <learn ...> tag shape so no variant is missed (esp. eval)."""
import json, re, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "Monline-MV", "data")
def load(n):
    with open(os.path.join(DATA, n), "r", encoding="utf-8") as f:
        return json.load(f)

skills = load("Skills.json")
classes = load("Classes.json")

ANY_LEARN = re.compile(r"<\s*learn\b([^>]*)>", re.IGNORECASE)

def census(rows, label):
    kinds = collections.Counter()
    samples = collections.defaultdict(list)
    for r in rows:
        if not r:
            continue
        note = r.get("note") or ""
        for m in ANY_LEARN.finditer(note):
            body = m.group(1).strip()
            # normalise: first token = subcommand, second token = arg name
            toks = body.replace(":", " ").split()
            if not toks:
                key = "<empty>"
            elif toks[0].lower() == "require":
                key = "require " + (toks[1].lower() if len(toks) > 1 else "<none>")
            else:
                key = toks[0].lower()
            kinds[key] += 1
            if len(samples[key]) < 3:
                samples[key].append((r["id"], r.get("name"), body))
    print("=== <learn> tag census: %s ===" % label)
    for k, c in kinds.most_common():
        print("  %-18s %d   e.g. %s" % (k, c, samples[k]))
    if not kinds:
        print("  (none)")
    return kinds

census(skills, "Skills.json")
census(classes, "Classes.json")

# also: any 'eval' text anywhere in skill notes?
print("\n=== 'eval' occurrences in skill notes ===")
hits = [(s["id"], s.get("name"), s["note"]) for s in skills
        if s and "eval" in (s.get("note") or "").lower()]
print("  count:", len(hits))
for h in hits[:10]:
    print("   ", h)

# line ending check
print("\n=== line endings / punctuation in notes ===")
crlf = sum(1 for s in skills if s and "\r\n" in (s.get("note") or ""))
print("  skills with CRLF in note:", crlf)
# costs with odd spacing / uppercase
COST = re.compile(r"<\s*learn\s+cost\s*:\s*([^>]*)>", re.IGNORECASE)
odd = []
zero = []
for s in skills:
    if not s: continue
    m = COST.search(s.get("note") or "")
    if m:
        b = m.group(1)
        p = b.split()
        if len(p) < 2 or p[1].lower() != "jp":
            odd.append((s["id"], b))
        try:
            if int(p[0]) == 0:
                zero.append((s["id"], s.get("name"), b))
        except Exception:
            odd.append((s["id"], b))
print("  cost tags not '<N jp>':", odd[:10], "count", len(odd))
print("  cost == 0 skills:", zero[:10], "count", len(zero))

# switch ids referenced
SW = re.compile(r"<\s*learn\s+require\s+switch\s*:\s*([^>]*)>", re.IGNORECASE)
sw = [SW.search(s["note"]).group(1).strip() for s in skills if s and SW.search(s.get("note") or "")]
print("  distinct switch ids referenced:", sorted(set(sw)))
