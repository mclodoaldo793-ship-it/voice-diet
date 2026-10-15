#!/usr/bin/env python3
"""Контактный лист: python3 scripts/contact_sheet.py out.png img1 img2 ... [--cols N] [--width W]"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("output")
    ap.add_argument("images", nargs="+")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--width", type=int, default=640, help="ширина одного кадра")
    args = ap.parse_args()

    tiles = []
    for path in args.images:
        try:
            im = Image.open(path).convert("RGB")
        except OSError as err:
            print(f"пропуск {path}: {err}", file=sys.stderr)
            continue
        h = round(im.height * args.width / im.width)
        tiles.append((os.path.basename(path), im.resize((args.width, h), Image.LANCZOS)))
    if not tiles:
        print("нет кадров", file=sys.stderr)
        return 1

    label_h = 22
    tile_h = tiles[0][1].height + label_h
    rows = (len(tiles) + args.cols - 1) // args.cols
    sheet = Image.new("RGB", (args.cols * args.width, rows * tile_h), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, im) in enumerate(tiles):
        x = (i % args.cols) * args.width
        y = (i // args.cols) * tile_h
        sheet.paste(im, (x, y + label_h))
        draw.text((x + 6, y + 3), name, fill=(235, 235, 235), font=font)
    sheet.save(args.output)
    print(args.output, sheet.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
