# AeroClean – Stage 1 (UI with sample data)

## Run it
```bash
cd frontend
npm install
npm run dev      # open the URL it prints (usually http://localhost:5173)
```
Needs Node.js 18+. Use the **Public view / Admin view** buttons in the header.
In Admin view, confirm a detection, then switch to Public view: its hotspot appears there.

## What's in it
- `src/sampleData.ts` – generated, clearly-labelled sample detections (5 surveys, 6 areas, 3 community reports).
- `src/hotspots.ts` – groups detections into grid cells (`CELL`, in degrees) and rates severity by detections per survey.
- `src/Admin.tsx` – stats, filters, map, 4 charts, detection review, cleanup status, survey history.
- `src/Public.tsx` – confirmed hotspots only, public stats, community report form.
- `src/MapView.tsx` – Leaflet + OpenStreetMap map and legend. Colour = severity; solid ring = admin-confirmed; dashed ring = AI-detected; purple = community.

## Important accuracy note
Drone GPS is the aircraft's position, not the litter's. Exact object coordinates need altitude, camera angle, field of view and heading. Stage 4 adds that calculation; until then the UI says "approx.".

## Roadmap
- **Stage 2 – Firebase:** create a project, enable Email/Password Auth, Firestore, Storage; add `firebase` to the frontend; roles via custom claims (`admin`, `viewer`); Firestore/Storage rules so the public can only read confirmed hotspots and create community reports.
- **Stage 3 – FastAPI backend:** `POST /api/detections` (API-key or token protected), admin-only review endpoints, hotspot aggregation on the server using the Firebase Admin SDK (service-account key stays on the server only).
- **Stage 4 – YOLO integration:** a small Python script that sends each detection (category, confidence, GPS, timestamp, survey id, image) to the API, plus the camera-geometry projection.
