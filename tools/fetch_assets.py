#!/usr/bin/env python3
"""
Higgsfield 로 만든 이미지 · 배경 영상 · 3D 모델(Tripo)을 저장소 안으로 내려받습니다.

    python tools/fetch_assets.py              # 저장소 맨 위 폴더에서 실행

- 이미지: Pillow 가 있으면 WebP 로 줄여 저장 (없으면 원본 PNG 그대로)
- 배경 영상: ffmpeg 가 있으면 웹용으로 다시 압축 (없으면 원본 그대로)
- 3D 모델: 그대로 저장. --glb-compress 를 주면 npx @gltf-transform/cli 로 텍스처를 1024px WebP 로 압축
끝나면 assets/assets.json 의 preferLocal 이 true 가 되어, 사이트가 CDN 대신 저장소 파일을 먼저 씁니다.
(시연장 와이파이가 약하거나 CDN 이 3D 모델의 교차 출처 요청을 막을 때를 대비하는 단계입니다.)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "assets.json")


def log(msg):
    print(msg, flush=True)


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "gim-journey-asset-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return os.path.getsize(dest)


def to_webp(src, dest, max_side):
    try:
        from PIL import Image
    except ImportError:
        return False
    im = Image.open(src).convert("RGB")
    im.thumbnail((max_side, max_side))
    im.save(dest, "WEBP", quality=82, method=6)
    return True


def have(cmd):
    return shutil.which(cmd) is not None


def fetch_image(entry, tmp):
    url = entry.get("source") or entry["remote"]
    raw = os.path.join(tmp, "img" + os.path.splitext(url.split("?")[0])[1])
    size = download(url, raw)
    dest = os.path.join(ROOT, entry["local"])
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if to_webp(raw, dest, entry.get("max", 1600)):
        log(f"  이미지  {entry['local']}  ({size // 1024} KB → {os.path.getsize(dest) // 1024} KB)")
    else:
        ext = os.path.splitext(raw)[1]
        entry["local"] = os.path.splitext(entry["local"])[0] + ext
        dest = os.path.join(ROOT, entry["local"])
        shutil.copyfile(raw, dest)
        log(f"  이미지  {entry['local']}  (Pillow 없음 → 원본 그대로, {size // 1024} KB)")


def fetch_video(entry, tmp):
    raw = os.path.join(tmp, "video.mp4")
    size = download(entry["remote"], raw)
    dest = os.path.join(ROOT, entry["local"])
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if have("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-an", "-c:v", "libx264", "-preset", "veryfast",
                        "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dest], check=True)
        log(f"  영상    {entry['local']}  ({size // 1024} KB → {os.path.getsize(dest) // 1024} KB)")
    else:
        shutil.copyfile(raw, dest)
        log(f"  영상    {entry['local']}  (ffmpeg 없음 → 원본 그대로, {size // 1024} KB)")


def fetch_model(entry, tmp, compress):
    raw = os.path.join(tmp, "model.glb")
    size = download(entry["remote"], raw)
    dest = os.path.join(ROOT, entry["local"])
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if compress and have("npx"):
        try:
            subprocess.run(["npx", "-y", "@gltf-transform/cli", "optimize", raw, dest,
                            "--texture-compress", "webp", "--texture-size", "1024"], check=True)
            log(f"  3D 모델 {entry['local']}  ({size // 1024} KB → {os.path.getsize(dest) // 1024} KB)")
            return
        except Exception as e:  # fall back to the original file
            log(f"  (압축 실패, 원본 사용: {e})")
    shutil.copyfile(raw, dest)
    log(f"  3D 모델 {entry['local']}  ({size // 1024} KB)")


def main():
    ap = argparse.ArgumentParser(description="Higgsfield 에셋을 저장소 안으로 내려받습니다.")
    ap.add_argument("--glb-compress", action="store_true", help="npx @gltf-transform/cli 로 3D 모델 텍스처 압축")
    ap.add_argument("--skip-models", action="store_true", help="3D 모델은 내려받지 않음")
    ap.add_argument("--skip-video", action="store_true", help="배경 영상은 내려받지 않음")
    args = ap.parse_args()

    with open(MANIFEST, encoding="utf-8") as f:
        m = json.load(f)

    jobs = [("이미지", m["hero"])] + [("이미지", e) for e in m.get("stages", {}).values()]
    if not args.skip_video and m.get("heroVideo"):
        jobs.append(("영상", m["heroVideo"]))
    if not args.skip_models:
        jobs += [("3D", e) for e in m.get("models", {}).values()]

    failed = 0
    with tempfile.TemporaryDirectory() as tmp:
        for kind, entry in jobs:
            try:
                if kind == "이미지":
                    fetch_image(entry, tmp)
                elif kind == "영상":
                    fetch_video(entry, tmp)
                else:
                    fetch_model(entry, tmp, args.glb_compress)
            except Exception as e:
                failed += 1
                log(f"  실패    {entry.get('local')}: {e}")

    m["preferLocal"] = True
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write("\n")
    log("")
    log("완료" if not failed else f"완료 (실패 {failed}개 — 실패한 항목은 계속 CDN 주소로 불러옵니다)")
    log("이제 git add / commit / push 하면 됩니다.")


if __name__ == "__main__":
    sys.exit(main())
