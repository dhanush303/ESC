# AeroClean

AI-powered drone trash detection and hotspot mapping.

A drone photographs an area, a YOLO model finds waste in the images, and AeroClean turns the detections into a map of hotspots. Administrators review the detections. The public sees only what has been confirmed.

> **Status: working prototype.** The full chain runs locally (model → backend → dashboard). Firebase login and storage are not built yet. See [Roadmap](#roadmap).

---

## Features

**Admin view** (for the team)
- Summary stats: detections, hotspots, critical hotspots, area surveyed, awaiting review
- Filters: survey, area, waste category, severity, source
- Map with severity-coloured hotspot markers and a legend
- Charts: waste composition (pie), categories by cleanup status (bar), hotspot severity (bar), trend across surveys (line)
- Detection table with cropped image, confidence, coordinates, time and source
- Review tools: Confirm, Reject, and cleanup status (pending / in progress / cleaned)
- Survey history

**Public view** (simple, read-only)
- Map of admin-confirmed hotspots only
- Public statistics and charts
- Hotspot details: last survey date and cleanup status
- Community report form (photo, location, category, description)
- Clear labels for **AI-detected**, **admin-confirmed** and **community-reported** waste

**Data pipeline**
- `aeroclean_sender.py`: runs the model on photos, reads GPS from the photo, sends detections
- `aeroclean_video.py`: tracks objects across video frames so each item is counted once; works on recorded video and live streams

---

## How it fits together

```
 Drone photos / video
         |
         v
 YOLO model + sender script  --(INGEST_KEY)-->  FastAPI backend  <--(ADMIN_KEY)--  Admin view
                                                      |
                                                      +--> /api/public/*  -->  Public view
                                                           (confirmed + community only)
```

Hotspots are made in the frontend by grouping detections into geographic grid cells (`CELL` in `frontend/src/hotspots.ts`, about 330 m). Severity is based on detections per survey in a cell.

---

## Project structure

```
aeroclean/
├── backend/
│   ├── main.py                 FastAPI app
│   ├── requirements.txt
│   └── .env.example            copy to .env and set your own keys
├── frontend/
│   ├── src/
│   │   ├── Admin.tsx           admin dashboard
│   │   ├── Public.tsx          public view
│   │   ├── MapView.tsx         Leaflet map and legend
│   │   ├── hotspots.ts         grid-cell hotspot aggregation
│   │   ├── api.ts              backend calls
│   │   ├── sampleData.ts       generated sample data (clearly labelled)
│   │   ├── types.ts
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts          proxies /api and /uploads to the backend
└── model/
    ├── aeroclean_sender.py     photos -> detections -> backend
    └── aeroclean_video.py      video / live stream -> tracked detections -> backend
```

Model weights (`best.pt`, `best.onnx`) are **not** in the repository. Get them from the model team and place them next to the scripts.

---

## Requirements

- Python 3.10+
- Node.js 18+ (LTS)
- Git

---

## Run it locally

These commands are for Windows PowerShell. Put quotes around any path that contains a space.

### 1. Frontend only (sample data, no backend needed)

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. A banner shows that sample data is in use. Use this for UI work.

### 2. Backend

```powershell
cd backend
py -m pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Set two different secrets of at least 8 characters:

```
INGEST_KEY=your-own-secret-for-the-model
ADMIN_KEY=your-own-secret-for-the-admin-screen
```

Start the server:

```powershell
py -m uvicorn main:app --port 8000
```

API docs: `http://localhost:8000/docs`

With the backend running, refresh the frontend. The banner changes to "Live data from the AeroClean backend". Admin view asks for the `ADMIN_KEY` once.

### 3. Send detections from the model

Install the model libraries once:

```powershell
py -m pip install ultralytics opencv-python onnxruntime
```

**Photos** (put images in a `photos` folder):

```powershell
cd model
py aeroclean_sender.py --key YOUR_INGEST_KEY --survey S1 --coverage 0.5 --area "Test area" --lat LAT --lng LNG
```

`--lat` and `--lng` are only used for photos that have no GPS inside them.

**Video or live stream:**

```powershell
py aeroclean_video.py --video video.mp4 --key YOUR_INGEST_KEY --survey V1 --coverage 0.5 --srt video.srt --show
py aeroclean_video.py --video "http://PHONE_IP:8080/video" --key YOUR_INGEST_KEY --survey L1 --coverage 0.5 --lat LAT --lng LNG --show
```

- `--srt` reads GPS from a DJI `.SRT` file. Without it, give a fixed `--lat` and `--lng`.
- `--conf` raises the confidence threshold (for example `0.55`) to cut false detections.
- `--min-frames` ignores objects seen in too few frames.

Then click **Refresh** in the app and open **Admin view**.

---

## API

| Endpoint | Who can call it | Purpose |
|---|---|---|
| `POST /api/detections` | model (`X-Api-Key`) | add detections |
| `POST /api/surveys` | model (`X-Api-Key`) | register a survey and its coverage |
| `GET /api/detections` | admin (`X-Admin-Key`) | all detections |
| `PATCH /api/detections/{id}` | admin | confirm, or set cleanup status |
| `DELETE /api/detections/{id}` | admin | reject a detection |
| `GET /api/public/detections` | anyone | confirmed and community detections only |
| `GET /api/surveys` | anyone | survey list |
| `POST /api/community` | anyone (rate limited) | community report |
| `GET /api/health` | anyone | health check |

Unreviewed AI detections are never returned by a public endpoint.

---

## Security

- Secrets live in `backend/.env`, which is ignored by Git. **Never commit it.**
- Two separate keys: one for the model, one for admin actions.
- Uploaded images are checked for type and size (JPEG or PNG, up to 3 MB).
- Community reports are rate limited per IP.
- **The admin key typed into the browser is temporary.** Real accounts and roles come with Firebase (Stage 2). Do not expose this prototype to the public internet before then.

---

## Known limitations

- **Locations are approximate.** A detection gets the drone's or photo's GPS position, not the object's true position. Exact positions need camera geometry and flight telemetry (altitude, angle, heading).
- **Single waste class.** The current model labels everything "waste", shown as "General waste". Categories need a retrained model.
- **False detections.** The model appears to be trained on drone-style (top-down) images, so ground-level views produce mistakes. Test with drone footage, and tune `--conf`.
- **Live GPS** from a moving drone is not supported yet. Live streams use one fixed position.
- **Duplicate objects** can occur if the tracker loses and re-finds an object.
- **Data is stored in a local file** (`backend/data.json`) and images in `backend/uploads/`.
- **Community reports** cannot be reviewed in the admin view yet.
- The dashboard updates when you press **Refresh**.

---

## Roadmap

1. **Firebase (Stage 2):** Authentication with admin and viewer roles, Firestore for records, Storage for images, security rules so the public can only read confirmed data.
2. **Model quality:** retrain with categories and background (no-trash) images; test on real drone footage.
3. **Exact positions:** project detections to ground coordinates using camera geometry and telemetry.
4. **Live drone GPS:** MAVLink or the drone SDK, depending on the drone.
5. **Admin extras:** community report review, date-range filters, photo upload from the site, automatic refresh.
6. **Deployment:** hosting for the site and backend, and a final security review.

---

## Working on the project

- Never commit `.env`, `backend/data.json`, `backend/uploads/`, `node_modules/` or model weights.
- If you change the detection fields, update `backend/main.py`, `frontend/src/types.ts` and the sender scripts together.
- UI-only work needs just the frontend and the sample data.

---

## Data note

The sample data in `frontend/src/sampleData.ts` is generated for development and is not real measurement data.
