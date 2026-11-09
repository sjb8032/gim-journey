#!/usr/bin/env python3
"""
실험 데이터를 사이트에 등록합니다. data/ 폴더로 복사·압축하고 data/manifest.json 을 고쳐 줍니다.

  python tools/add_data.py csv   김실험.csv --title "김 수분 측정 1차"
  python tools/add_data.py video depth.mp4 --title "컨베이어 Depth" --split 30
  python tools/add_data.py video depth.mp4 --title "컨베이어 Depth" --clips 30
  python tools/add_data.py clear-samples

video 옵션
  --split N    파일은 하나로 두고, 화면에서 N초씩 끊어 아래로 넘기며 보기 (권장)
  --clips N    N초 길이의 파일 여러 개로 실제 분할 (영상이 아주 길거나 GitHub 100MB 제한에 걸릴 때)
  --kind       depth(기본) 또는 rgb
  --height     세로 해상도 (기본 720, 원본이 더 작으면 그대로)
  --depth-min / --depth-max   색 막대에 표시할 거리(mm)
ffmpeg 가 필요합니다 (https://ffmpeg.org/download.html).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "data", "manifest.json")
GITHUB_LIMIT = 95 * 1024 * 1024


def load():
    try:
        with open(MANIFEST, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"csv": [], "videos": []}


def save(m):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write("\n")


def safe_name(path):
    stem, ext = os.path.splitext(os.path.basename(path))
    stem = re.sub(r"[\s/\\:*?\"<>|]+", "_", stem).strip("_") or "data"
    return stem, ext.lower()


def fmt_t(s):
    return f"{int(s // 60):02d}:{int(s % 60):02d}"


def probe_duration(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
                             capture_output=True, text=True, check=True).stdout.strip()
        return float(out)
    except Exception:
        return None


def cmd_csv(a):
    stem, ext = safe_name(a.file)
    dest_rel = f"data/csv/{stem}{ext or '.csv'}"
    os.makedirs(os.path.join(ROOT, "data", "csv"), exist_ok=True)
    shutil.copyfile(a.file, os.path.join(ROOT, dest_rel))
    m = load()
    m.setdefault("csv", [])
    m["csv"] = [c for c in m["csv"] if c.get("file") != dest_rel]
    m["csv"].insert(0, {"title": a.title or stem, "file": dest_rel})
    save(m)
    print(f"CSV 등록: {dest_rel}  (사이트의 '데이터 보기'에서 첫 번째로 보입니다)")


def cmd_video(a):
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg 가 필요합니다: https://ffmpeg.org/download.html")
    stem, _ = safe_name(a.file)
    os.makedirs(os.path.join(ROOT, "data", "videos"), exist_ok=True)
    vf = f"scale=-2:'min({a.height},ih)'"
    enc = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(a.crf), "-pix_fmt", "yuv420p"]
    base = {"kind": a.kind}
    if a.depth_min is not None:
        base["depthMin"] = a.depth_min
    if a.depth_max is not None:
        base["depthMax"] = a.depth_max
    m = load()
    m.setdefault("videos", [])
    title = a.title or stem
    if a.clips:
        pattern = os.path.join(ROOT, "data", "videos", f"{stem}_%03d.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.file, "-vf", vf, *enc,
                        "-force_key_frames", f"expr:gte(t,n_forced*{a.clips})",
                        "-f", "segment", "-segment_time", str(a.clips), "-reset_timestamps", "1",
                        "-segment_format_options", "movflags=+faststart", pattern], check=True)
        parts = sorted(p for p in os.listdir(os.path.join(ROOT, "data", "videos")) if re.fullmatch(rf"{re.escape(stem)}_\d{{3}}\.mp4", p))
        entries = []
        for i, p in enumerate(parts):
            rel = f"data/videos/{p}"
            entries.append({**base, "title": f"{title} · {i + 1}/{len(parts)}", "file": rel,
                            "range": f"{fmt_t(i * a.clips)}–{fmt_t((i + 1) * a.clips)}"})
        m["videos"] = entries + [v for v in m["videos"] if not v.get("file", "").startswith(f"data/videos/{stem}_")]
        save(m)
        print(f"영상 {len(parts)}개로 나눠 등록했습니다: data/videos/{stem}_000.mp4 …")
        return
    rel = f"data/videos/{stem}.mp4"
    dest = os.path.join(ROOT, rel)
    tmp = dest + ".part.mp4"   # never write over the input while reading it
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.file, "-vf", vf, *enc, "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, dest)
    size = os.path.getsize(dest)
    entry = {**base, "title": title, "file": rel}
    if a.split:
        entry["split"] = a.split
        dur = probe_duration(dest)
        if dur:
            entry["duration"] = round(dur, 2)
    m["videos"] = [entry] + [v for v in m["videos"] if v.get("file") != rel]
    save(m)
    print(f"영상 등록: {rel}  ({size / 1024 / 1024:.1f} MB)")
    if size > GITHUB_LIMIT:
        print("주의: GitHub 는 100MB 가 넘는 파일을 올릴 수 없습니다. --clips 30 으로 나누거나 --crf 30 으로 더 압축하세요.")


def cmd_clear(_a):
    m = load()
    before = len(m.get("csv", [])) + len(m.get("videos", []))
    m["csv"] = [c for c in m.get("csv", []) if not c.get("sample")]
    m["videos"] = [v for v in m.get("videos", []) if not v.get("sample")]
    save(m)
    removed = before - len(m["csv"]) - len(m["videos"])
    print(f"샘플 항목 {removed}개를 manifest 에서 뺐습니다. (data/csv/sample_*, data/videos/sample_* 파일은 지워도 됩니다)")


def main():
    ap = argparse.ArgumentParser(description="실험 데이터를 사이트에 등록합니다.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("csv", help="CSV 파일 등록")
    c.add_argument("file")
    c.add_argument("--title")
    c.set_defaults(fn=cmd_csv)
    v = sub.add_parser("video", help="영상 압축 후 등록")
    v.add_argument("file")
    v.add_argument("--title")
    v.add_argument("--split", type=int, help="화면에서 N초씩 끊어 보기")
    v.add_argument("--clips", type=int, help="N초 파일 여러 개로 실제 분할")
    v.add_argument("--kind", default="depth", choices=["depth", "rgb"])
    v.add_argument("--height", type=int, default=720)
    v.add_argument("--crf", type=int, default=26)
    v.add_argument("--depth-min", type=int)
    v.add_argument("--depth-max", type=int)
    v.set_defaults(fn=cmd_video)
    s = sub.add_parser("clear-samples", help="샘플 데이터 항목 지우기")
    s.set_defaults(fn=cmd_clear)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
