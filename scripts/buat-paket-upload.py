#!/usr/bin/env python3
# ============================================================
# RumahLayak — pembuat paket upload (dijalankan setelah commit)
# Output di /home/z/my-project/download/:
#   rumahlayak-repo-siap-push.zip / .tar.gz  — repo lengkap (git archive)
#   rumahlayak-update-upload.zip             — 17 file yang perlu diupload ke GitHub
#   RumahLayak-DEPLOY.md                     — salinan panduan deployment
# ============================================================
import subprocess
import zipfile
import os
import shutil

BASE = "/home/z/my-project"
DL = f"{BASE}/download"
os.makedirs(DL, exist_ok=True)

# 1) Repo lengkap dari git archive (menjamin isi == commit HEAD)
subprocess.run(["git", "-C", BASE, "archive", "--format=zip", "-o",
                f"{DL}/rumahlayak-repo-siap-push.zip", "HEAD"], check=True)
subprocess.run(["git", "-C", BASE, "archive", "--format=tar.gz", "-o",
                f"{DL}/rumahlayak-repo-siap-push.tar.gz", "HEAD"], check=True)

# 2) Paket mini: file yang harus ada di GitHub agar build APK + branding jalan
MINI_FILES = [
    ".github/workflows/build-apk.yml",
    "scripts/apk/apply-version.mjs",
    "scripts/buat-ikon-brand.py",
    "assets/icon.png",
    "assets/splash.png",
    "capacitor.config.ts",
    "package.json",
    "package-lock.json",
    "www/index.html",
    "www/icon-192.png",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/manifest.webmanifest",
    "public/logo.svg",
    "src/app/layout.tsx",
    "DEPLOY.md",
    "README.md",
]
mini_path = f"{DL}/rumahlayak-update-upload.zip"
old_mini = f"{DL}/rumahlayak-apk-autobuild-upload.zip"
if os.path.exists(old_mini):
    os.remove(old_mini)  # ganti paket mini versi lama
with zipfile.ZipFile(mini_path, "w", zipfile.ZIP_DEFLATED) as z:
    for rel in MINI_FILES:
        src = f"{BASE}/{rel}"
        if not os.path.exists(src):
            raise SystemExit(f"FILE HILANG: {rel}")
        z.write(src, rel)

# 3) Salinan DEPLOY.md terpisah (mudah dibaca tanpa ekstrak)
shutil.copy(f"{BASE}/DEPLOY.md", f"{DL}/RumahLayak-DEPLOY.md")

# Verifikasi
with zipfile.ZipFile(mini_path) as z:
    print(f"paket mini: {len(z.namelist())} file")
    for n in sorted(z.namelist()):
        print(f"  {n} ({z.getinfo(n).file_size} B)")
for f in ["rumahlayak-repo-siap-push.zip", "rumahlayak-repo-siap-push.tar.gz",
          mini_path, "RumahLayak-DEPLOY.md"]:
    print(f"{f}: {os.path.getsize(f'{DL}/{os.path.basename(f)}')} B")
print("OK — paket dibuat dari commit", subprocess.run(
    ["git", "-C", BASE, "rev-parse", "--short", "HEAD"],
    capture_output=True, text=True).stdout.strip())
