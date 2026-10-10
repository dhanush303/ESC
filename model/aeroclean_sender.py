"""Runs the YOLO model on photos and sends detections to the AeroClean backend."""
import argparse, base64, sys
from datetime import date, datetime
from pathlib import Path
import cv2, requests
from PIL import Image
from ultralytics import YOLO

ap = argparse.ArgumentParser()
ap.add_argument("--key", required=True, help="INGEST_KEY from backend/.env")
ap.add_argument("--survey", required=True, help="survey id, e.g. S1")
ap.add_argument("--coverage", type=float, required=True, help="area flown, km2 (estimate)")
ap.add_argument("--area", default="Survey area")
ap.add_argument("--folder", default="photos")
ap.add_argument("--model", default="best.pt")
ap.add_argument("--conf", type=float, default=0.35)
ap.add_argument("--lat", type=float, help="fallback if a photo has no GPS")
ap.add_argument("--lng", type=float)
ap.add_argument("--url", default="http://localhost:8000")
a = ap.parse_args()

def post(path, payload):
    r = requests.post(a.url + path, headers={"X-Api-Key": a.key}, json=payload)
    if not r.ok: sys.exit(f"Backend said {r.status_code}: {r.text}")

def gps_and_time(path):
    ex = Image.open(path).getexif(); gps = ex.get_ifd(0x8825); lat = lng = None
    if 2 in gps and 4 in gps:
        f = lambda v, ref: (-1 if ref in ("S", "W") else 1) * (float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600)
        lat, lng = f(gps[2], gps[1]), f(gps[4], gps[3])
    try: ts = datetime.strptime(ex.get_ifd(0x8769).get(36867) or ex.get(306), "%Y:%m:%d %H:%M:%S")
    except Exception: ts = datetime.now()
    return lat, lng, ts

files = sorted(p for p in Path(a.folder).glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
if not files: sys.exit(f"No photos found in folder '{a.folder}'")
model = YOLO(a.model)
post("/api/surveys", {"id": a.survey, "date": str(date.today()), "coverage_km2": a.coverage})
batch = []
for p in files:
    lat, lng, ts = gps_and_time(p)
    if lat is None: lat, lng = a.lat, a.lng
    if lat is None:
        print(f"SKIP {p.name}: no GPS in the photo and no --lat/--lng given"); continue
    res = model(str(p), conf=a.conf, verbose=False)[0]
    img = res.orig_img; h, w = img.shape[:2]
    for b in res.boxes:
        x1, y1, x2, y2 = [int(v) for v in b.xyxy[0]]; px, py = int((x2 - x1) * .2), int((y2 - y1) * .2)
        crop = img[max(0, y1 - py):min(h, y2 + py), max(0, x1 - px):min(w, x2 + px)]
        if max(crop.shape[:2]) > 400: crop = cv2.resize(crop, None, fx=400 / max(crop.shape[:2]), fy=400 / max(crop.shape[:2]))
        batch.append({"category": res.names[int(b.cls)], "confidence": round(float(b.conf), 3), "lat": lat, "lng": lng,
                      "timestamp": ts.isoformat(), "survey_id": a.survey, "area": a.area,
                      "image_b64": base64.b64encode(cv2.imencode(".jpg", crop)[1]).decode()})
    print(f"{p.name}: {len(res.boxes)} detections at {lat:.5f}, {lng:.5f}")
for i in range(0, len(batch), 50): post("/api/detections", batch[i:i + 50])
print(f"Sent {len(batch)} detections. NOTE: positions are the drone's/camera's GPS, not exact object positions.")
