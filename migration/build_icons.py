"""
Build the app icon set from the EFG@Aish mark.

    python migration/build_icons.py

Just the flame, on the brand navy. No wordmark: at 48 pixels on a home screen
two lines of text are a smudge, and the flame is the thing that is actually
recognisable. An icon has to be identifiable at a glance among thirty others,
which is a different job from a logo on a letterhead.

The droplet inside the flame is a hole rather than a filled shape, so on navy
it reads navy -- which is the right result here and is why nothing needs to be
painted into it.
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
    One icon. `background` None means transparent, for the adaptive foreground
    and the splash -- Android and Expo paint the colour behind those themselves.

    pad_ratio is the inset. Android's adaptive icon is cropped to a circle on
    many launchers, so its foreground needs a wide margin or the flame loses
    its tips.
    """
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    flame = flame_only(Image.open(SRC))

    inner = int(size * (1 - pad_ratio * 2))
    scale = inner / max(flame.size)
    flame = flame.resize(
        (max(1, int(flame.width * scale)), max(1, int(flame.height * scale))),
        Image.LANCZOS,
    )
    canvas.alpha_composite(flame, ((size - flame.width) // 2, (size - flame.height) // 2))
    return canvas


def silhouette(size: int) -> Image.Image:
    """
    The status bar icon.

    Android takes only the alpha channel here and paints it white -- colour in
    this file is discarded, whatever it is. So the job is the shape: a flame
    that reads as a flame at 24dp, rather than the generic blob shown when no
    icon is supplied. The droplet stays a hole, which is what keeps it legible
    once it is a silhouette.

    Colour comes from the accent set alongside it, which tints the circle behind
    the icon.
    """
    flame = flame_only(Image.open(SRC))
    inner = int(size * 0.78)
    scale = inner / max(flame.size)
    flame = flame.resize(
        (max(1, int(flame.width * scale)), max(1, int(flame.height * scale))),
        Image.LANCZOS,
    )

    # Every opaque pixel becomes white; the gradient is irrelevant once Android
    # has thrown the colour away, and flattening it here avoids a muddy edge.
    white = Image.new("RGBA", flame.size, (255, 255, 255, 0))
    white.putalpha(flame.split()[3])
    solid = Image.new("RGBA", flame.size, WHITE)
    solid.putalpha(flame.split()[3])

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(solid, ((size - flame.width) // 2, (size - flame.height) // 2))
    return canvas


def circular(size: int, pad_ratio: float) -> Image.Image:
    """
    A round icon, for places that show the favicon as-is.

    A square navy tile inside a browser tab reads as a box with a logo in it.
    Cutting it to a circle makes the icon the shape, rather than the shape being
    whatever container it happens to sit in.
    """
    icon = compose(size, NAVY, pad_ratio)

    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)  # supersampled, so no jaggies

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out


def main():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")

    jobs = [
        # name, size, background, padding
        ("icon.png", 1024, NAVY, 0.14),
        ("adaptive-icon.png", 1024, None, 0.22),
        ("splash-icon.png", 1024, None, 0.16),

    ]
    for name, size, bg, pad in jobs:
        img = compose(size, bg, pad)
        img.save(OUT / name)
        print(f"  {name:<20} {size}x{size}  {'navy' if bg else 'transparent'}")

    # Round, because a browser tab shows it as-is.
    circular(196, 0.14).save(OUT / "favicon.png")
    print(f"  {'favicon.png':<20} 196x196  navy circle")

    # Android's status bar takes the shape and throws the colour away.
    silhouette(96).save(OUT / "notification-icon.png")
    print(f"  {'notification-icon.png':<20} 96x96  white silhouette")

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
