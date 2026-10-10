"""AeroClean backend (Stage 3). Stores data in data.json for now; Stage 2 swaps this for Firebase."""
import base64, json, os, secrets, threading, time, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()
INGEST_KEY, ADMIN_KEY = os.getenv("INGEST_KEY", ""), os.getenv("ADMIN_KEY", "")
if len(INGEST_KEY) < 8 or len(ADMIN_KEY) < 8:
    raise SystemExit("Create backend/.env with INGEST_KEY and ADMIN_KEY (8+ characters each).")
DB, UP, lock = Path("data.json"), Path("uploads"), threading.Lock()
UP.mkdir(exist_ok=True)
COMMUNITY_CATS = ["Plastic", "Glass", "Metal", "Paper", "Organic", "Textile", "General waste"]

def load(): return json.loads(DB.read_text()) if DB.exists() else {"detections": [], "surveys": []}
def save(db): DB.write_text(json.dumps(db))
def ingest_auth(x_api_key: str | None = Header(None)):
    if not secrets.compare_digest(x_api_key or "", INGEST_KEY): raise HTTPException(401, "Bad ingest key")
def admin_auth(x_admin_key: str | None = Header(None)):
    if not secrets.compare_digest(x_admin_key or "", ADMIN_KEY): raise HTTPException(401, "Bad admin key")
def save_image(b64: str | None) -> str:
    if not b64: return ""
    try: raw = base64.b64decode(b64, validate=True)
    except Exception: raise HTTPException(400, "Image is not valid base64")
    jpg, png = raw[:3] == b"\xff\xd8\xff", raw[:8] == b"\x89PNG\r\n\x1a\n"
    if len(raw) > 3_000_000 or not (jpg or png): raise HTTPException(400, "Image must be JPEG/PNG under 3 MB")
    name = f"{uuid.uuid4().hex}.{'jpg' if jpg else 'png'}"
    (UP / name).write_bytes(raw)
    return f"/uploads/{name}"
def category(c: str) -> str: return "General waste" if c.strip().lower() == "waste" else c.strip().title()

class DetIn(BaseModel):
    category: str = Field("waste", max_length=40)
    confidence: float = Field(ge=0, le=1)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    timestamp: datetime | None = None
    survey_id: str = Field(max_length=40)
    area: str = Field("Survey area", max_length=80)
    image_b64: str | None = None
class SurveyIn(BaseModel):
    id: str = Field(max_length=40); date: str = Field(max_length=10); coverage_km2: float = Field(gt=0)
class CommunityIn(BaseModel):
    category: Literal[tuple(COMMUNITY_CATS)]  # type: ignore
    description: str = Field(min_length=1, max_length=1000)
    lat: float = Field(ge=-90, le=90); lng: float = Field(ge=-180, le=180)
    image_b64: str | None = None
class PatchIn(BaseModel):
    source: Literal["ai", "confirmed"] | None = None
    cleanup: Literal["pending", "in_progress", "cleaned"] | None = None

app = FastAPI(title="AeroClean API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def new_det(**kw) -> dict:
    return {"id": uuid.uuid4().hex[:12], "cleanup": "pending", "description": "", **kw}

@app.get("/api/health")
def health(): return {"ok": True}

# --- Called by the YOLO sender (needs INGEST_KEY) ---
@app.post("/api/surveys", dependencies=[Depends(ingest_auth)])
def upsert_survey(s: SurveyIn):
    with lock:
        db = load(); db["surveys"] = [x for x in db["surveys"] if x["id"] != s.id]
        db["surveys"].append({"id": s.id, "date": s.date, "coverageKm2": s.coverage_km2}); save(db)
    return {"ok": True}
@app.post("/api/detections", dependencies=[Depends(ingest_auth)])
def add_detections(items: list[DetIn]):
    if len(items) > 500: raise HTTPException(413, "Max 500 detections per request")
    rows = [new_det(category=category(d.category), confidence=d.confidence, lat=d.lat, lng=d.lng,
            timestamp=(d.timestamp or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat(),
            surveyId=d.survey_id, area=d.area, source="ai", image=save_image(d.image_b64)) for d in items]
    with lock:
        db = load(); db["detections"] += rows; save(db)
    return {"saved": len(rows)}

# --- Admin only (needs ADMIN_KEY) ---
@app.get("/api/detections", dependencies=[Depends(admin_auth)])
def all_detections(): return load()["detections"]
@app.patch("/api/detections/{det_id}", dependencies=[Depends(admin_auth)])
def patch(det_id: str, p: PatchIn):
    with lock:
        db = load()
        for d in db["detections"]:
            if d["id"] == det_id:
                d.update(p.model_dump(exclude_none=True)); save(db); return d
    raise HTTPException(404, "Not found")
@app.delete("/api/detections/{det_id}", dependencies=[Depends(admin_auth)])
def delete(det_id: str):
    with lock:
        db = load(); db["detections"] = [d for d in db["detections"] if d["id"] != det_id]; save(db)
    return {"ok": True}

# --- Public: confirmed + community only; unreviewed AI detections never leave the server ---
@app.get("/api/public/detections")
def public_detections(): return [d for d in load()["detections"] if d["source"] in ("confirmed", "community")]
@app.get("/api/surveys")
def surveys(): return load()["surveys"]
hits: dict[str, list[float]] = {}
@app.post("/api/community")
def community(c: CommunityIn, req: Request):
    ip, now = req.client.host if req.client else "?", time.time()
    recent = [t for t in hits.get(ip, []) if now - t < 3600]
    if len(recent) >= 10: raise HTTPException(429, "Too many reports. Try again later.")
    hits[ip] = recent + [now]
    d = new_det(category=c.category, confidence=0, lat=c.lat, lng=c.lng, timestamp=datetime.now(timezone.utc).isoformat(),
                surveyId="COMMUNITY", area="Community", source="community", image=save_image(c.image_b64), description=c.description)
    with lock:
        db = load(); db["detections"].append(d); save(db)
    return {"ok": True}
