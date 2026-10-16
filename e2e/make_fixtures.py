"""Generates synthetic test assets (no real people/photos). Run: npm run fixtures"""
import os, random
from PIL import Image, ImageDraw, ImageFont

out = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(out, exist_ok=True)
random.seed(7)

def scene(name, w, h, hue):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):  # vertical gradient sky/floor
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(hue[0]*(1-t)+40*t), int(hue[1]*(1-t)+50*t), int(hue[2]*(1-t)+70*t)))
    # a crowd of "people": circles + rounded bodies, so crops are visually checkable
    n = 14
    for i in range(n):
        cx = int(w * (i + .5) / n); base = int(h * (.62 + random.random() * .3)); s = int(min(w, h) * (.07 + random.random() * .04))
        col = tuple(random.randint(30, 220) for _ in range(3))
        d.rounded_rectangle([cx - s, base - s, cx + s, base + 3 * s], radius=s // 2, fill=col)
        d.ellipse([cx - s * .7, base - 2.1 * s, cx + s * .7, base - .7 * s], fill=(235, 200, 170))
    f = ImageFont.load_default(size=max(24, w // 30))
    d.rectangle([0, 0, w, h], outline=(255, 255, 255), width=max(4, w // 200))
    d.text((w // 40, h // 40), f"{name}  {w}x{h}", fill=(255, 255, 255), font=f)
    d.line([(0, 0), (w, h)], fill=(255, 255, 0), width=max(2, w // 300))  # diagonal reveals stretching
    img.save(os.path.join(out, name), quality=92)

scene("photo1-landscape.jpg", 4000, 3000, (30, 120, 200))
scene("photo2-portrait.jpg", 3000, 4000, (200, 110, 40))
scene("photo3-wide.jpg", 3200, 1400, (60, 160, 110))
scene("photo4-square.png", 1600, 1600, (150, 60, 160))
scene("photo5-landscape.webp", 2400, 1600, (200, 170, 40))
scene("photo6-landscape.jpg", 2000, 1333, (30, 90, 90))
scene("photo7-extra.jpg", 1800, 1200, (90, 90, 90))
scene("tiny.jpg", 320, 240, (120, 120, 120))

# Logos: transparent PNGs with distinct aspect ratios
f = ImageFont.load_default(size=88)
ld = Image.new("RGBA", (900, 220), (0, 0, 0, 0)); d = ImageDraw.Draw(ld)
d.rectangle([0, 20, 40, 200], fill=(240, 123, 0, 255)); d.text((70, 60), "LEADERS DESK", fill=(8, 74, 145, 255), font=f)
ld.save(os.path.join(out, "leadersdesk-logo.png"))
sc = Image.new("RGBA", (420, 420), (0, 0, 0, 0)); d = ImageDraw.Draw(sc)
d.ellipse([10, 10, 410, 410], fill=(120, 20, 40, 255)); d.text((105, 150), "SCHOOL", fill=(255, 255, 255, 255), font=ImageFont.load_default(size=70))
sc.save(os.path.join(out, "school-logo.png"))
open(os.path.join(out, "school-logo.svg"), "w").write('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><rect width="600" height="200" rx="30" fill="#0a7d4b"/><text x="300" y="125" font-size="80" fill="#fff" text-anchor="middle" font-family="sans-serif">ACADEMY</text></svg>')

# Invalid files
open(os.path.join(out, "notes.txt"), "w").write("not an image")
open(os.path.join(out, "corrupt.jpg"), "wb").write(b"\xff\xd8\xff\xe0 this is not a jpeg")
open(os.path.join(out, "doc.pdf"), "wb").write(b"%PDF-1.4 fake")
print("fixtures written to", out)
