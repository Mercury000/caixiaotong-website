"""Encode native Compose PNG sequences into compact, browser-compatible demos."""

import argparse
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

SCENES = {
    "payment-qr": 62, "payment-barcode": 62, "payment-recharge": 90, "payment-privacy": 90,
    "hall-electricity": 78, "hall-network": 66, "hall-rooms": 82,
    "bill-stats": 82, "bill-filter": 66, "bill-date": 66,
    "mine-profile": 66, "mine-account": 66, "mine-theme": 146,
    **{f"{prefix}-{kind}{suffix}": count
       for kind, count in {"floating": 90, "style": 130, "blur": 120, "back": 150}.items()
       for prefix, suffix in [("settings", ""), ("effect", "-light"), ("effect", "-dark")]},
}

THEME_RANGES = {"floating": (30, 69), "style": (0, 55), "blur": (0, 65), "back": (0, 149)}
THEME_VARIANTS = [f"{kind}-{blur}{top}" for kind in ("docked", "floating", "ios")
                  for blur in ("plain", "blur") for top in ("", "-top-blur")]


def encoder(ffmpeg, movie):
    return subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                             "-f", "image2pipe", "-framerate", "20", "-vcodec", "png", "-i", "pipe:0",
                             "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(movie)], stdin=subprocess.PIPE)


def native_frames(root, scene, bounds):
    frames = [root / scene / f"{index:04d}.png" for index in range(bounds[0], bounds[1] + 1)]
    if not all(frame.is_file() for frame in frames):
        raise RuntimeError(f"Incomplete native capture: {scene}")
    return frames


def encode_theme(args):
    report = []
    for variant in THEME_VARIANTS:
        if args.top_only and not variant.endswith("-top-blur"):
            continue
        for kind, count in [("bar", 64), ("back", 70)]:
            scene = f"theme-{kind}-{variant}-{args.mode}"
            frames = native_frames(args.frames, scene, (0, count - 1))
            movie = args.output / f"{scene}.mp4"
            process = encoder(args.ffmpeg, movie)
            try:
                for frame in frames:
                    process.stdin.write(frame.read_bytes())
                process.stdin.write(frames[-1].read_bytes() * 12)
            finally:
                process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError(f"Encoding failed: {scene}")
            # Each combination has a native base image available without its movie.
            if kind == "bar":
                with Image.open(frames[0]) as image:
                    image.save(args.output / f"{scene}.webp", lossless=True, method=6)
            report.append({"scene": scene, "duration": (count + 12) / 20,
                           "bytes": movie.stat().st_size})
    return report


def export_pages(args):
    for page, scene in {"payment": "payment-qr", "hall": "hall-rooms", "bill": "bill-filter", "mine": "mine-account"}.items():
        with Image.open(args.frames / scene / "0000.png") as image:
            target = args.output.parent / f"{page}-{args.mode}"
            image.save(target.with_suffix(".png"))
            for width, suffix in [(480, ""), (960, "@2x")]:
                height = round(width * 891 / 411)
                image.resize((width, height), Image.Resampling.LANCZOS).save(
                    target.parent / f"{target.name}{suffix}.webp", lossless=True, method=6)


def export_tablet(args):
    report = []
    for variant in THEME_VARIANTS:
        scene = f"theme-pad-{variant}-{args.mode}"
        with Image.open(args.frames / f"{scene}.png") as image:
            if image.size != (1280, 800):
                raise RuntimeError(f"Unexpected tablet capture size: {scene}")
            target = args.output / f"{scene}.webp"
            image.save(target, lossless=True, method=6)
        report.append({"scene": scene, "bytes": target.stat().st_size})
    for top in ("", "-top-blur"):
        for blur in ("plain", "blur"):
            scene = f"theme-pad-docked-{blur}{top}-collapsed-{args.mode}"
            with Image.open(args.frames / f"theme-pad-docked-plain{top}-collapsed-{args.mode}.png") as image:
                image.save(args.output / f"{scene}.webp", lossless=True, method=6)
        for action in ("expand", "collapse"):
            scene = f"theme-pad-rail-{action}{top}-{args.mode}"
            frames = native_frames(args.frames, scene, (0, 25))
            movie = args.output / f"{scene}.mp4"
            process = encoder(args.ffmpeg, movie)
            try:
                for frame in frames:
                    process.stdin.write(frame.read_bytes())
                process.stdin.write(frames[-1].read_bytes() * 10)
            finally:
                process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError(f"Encoding failed: {scene}")
            report.append({"scene": scene, "bytes": movie.stat().st_size})
    report.extend(encode_tablet_back(args))
    return report


def encode_tablet_back(args):
    report = []
    for variant in THEME_VARIANTS:
        for collapsed in ("", "-collapsed") if variant.startswith("docked") else ("",):
            asset = f"theme-pad-back-{variant}{collapsed}-{args.mode}"
            source = asset.replace("docked-blur", "docked-plain")
            frames = native_frames(args.frames, source, (0, 41))
            movie = args.output / f"{asset}.mp4"
            process = encoder(args.ffmpeg, movie)
            try:
                for frame in frames:
                    process.stdin.write(frame.read_bytes())
                process.stdin.write(frames[-1].read_bytes() * 10)
            finally:
                process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError(f"Encoding failed: {asset}")
            report.append({"scene": asset, "bytes": movie.stat().st_size})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", type=Path)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--scene", choices=SCENES, action="append")
    parser.add_argument("--tour", action="store_true", help="Encode the continuous native tour and its chapters.")
    parser.add_argument("--theme-only", action="store_true", help="Encode composable bottom-bar and return effects, without settings footage.")
    parser.add_argument("--top-only", action="store_true", help="With --theme-only, encode only the added top-bar blur combinations.")
    parser.add_argument("--showcase-only", action="store_true", help="Encode short, manually selected page demonstrations.")
    parser.add_argument("--mode", choices=("light", "dark"), default="light")
    parser.add_argument("--pages", action="store_true", help="Export the four static pages for this color mode.")
    parser.add_argument("--tablet-only", action="store_true", help="Export native wide-window theme stills.")
    parser.add_argument("--tablet-back-only", action="store_true", help="Encode only the native tablet return demonstrations.")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets" / "demos")
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("Pass --ffmpeg with the path to ffmpeg.")
    args.output.mkdir(parents=True, exist_ok=True)
    if args.tablet_back_only:
        print(json.dumps(encode_tablet_back(args), ensure_ascii=False, indent=2))
        return
    if args.tablet_only:
        print(json.dumps(export_tablet(args), ensure_ascii=False, indent=2))
        return
    if args.pages:
        export_pages(args)
    if args.theme_only:
        print(json.dumps(encode_theme(args), ensure_ascii=False, indent=2))
        return
    if args.tour:
        source = args.frames / "tour"
        metadata = json.loads((source / "chapters.json").read_text(encoding="utf-8"))
        count = round(metadata["duration"] * 20)
        if not all((source / f"{index:04d}.png").is_file() for index in range(count)):
            raise RuntimeError("Incomplete continuous native tour")
        subprocess.run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                        "-framerate", "20", "-i", str(source / "%04d.png"), "-frames:v", str(count),
                        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(args.output / "tour.mp4")], check=True)
        # Chapter ends precede the native pager transition into the next page.
        for index, chapter in enumerate(metadata["chapters"]):
            if "end" not in chapter:
                following = metadata["chapters"][index + 1] if index + 1 < len(metadata["chapters"]) else None
                gap = 1.2 if following and chapter["id"].split("-")[0] != following["id"].split("-")[0] else 0
                chapter["end"] = following["start"] - gap if following else metadata["duration"] - 1.5
        (args.output / "tour.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with Image.open(source / "0000.png") as image:
            image.save(args.output / "tour.webp", lossless=True, method=6)
        print(json.dumps({"tour": metadata, "bytes": (args.output / "tour.mp4").stat().st_size}, indent=2))
        return
    report = []
    scenes = args.scene or [name for name in SCENES
                           if (not args.theme_only or name.startswith(("settings-", "effect-")))
                           and (not args.showcase_only or not name.startswith(("settings-", "effect-", "payment-qr", "payment-barcode")))]
    for scene in scenes:
        count = SCENES[scene]
        source_scene = f"{scene}-{args.mode}" if scene == "payment-privacy" else scene
        frames = [args.frames / source_scene / f"{index:04d}.png" for index in range(count)]
        if not all(frame.is_file() for frame in frames):
            raise RuntimeError(f"Incomplete native capture: {scene}")
        theme = scene.startswith(("settings-", "effect-"))
        if theme:
            # Floating demonstrates enabling the bar; every scene holds its final result.
            start, end = THEME_RANGES[scene.split("-")[1]]
            frames = frames[start:end + 1]
        # Extend the fully opened interface so its details remain readable.
        hold_at = 93 if scene == "mine-theme" else count - 21
        asset = f"{scene}-dark" if args.mode == "dark" else scene
        movie = args.output / f"{asset}.mp4"
        command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                   "-f", "image2pipe", "-framerate", "20", "-vcodec", "png", "-i", "pipe:0",
                   "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                   "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(movie)]
        process = subprocess.Popen(command, stdin=subprocess.PIPE)
        try:
            for index, frame in enumerate(frames):
                data = frame.read_bytes()
                process.stdin.write(data)
                if (theme and index == len(frames) - 1) or (not theme and index == hold_at):
                    process.stdin.write(data * 20)
        finally:
            process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError(f"Encoding failed: {scene}")
        # A settled native image is also available before video playback.
        poster = frames[-1] if theme or scene == "payment-privacy" else frames[93 if scene == "mine-theme" else min(37, hold_at)]
        with Image.open(poster) as image:
            image.save(args.output / f"{asset}.webp", lossless=True, method=6)
        duration = (len(frames) + 20) / 20
        report.append({"scene": scene, "duration": duration, "bytes": movie.stat().st_size})
    if args.showcase_only:
        # Dual codes are a still image. The enlargement action shows both native sheets.
        asset = "payment-enlarge-dark" if args.mode == "dark" else "payment-enlarge"
        movie = args.output / f"{asset}.mp4"
        process = subprocess.Popen([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                                    "-f", "image2pipe", "-framerate", "20", "-vcodec", "png", "-i", "pipe:0",
                                    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(movie)], stdin=subprocess.PIPE)
        try:
            for scene in ("payment-qr", "payment-barcode"):
                for index in range(SCENES[scene]):
                    frame = args.frames / scene / f"{index:04d}.png"
                    process.stdin.write(frame.read_bytes())
        finally:
            process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError("Encoding failed: payment-enlarge")
        with Image.open(args.frames / "payment-qr" / "0000.png") as image:
            image.save(args.output / f"{asset}.webp", lossless=True, method=6)
        report.append({"scene": "payment-enlarge", "duration": 6.2, "bytes": movie.stat().st_size})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
