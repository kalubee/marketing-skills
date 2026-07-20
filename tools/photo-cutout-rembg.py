#!/usr/bin/env python3
"""No-background product cutouts via rembg (learned foreground segmentation).

For "cutout" templates — where products float on the panel with no photo box —
this cuts the product out of its studio shot. A trained matting model separates
the object even when the product itself is white and touches a white background
(e.g. a bare mattress on a white floor), the case pure colour-thresholding
cannot solve (see the sharp-only fallback in photo-cutout.js).

Reads a photo_manifest.json (produced by photo-resolve.js), cuts out each
product's `pure` (silo) shot, writes <photos>/<key>_cutout.png trimmed to the
product with a soft edge, and records `cutoutFile` back into the manifest.

Setup (one-time):
    python3 -m venv .venv-rembg && . .venv-rembg/bin/activate
    pip install "rembg[cpu]"          # pulls onnxruntime; u2net model auto-downloads on first run
Usage:
    python photo-cutout-rembg.py --manifest <run>/photo_manifest.json [--model u2net]
"""
import argparse, json, os
from PIL import Image, ImageFilter
from rembg import remove, new_session

PAD = 8          # transparent margin kept around the product
FEATHER = 0.6    # gaussian blur on alpha for a clean anti-aliased edge


def cutout(src, dst, session):
    img = Image.open(src).convert("RGBA")
    # post_process_mask cleans stray specks; no alpha-matting (it can leave a grey halo)
    out = remove(img, session=session, post_process_mask=True)
    a = out.getchannel("A")
    if FEATHER:
        a = a.filter(ImageFilter.GaussianBlur(FEATHER))
    out.putalpha(a)
    bbox = a.getbbox()  # bbox of the opaque region (alpha only)
    if not bbox:
        raise RuntimeError("empty mask")
    l, t, r, b = bbox
    out = out.crop((max(0, l - PAD), max(0, t - PAD), min(out.width, r + PAD), min(out.height, b + PAD)))
    out.save(dst)
    return out.width, out.height


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True, help="photo_manifest.json from photo-resolve.js")
    ap.add_argument("--model", default="u2net", help="rembg model (u2net | isnet-general-use | ...)")
    a = ap.parse_args()

    manifest = json.load(open(a.manifest))
    photos_dir = os.path.join(os.path.dirname(os.path.abspath(a.manifest)), "photos")
    session = new_session(a.model)
    for rec in manifest:
        src = (rec.get("pure") or {}).get("file")
        if not src or not os.path.exists(src):
            print(f"- {rec.get('name')}: no pure shot, skip"); continue
        dst = os.path.join(photos_dir, f"{rec['key']}_cutout.png")
        try:
            w, h = cutout(src, dst, session)
            rec["cutoutFile"] = dst
            rec["cutoutMethod"] = f"rembg:{a.model}"
            print(f"✓ {rec.get('name')}: {w}x{h} -> {os.path.basename(dst)}")
        except Exception as e:
            print(f"✗ {rec.get('name')}: {e}")
    json.dump(manifest, open(a.manifest, "w"), indent=2)
    print("manifest updated (cutoutFile -> rembg outputs)")


if __name__ == "__main__":
    main()
