"""Make one square 1080x1080 social image per product for the marketing agent.

Instagram only accepts JPEG images between 4:5 and 1.91:1, and many store images
(book covers, phone screenshots) fall outside that. This puts every product image
on a Shell Key navy square with the product name, tagline and logo, so every post
looks branded and every image works on Facebook, Instagram and LinkedIn.

Run after adding or changing products:
    pip install pillow
    python make_social_images.py
Writes assets/img/social/posts/<slug>.jpg
"""
import glob
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "assets", "img", "social", "posts")
LOGO = os.path.join(HERE, "assets", "img", "logo", "ShellKeyWhiteTrace.png")
S = 1080
NAVY_TOP, NAVY_BOT = (11, 33, 68), (5, 10, 22)
WHITE, SOFT, GREEN = (255, 255, 255), (214, 226, 246), (124, 255, 0)


def font(names, size):
    for n in names:
        hits = glob.glob(f"/usr/share/fonts/**/{n}", recursive=True) + glob.glob(
            f"C:/Windows/Fonts/{n}") + glob.glob(f"/Library/Fonts/{n}") + glob.glob(f"/System/Library/Fonts/**/{n}", recursive=True)
        if hits:
            return ImageFont.truetype(hits[0], size)
    return ImageFont.load_default()


BOLD = ["InterDisplay-Bold.otf", "Inter-Bold.otf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
REG = ["Inter-Regular.otf", "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]


def wrap(draw, text, f, width, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=f) <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while draw.textlength(lines[-1] + "…", font=f) > width and " " in lines[-1]:
            lines[-1] = lines[-1].rsplit(" ", 1)[0]
        lines[-1] += "…"
    return lines


def make(p, logo):
    bg = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        t = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOT)))

    # Product image, fitted into the top panel with a soft shadow and rounded corners
    src = Image.open(os.path.join(HERE, p["img"])).convert("RGB")
    box_w, box_h, top = 960, 600, 60
    r = min(box_w / src.width, box_h / src.height)
    w, h = int(src.width * r), int(src.height * r)
    src = src.resize((w, h), Image.LANCZOS)
    x, y = (S - w) // 2, top + (box_h - h) // 2
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=18, fill=255)
    shadow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([x + 6, y + 12, x + w + 6, y + h + 12], radius=22, fill=150)
    bg.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(14)))
    bg.paste(src, (x, y), mask)
    ImageDraw.Draw(bg).rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=18, outline=(255, 255, 255, 60), width=2)

    d = ImageDraw.Draw(bg)
    ty = top + box_h + 44
    ft = font(BOLD, 56)
    for line in wrap(d, p["name"], ft, 960, 2):
        d.text((60, ty), line, font=ft, fill=WHITE)
        ty += 66
    ty += 8
    fs = font(REG, 32)
    for line in wrap(d, p["tagline"], fs, 960, 2):
        d.text((60, ty), line, font=fs, fill=SOFT)
        ty += 42

    # Footer: logo left, call to action right, thin green rule above
    d.line([(60, 960), (S - 60, 960)], fill=GREEN, width=3)
    lh = 66
    lg = logo.resize((int(logo.width * lh / logo.height), lh), Image.LANCZOS)
    bg.paste(lg, (60, 984), lg)
    cta = ("Free demo · " if p.get("demo") else "") + "shellkey.company"
    fc = font(BOLD, 34)
    d.text((S - 60 - d.textlength(cta, font=fc), 996), cta, font=fc, fill=GREEN)
    return bg


def main():
    spec = importlib.util.spec_from_file_location("build_store", os.path.join(HERE, "build_store.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    os.makedirs(OUT, exist_ok=True)
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    for p in m.PRODUCTS:
        import html, re
        q = {"name": html.unescape(re.sub(r"<[^>]+>", "", p["name"])),
             "tagline": html.unescape(re.sub(r"<[^>]+>", "", p.get("tagline", ""))),
             "img": p["img"], "demo": p.get("demo")}
        make(q, logo).save(os.path.join(OUT, p["slug"] + ".jpg"), "JPEG", quality=86, optimize=True, progressive=True)
    print(f"wrote {len(m.PRODUCTS)} images into {OUT}")


if __name__ == "__main__":
    main()
