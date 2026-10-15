#!/usr/bin/env python3
"""Извлечение кадров из видео для QA.

python3 scripts/extract_frames.py input.mp4 output_dir --interval 0.5
python3 scripts/extract_frames.py input.mp4 output_dir --start 5.2 --end 5.9 --every-frame

Кадры называются по времени (t012.500s.jpg), рядом пишется manifest.json
с фактическими timestamp (pts) каждого кадра. FFmpeg вызывается списком
аргументов, без shell.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys


def probe(path: str) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=avg_frame_rate,width,height:format=duration", "-of", "json", path],
        check=True, capture_output=True, text=True,
    )
    data = json.loads(out.stdout)
    num, den = data["streams"][0]["avg_frame_rate"].split("/")
    return {
        "fps": float(num) / float(den),
        "duration": float(data["format"]["duration"]),
        "width": data["streams"][0]["width"],
        "height": data["streams"][0]["height"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--interval", type=float, default=0.5, help="шаг, сек")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--every-frame", action="store_true", help="все кадры в интервале")
    args = ap.parse_args()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ошибка: не найдены ffmpeg/ffprobe в PATH", file=sys.stderr)
        return 2
    if not os.path.isfile(args.input):
        print(f"ошибка: нет файла {args.input}", file=sys.stderr)
        return 2
    try:
        info = probe(args.input)
    except (subprocess.CalledProcessError, KeyError, ValueError) as err:
        print(f"ошибка: не удалось прочитать видео: {err}", file=sys.stderr)
        return 3

    end = min(args.end if args.end is not None else info["duration"], info["duration"])
    step = 1.0 / info["fps"] if args.every_frame else args.interval
    os.makedirs(args.output, exist_ok=True)
    manifest = {"input": os.path.abspath(args.input), **info, "frames": []}
    t = args.start
    idx = 0
    while t < end - 1e-6:
        name = f"t{t:07.3f}s.jpg"
        dst = os.path.join(args.output, name)
        # точный seek: -ss после -i
        res = subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", args.input, "-ss", f"{t:.4f}",
             "-frames:v", "1", "-q:v", "3", dst],
            capture_output=True, text=True,
        )
        if res.returncode != 0 or not os.path.isfile(dst):
            print(f"предупреждение: кадр {t:.3f}s не декодирован: {res.stderr.strip()}", file=sys.stderr)
        else:
            manifest["frames"].append({"file": name, "t": round(t, 4), "frame": round(t * info["fps"])})
        idx += 1
        t = args.start + idx * step
    with open(os.path.join(args.output, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    print(f"{len(manifest['frames'])} кадров → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
