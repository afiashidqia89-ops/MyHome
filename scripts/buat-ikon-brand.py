#!/usr/bin/env python3
# ============================================================
# RumahLayak — Generator ikon & splash brand
# Motif: rumah emas (#D4AF37) + pohon kanopi hijau muda di atas
#        latar hijau sawit (#14532D). Motif dijaga di dalam zona
#        aman ikon adaptif Android (radius ~61% dari tengah).
# Output:
#   assets/icon.png        1024x1024 (sumber ikon launcher APK)
#   assets/splash.png      2732x2732 (splash APK via @capacitor/assets)
#   public/icon-192.png    ikon web/PWA 192 (sudut membulat)
#   public/icon-512.png    ikon web/PWA 512 (sudut membulat)
#   www/icon-192.png       salinan untuk halaman jembatan APK
# ============================================================
import os
import shutil
from PIL import Image, ImageDraw

BASE = "/home/z/my-project"
GREEN = (20, 83, 45, 255)        # #14532D
GREEN_CANOPY = (74, 222, 128, 255)  # #4ADE80
GOLD = (212, 175, 55, 255)       # #D4AF37
GOLD_SOFT = (229, 199, 96, 255)  # varian emas terang (atap)
WHITE = (255, 255, 255, 255)


def draw_motif(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: float) -> None:
    """Gambar motif rumah + pohon. (cx, cy) = titik tengah kanvas, s = skala
    relatif terhadap kanvas 1024px (s=1 berarti koordinat dirancang untuk 1024)."""

    def P(x: float, y: float):
        """Titik desain 1024px (pusat 512,512) -> koordinat kanvas."""
        return (cx + (x - 512) * s, cy + (y - 512) * s)

    def w(v: float) -> float:
        return v * s

    # --- Pohon (kiri): batang putih + kanopi lingkaran hijau muda ---
    # Posisi dijaga agar kanopi tidak menutupi sudut kiri bawah atap.
    trunk_top = P(285, 588)
    trunk_bot = P(285, 764)
    draw.line([trunk_top, trunk_bot], fill=WHITE, width=max(2, int(w(18))))
    canopy = P(285, 498)
    r = w(78)
    draw.ellipse([canopy[0] - r, canopy[1] - r, canopy[0] + r, canopy[1] + r],
                 fill=GREEN_CANOPY)

    # --- Rumah (kanan-tengah): badan emas, atap emas terang, pintu putih ---
    body = [P(396, 520), P(680, 764)]
    draw.rectangle(body, fill=GOLD)

    roof = [P(360, 522), P(538, 390), P(716, 522)]
    draw.polygon(roof, fill=GOLD_SOFT)

    door = [P(508, 640), P(568, 764)]
    draw.rounded_rectangle(door, radius=w(10), fill=WHITE)


def render(size: int, rounded: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), GREEN)
    draw = ImageDraw.Draw(img)
    draw_motif(draw, size // 2, size // 2, size / 1024)
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        img.putalpha(mask)
    return img


def main() -> None:
    os.makedirs(f"{BASE}/assets", exist_ok=True)
    os.makedirs(f"{BASE}/public", exist_ok=True)

    # Ikon launcher APK (kotak penuh — Android yang memotong sesuai mask)
    render(1024, rounded=False).save(f"{BASE}/assets/icon.png")

    # Splash APK: latar polos + motif di tengah (aman terhadap berbagai rasio layar)
    splash = Image.new("RGBA", (2732, 2732), GREEN)
    draw_motif(ImageDraw.Draw(splash), 1366, 1366, 2.1)
    splash.save(f"{BASE}/assets/splash.png")

    # Ikon web / PWA (192 & 512, sudut membulat)
    render(192, rounded=True).save(f"{BASE}/public/icon-192.png")
    render(512, rounded=True).save(f"{BASE}/public/icon-512.png")

    # Salinan kecil untuk halaman jembatan APK (folder www)
    shutil.copy(f"{BASE}/public/icon-192.png", f"{BASE}/www/icon-192.png")

    for p in ["assets/icon.png", "assets/splash.png",
              "public/icon-192.png", "public/icon-512.png", "www/icon-192.png"]:
        im = Image.open(f"{BASE}/{p}")
        print(f"{p}: {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    main()
