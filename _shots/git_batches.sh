#!/usr/bin/env bash
# Commit the Monline MV port in batches so the eventual push can be done one
# batch at a time (a single 8 GB pack is refused / throttled by GitHub).
set -u
cd "G:/新建文件夹 (22)/Monline_MV" || exit 1

commit() {           # commit <message> <paths...>
  local msg="$1"; shift
  git add -- "$@" || return 1
  if git diff --cached --quiet; then echo "  (nothing) $msg"; return 0; fi
  git commit -q -m "$msg" || return 1
  echo "  committed: $msg  [$(git rev-parse --short HEAD)]"
}

echo "== batch 1 : repo metadata, tools, docs, original Ruby, probes"
commit "Port tooling, conversion scripts and conversion report" \
  .gitignore conversion_report.md port_report.json missing_assets.json map_assets.log \
  analyze_scripts.py audit_events.py convert.py convert_images.py copy_rtp.py \
  decrypt_rgss3a.py dump_scripts.py fill_missing_assets.py fix_data_defects.py \
  fix_pageimage.py fix_rtp_sources.py fix_schema.py fix_system.py fix_tables.py \
  fix_traits.py fixreader.py gen_assets.py gen_image_ext.py gen_shim.py \
  map_assets.py marshaller.py port_assets.py revert_abs_paren.py schema_check.py \
  split_iconset.py
commit "Bad End roster reference (306 endings)" BadEnd_Roster.html
commit "Original VX Ace Ruby scripts (0000-0274)" _vxace_scripts
commit "Browser probes, unit checks and smoke harness" _shots
commit "Original VX Ace data backup" vxace_data_backup

echo "== batch 2 : the game's code and database"
commit "MV engine shims and the 51 ported plugins" Monline-MV/js
commit "Converted MV database (510 maps, common events, troops)" Monline-MV/data
commit "Game project files, fonts and icon" \
  Monline-MV/index.html Monline-MV/package.json Monline-MV/Game.rpgproject \
  Monline-MV/fonts Monline-MV/icon

echo "== batch 3 : Monline-MV images (non-picture sheets)"
for d in animations battlebacks1 battlebacks2 characters enemies faces \
         parallaxes sv_actors sv_enemies system tilesets titles1 titles2 ; do
  [ -d "Monline-MV/img/$d" ] && commit "Monline-MV img/$d" "Monline-MV/img/$d"
done

echo "== batch 4 : Monline-MV event pictures"
if [ -d Monline-MV/img/pictures ]; then
  ls Monline-MV/img/pictures > /tmp/_pics.txt
  n=$(wc -l < /tmp/_pics.txt); chunk=$(( (n + 2) / 3 ))
  for i in 0 1 2; do
    sed -n "$(( i*chunk + 1 )),$(( (i+1)*chunk ))p" /tmp/_pics.txt \
      | sed 's/^/Monline-MV\/img\/pictures\//' > /tmp/_chunk.txt
    [ -s /tmp/_chunk.txt ] || continue
    commit "Monline-MV img/pictures (part $((i+1))/3)" \
      --pathspec-from-file=/tmp/_chunk.txt
  done
fi

echo "== batch 5 : Monline-MV audio"
commit "Monline-MV audio/bgm" Monline-MV/audio/bgm
commit "Monline-MV audio bgs, me, se" Monline-MV/audio/bgs Monline-MV/audio/me Monline-MV/audio/se

echo "== batch 6 : Monline-MV/Graphics (VX Ace source art)"
for d in Animations Battlebacks1 Battlebacks2 Battlers Characters Faces \
         Parallaxes System Tilesets Titles1 Titles2 ; do
  [ -d "Monline-MV/Graphics/$d" ] && commit "Monline-MV Graphics/$d" "Monline-MV/Graphics/$d"
done
if [ -d Monline-MV/Graphics/Pictures ]; then
  ls Monline-MV/Graphics/Pictures > /tmp/_gp.txt
  n=$(wc -l < /tmp/_gp.txt); chunk=$(( (n + 1) / 2 ))
  for i in 0 1; do
    sed -n "$(( i*chunk + 1 )),$(( (i+1)*chunk ))p" /tmp/_gp.txt \
      | sed 's/^/Monline-MV\/Graphics\/Pictures\//' > /tmp/_gchunk.txt
    [ -s /tmp/_gchunk.txt ] || continue
    commit "Monline-MV Graphics/Pictures (part $((i+1))/2)" \
      --pathspec-from-file=/tmp/_gchunk.txt
  done
fi

echo "== batch 7 : mv_project (the second, synced copy)"
commit "mv_project code and database" mv_project/js mv_project/data
commit "mv_project project files" \
  mv_project/index.html mv_project/package.json mv_project/Game.rpgproject \
  mv_project/fonts mv_project/icon
for d in animations battlebacks1 battlebacks2 characters enemies faces \
         parallaxes sv_actors sv_enemies system tilesets titles1 titles2 ; do
  [ -d "mv_project/img/$d" ] && commit "mv_project img/$d" "mv_project/img/$d"
done
if [ -d mv_project/img/pictures ]; then
  ls mv_project/img/pictures > /tmp/_mp.txt
  n=$(wc -l < /tmp/_mp.txt); chunk=$(( (n + 2) / 3 ))
  for i in 0 1 2; do
    sed -n "$(( i*chunk + 1 )),$(( (i+1)*chunk ))p" /tmp/_mp.txt \
      | sed 's/^/mv_project\/img\/pictures\//' > /tmp/_mchunk.txt
    [ -s /tmp/_mchunk.txt ] || continue
    commit "mv_project img/pictures (part $((i+1))/3)" \
      --pathspec-from-file=/tmp/_mchunk.txt
  done
fi
commit "mv_project audio/bgm" mv_project/audio/bgm
commit "mv_project audio bgs, me, se" mv_project/audio/bgs mv_project/audio/me mv_project/audio/se

echo "== batch 8 : extracted VX Ace assets"
commit "Extracted VX Ace Data" extracted/Data
commit "Extracted VX Ace Graphics" extracted/Graphics

echo "== leftovers"
git add -A
if ! git diff --cached --quiet; then git commit -q -m "Remaining files"; echo "  committed leftovers"; fi

echo "== summary"
git log --oneline | head -60
echo "commits: $(git rev-list --count HEAD)   objects: $(git count-objects -vH | grep size-pack)"
