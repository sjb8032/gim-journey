#!/usr/bin/env python3
"""
Intel RealSense 녹화 파일(.bag)을 브라우저에서 재생되는 mp4 로 바꿉니다.
Depth 를 컬러맵으로 칠하고, 원하면 RGB 영상과 나란히 붙입니다.

    pip install pyrealsense2 opencv-python numpy
    python tools/bag_to_mp4.py 녹화.bag --out depth.mp4 --mode side --min 300 --max 1500
    python tools/add_data.py video depth.mp4 --title "컨베이어 Depth" --split 30 --depth-min 300 --depth-max 1500

이미 mp4 로 뽑아 둔 영상이라면 이 스크립트는 필요 없습니다.
(.bag 샘플 없이 작성해서 실제 녹화 파일로는 아직 돌려 보지 못했습니다. 오류가 나면 메시지를 알려 주세요.)
"""
import argparse
import os
import shutil
import subprocess
import sys

try:
    import cv2
    import numpy as np
    import pyrealsense2 as rs
except ImportError:
    sys.exit("먼저 설치하세요: pip install pyrealsense2 opencv-python numpy")


def main():
    ap = argparse.ArgumentParser(description="RealSense .bag → mp4")
    ap.add_argument("bag")
    ap.add_argument("--out", default="depth.mp4")
    ap.add_argument("--mode", choices=["side", "depth", "color"], default="side", help="side = Depth|RGB 나란히")
    ap.add_argument("--min", type=int, default=300, help="컬러맵 최소 거리 mm")
    ap.add_argument("--max", type=int, default=1500, help="컬러맵 최대 거리 mm")
    a = ap.parse_args()

    pipe, cfg = rs.pipeline(), rs.config()
    cfg.enable_device_from_file(a.bag, repeat_playback=False)
    profile = pipe.start(cfg)
    profile.get_device().as_playback().set_real_time(False)

    colorizer = rs.colorizer()
    colorizer.set_option(rs.option.histogram_equalization_enabled, 0)
    colorizer.set_option(rs.option.color_scheme, 0)            # 0 = Jet
    colorizer.set_option(rs.option.min_distance, a.min / 1000)
    colorizer.set_option(rs.option.max_distance, a.max / 1000)

    tmp = a.out + ".raw.mp4"
    writer, n = None, 0
    while True:
        try:
            frames = pipe.wait_for_frames(5000)
        except RuntimeError:
            break                                            # 재생 끝
        depth, color = frames.get_depth_frame(), frames.get_color_frame()
        parts = []
        if a.mode in ("side", "depth") and depth:
            parts.append(cv2.cvtColor(np.asanyarray(colorizer.colorize(depth).get_data()), cv2.COLOR_RGB2BGR))
        if a.mode in ("side", "color") and color:
            img = np.asanyarray(color.get_data())
            if color.get_profile().format() == rs.format.rgb8:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            parts.append(img)
        if not parts:
            continue
        h = min(p.shape[0] for p in parts)
        parts = [cv2.resize(p, (int(p.shape[1] * h / p.shape[0]), h)) for p in parts]
        frame = np.hstack(parts)
        if writer is None:
            fps = (depth or color).get_profile().fps() or 30
            writer = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (frame.shape[1], frame.shape[0]))
        writer.write(frame)
        n += 1
        if n % 300 == 0:
            print(f"  {n} 프레임…", flush=True)
    pipe.stop()
    if writer is None:
        sys.exit("프레임을 하나도 읽지 못했습니다. --mode depth 로 다시 시도해 보세요.")
    writer.release()

    if shutil.which("ffmpeg"):   # 브라우저 호환 H.264 로 다시 인코딩
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.out], check=True)
        os.remove(tmp)
    else:
        os.replace(tmp, a.out)
        print("ffmpeg 가 없어 mp4v 코덱으로 저장했습니다. 일부 브라우저에서 재생되지 않을 수 있습니다.")
    print(f"완료: {a.out} ({n} 프레임)")


if __name__ == "__main__":
    main()
