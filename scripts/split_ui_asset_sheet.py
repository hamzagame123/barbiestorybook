from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Any

from PIL import Image


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Manifest root must be a JSON object.")
    return data


def resolve_output_path(base_dir: Path, asset: dict[str, Any], default_ext: str) -> Path:
    filename = asset.get("filename")
    if filename:
        return base_dir / str(filename)

    name = asset.get("name")
    if not name:
        raise ValueError("Each asset needs either 'filename' or 'name'.")
    return base_dir / f"{name}{default_ext}"


def crop_from_grid(image: Image.Image, cols: int, rows: int, col: int, row: int, margin: int = 0) -> tuple[int, int, int, int]:
    cell_width = image.width / cols
    cell_height = image.height / rows
    left = round(col * cell_width) + margin
    top = round(row * cell_height) + margin
    right = round((col + 1) * cell_width) - margin
    bottom = round((row + 1) * cell_height) - margin
    return left, top, right, bottom


def crop_from_pixels(asset: dict[str, Any]) -> tuple[int, int, int, int]:
    box = asset.get("box")
    if not isinstance(box, list) or len(box) != 4:
        raise ValueError("Pixel crops must provide 'box': [left, top, right, bottom].")
    return tuple(int(value) for value in box)  # type: ignore[return-value]


def normalize_mode(image: Image.Image, output_path: Path) -> Image.Image:
    if output_path.suffix.lower() in {".jpg", ".jpeg"} and image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, "#ffffff")
        background.paste(image, mask=image.getchannel("A"))
        return background
    if output_path.suffix.lower() in {".jpg", ".jpeg"} and image.mode != "RGB":
        return image.convert("RGB")
    return image


def make_background_transparent(image: Image.Image, tolerance: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    sample_points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
    ]
    corner_colors = [pixels[x, y] for x, y in sample_points]
    avg_r = round(sum(color[0] for color in corner_colors) / len(corner_colors))
    avg_g = round(sum(color[1] for color in corner_colors) / len(corner_colors))
    avg_b = round(sum(color[2] for color in corner_colors) / len(corner_colors))

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if (
                abs(r - avg_r) <= tolerance
                and abs(g - avg_g) <= tolerance
                and abs(b - avg_b) <= tolerance
            ):
                pixels[x, y] = (r, g, b, 0)

    return rgba


def make_color_transparent(image: Image.Image, color: tuple[int, int, int], tolerance: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    target_r, target_g, target_b = color

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if (
                abs(r - target_r) <= tolerance
                and abs(g - target_g) <= tolerance
                and abs(b - target_b) <= tolerance
            ):
                pixels[x, y] = (r, g, b, 0)

    return rgba


def is_green_screen_pixel(r: int, g: int, b: int, min_green: int, dominance_ratio: float) -> bool:
    return g >= min_green and g >= int(r * dominance_ratio) and g >= int(b * dominance_ratio)


def make_greenscreen_transparent(
    image: Image.Image,
    min_green: int = 140,
    dominance_ratio: float = 1.25,
) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    visited = set()

    def try_enqueue(x: int, y: int) -> None:
        if (x, y) in visited:
            return
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if a == 0:
            return
        if is_green_screen_pixel(r, g, b, min_green=min_green, dominance_ratio=dominance_ratio):
            queue.append((x, y))

    for x in range(width):
        try_enqueue(x, 0)
        try_enqueue(x, height - 1)
    for y in range(height):
        try_enqueue(0, y)
        try_enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        if x > 0:
            try_enqueue(x - 1, y)
        if x < width - 1:
            try_enqueue(x + 1, y)
        if y > 0:
            try_enqueue(x, y - 1)
        if y < height - 1:
            try_enqueue(x, y + 1)

    return rgba


def export_assets(sheet_path: Path, manifest_path: Path, output_dir: Path) -> list[Path]:
    manifest = load_manifest(manifest_path)
    grid = manifest.get("grid", {})
    cols = int(grid.get("columns", 0))
    rows = int(grid.get("rows", 0))
    margin = int(grid.get("margin", 0))
    transparent_from_corners = bool(manifest.get("makeTransparentFromCorners", False))
    transparency_tolerance = int(manifest.get("transparencyTolerance", 18))
    chroma_key = manifest.get("chromaKey")
    green_screen = bool(manifest.get("greenScreen", False))
    green_screen_min_green = int(manifest.get("greenScreenMinGreen", 140))
    green_screen_dominance_ratio = float(manifest.get("greenScreenDominanceRatio", 1.25))
    assets = manifest.get("assets", [])

    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a non-empty 'assets' array.")

    sheet = Image.open(sheet_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    default_ext = manifest.get("defaultExtension", ".png")
    exported: list[Path] = []

    for asset in assets:
        if not isinstance(asset, dict):
            raise ValueError("Each asset entry must be an object.")

        if "box" in asset:
            crop_box = crop_from_pixels(asset)
        else:
            if cols <= 0 or rows <= 0:
                raise ValueError("Grid crops require positive grid.columns and grid.rows.")
            crop_box = crop_from_grid(
                sheet,
                cols=cols,
                rows=rows,
                col=int(asset["col"]),
                row=int(asset["row"]),
                margin=int(asset.get("margin", margin)),
            )

        cropped = sheet.crop(crop_box)
        output_path = resolve_output_path(output_dir, asset, default_ext)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if transparent_from_corners and output_path.suffix.lower() == ".png":
            cropped = make_background_transparent(
                cropped,
                tolerance=int(asset.get("transparencyTolerance", transparency_tolerance)),
            )
        if chroma_key and output_path.suffix.lower() == ".png":
            if not isinstance(chroma_key, list) or len(chroma_key) != 3:
                raise ValueError("Manifest chromaKey must be [r, g, b].")
            cropped = make_color_transparent(
                cropped,
                color=(int(chroma_key[0]), int(chroma_key[1]), int(chroma_key[2])),
                tolerance=int(asset.get("transparencyTolerance", transparency_tolerance)),
            )
        if green_screen and output_path.suffix.lower() == ".png":
            cropped = make_greenscreen_transparent(
                cropped,
                min_green=int(asset.get("greenScreenMinGreen", green_screen_min_green)),
                dominance_ratio=float(asset.get("greenScreenDominanceRatio", green_screen_dominance_ratio)),
            )
        final_image = normalize_mode(cropped, output_path)
        final_image.save(output_path)
        exported.append(output_path)

    return exported


def main() -> int:
    parser = argparse.ArgumentParser(description="Split a generated UI asset sheet into named files.")
    parser.add_argument("--sheet", required=True, help="Path to the source image sheet.")
    parser.add_argument("--manifest", required=True, help="Path to a JSON manifest describing crops.")
    parser.add_argument("--out", required=True, help="Output directory for exported assets.")
    args = parser.parse_args()

    sheet_path = Path(args.sheet).resolve()
    manifest_path = Path(args.manifest).resolve()
    output_dir = Path(args.out).resolve()

    exported = export_assets(sheet_path, manifest_path, output_dir)
    print(f"Exported {len(exported)} assets:")
    for path in exported:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
