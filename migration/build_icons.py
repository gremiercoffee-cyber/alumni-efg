"""
Build the app icon set from the EFG@Aish mark.

    python migration/build_icons.py

Takes the flame from assets/efg-aish-logo.png -- just the flame, not the "a" --
and sets "efg / alumni" over it on two lines. Writes every size Expo needs.

The flame's interior is a hole, not a filled shape, so on a white canvas it
reads white -- which is what makes two lines of text work at all on an icon this
small. The hole acts as a label plate and the text sits navy on white, rather
than fighting the gradient behind it.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).parents[1]
SRC = ROOT / "assets" / "efg-aish-logo.png"
OUT = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/poppins/Poppins_700Bold.ttf"

NAVY = (6, 20, 55, 255)
WHITE = (255, 255, 255, 255)


def flame_only(im: Image.Image) -> Image.Image:
    """
    Crop to the flame.

    Found by looking for the first column right of centre where the mark stops
    being navy -- the "a" is solid navy, the flame is not -- rather than a
    hardcoded x, so a re-exported logo of a different size still works.
    """
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    def column_is_navyish(x: int) -> bool:
        navy = 0
        opaque = 0
        for y in range(0, h, 4):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            opaque += 1
            if r < 60 and g < 60 and b < 110:
                navy += 1
        return opaque > 0 and navy / opaque > 0.6

    split = w // 2
    for x in range(w // 2, w):
        if not column_is_navyish(x):
            # Step back over the gap between the two marks.
            split = x
            break

    box = rgba.crop((split, 0, w, h))
    return box.crop(box.getbbox())


def fitted_font(text: str, target_w: int, cap: int) -> ImageFont.FreeTypeFont:
    size = cap
    while size > 8:
        f = ImageFont.truetype(str(FONT), size)
        if f.getbbox(text)[2] - f.getbbox(text)[0] <= target_w:
            return f
        size -= 2
    return ImageFont.truetype(str(FONT), 8)


def compose(size: int, background: tuple | None, pad_ratio: float) -> Image.Image:
    """
    One icon. `background` None means transparent, for the adaptive foreground.

    pad_ratio is the inset: Android's adaptive icon crops to a circle on many
    launchers, so the foreground needs a wide margin or the flame loses its tips.
    """
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    flame = flame_only(Image.open(SRC))

    inner = int(size * (1 - pad_ratio * 2))
    scale = inner / max(flame.size)
    flame = flame.resize(
        (max(1, int(flame.width * scale)), max(1, int(flame.height * scale))),
        Image.LANCZOS,
    )
    fx = (size - flame.width) // 2
    fy = (size - flame.height) // 2
    canvas.alpha_composite(flame, (fx, fy))

    # The droplet inside the flame is a HOLE -- transparent, not white -- so on a
    # navy canvas it reads navy and navy text disappears into it. Find the hole
    # by flooding transparency in from the edges: whatever transparency the flood
    # cannot reach is enclosed by the flame, and that is the droplet.
    a = flame.split()[3]
    w, h = flame.size
    transparent = [[a.getpixel((x, y)) < 40 for x in range(w)] for y in range(h)]

    outside = [[False] * w for _ in range(h)]
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if transparent[y][x]:
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if transparent[y][x]:
                stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or outside[y][x] or not transparent[y][x]:
            continue
        outside[y][x] = True
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

    xs, ys = [], []
    for y in range(0, h, 2):
        row_t, row_o = transparent[y], outside[y]
        for x in range(0, w, 2):
            if row_t[x] and not row_o[x]:
                xs.append(x)
                ys.append(y)

    if xs:
        cx = fx + (min(xs) + max(xs)) // 2
        cy = fy + (min(ys) + max(ys)) // 2
        plate_w = (max(xs) - min(xs)) * 0.80
    else:
        cx, cy, plate_w = size // 2, size // 2, size * 0.40

    # The wordmark, sized so the ROTATED block spans the flame's full width.
    #
    # Sizing the text itself would come out narrow: rotating by 17 degrees makes
    # the bounding box wider than the text, by roughly the block's height times
    # sin(17). So it is rendered at a reference size, rotated, and then scaled to
    # fit -- which lands it on the flame's width exactly rather than by eye.
    ref = 400
    f_top = ImageFont.truetype(str(FONT), int(ref * 0.62))
    f_bot = ImageFont.truetype(str(FONT), int(ref * 0.36))

    lines = [("efg", f_top), ("alumni", f_bot)]
    widths = [f.getbbox(t)[2] - f.getbbox(t)[0] for t, f in lines]
    heights = [f.getbbox(t)[3] - f.getbbox(t)[1] for t, f in lines]
    gap = int(ref * 0.02)
    block_w, block_h = max(widths), sum(heights) + gap

    pad = int(ref * 0.22)
    layer = Image.new("RGBA", (block_w + pad * 2, block_h + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    y = pad
    for (text, font), tw, th in zip(lines, widths, heights):
        bbox = font.getbbox(text)
        ld.text((pad + (block_w - tw) // 2 - bbox[0], y - bbox[1]), text, font=font, fill=NAVY)
        y += th + gap

    # The shadow is what lets the wordmark run past the white droplet and over
    # the gradient without turning to mush.
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 135), (0, 0), layer.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(ref * 0.028))

    stack = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    stack.alpha_composite(shadow, (int(ref * 0.022), int(ref * 0.022)))
    stack.alpha_composite(layer)

    stack = stack.rotate(17, resample=Image.BICUBIC, expand=True)
    stack = stack.crop(stack.getbbox())

    target_w = int(flame.width * 0.97)
    scale_w = target_w / stack.width
    stack = stack.resize(
        (target_w, max(1, int(stack.height * scale_w))), Image.LANCZOS
    )

    canvas.alpha_composite(stack, (cx - stack.width // 2, cy - stack.height // 2))

    return canvas


def main():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")

    jobs = [
        # name, size, background, padding
        ("icon.png", 1024, WHITE, 0.10),
        ("adaptive-icon.png", 1024, None, 0.22),
        ("splash-icon.png", 1024, None, 0.16),
        ("favicon.png", 196, WHITE, 0.06),
    ]
    for name, size, bg, pad in jobs:
        img = compose(size, bg, pad)
        img.save(OUT / name)
        print(f"  {name:<20} {size}x{size}  {'white' if bg else 'transparent'}")

    # A quick contact sheet, to check it reads at the size it will actually be seen.
    sheet = Image.new("RGBA", (560, 200), (10, 16, 32, 255))  # dark, to check edge contrast
    icon = Image.open(OUT / "icon.png")
    x = 24
    for s in (144, 96, 64, 48, 32):
        sheet.alpha_composite(icon.resize((s, s), Image.LANCZOS), (x, 24))
        x += s + 20
    sheet.save(ROOT / "migration/out/icon_preview.png")
    print("  icon_preview.png     contact sheet at 144/96/64/48/32")


if __name__ == "__main__":
    main()
