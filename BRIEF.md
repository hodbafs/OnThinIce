# ON THIN ICE — Project Brief & Superpowers Build Plan

## 1. Executive Summary
**On Thin Ice ("WHO DO YOU SEE? — 06 NOV 2026")** is an interactive polar-expedition registration & group-reveal Web Application connected in real-time to Google Sheets (`1H1mOeMVX1mFlmtD_1sYIofmIDL7YIVa1kAxfuxRmcCk`). Participants scan a QR code on the Hero screen, select their name from an A–Z ice-crystal grid (which immediately removes their name for all users), and watch their name fly through a blizzard into their pre-assigned expedition group (`G1`–`G5`).

---

## 2. Information Architecture & 3-Stage User Journey

### Stage 1: Hero Page (`UI 1`)
- **Visual World**: Full-bleed polar expedition scene using `On Thin Ice_Background.png` with multi-layered atmospheric depth (3D parallax response, real-time HTML5 Canvas blizzard snowstorm, frost vignette, and glowing ice cracks).
- **QR Code Registration Hub**: Positioned at the bottom-center of the Hero composition (matching the reference sketch). Generates a live scannable QR code pointing directly to `?page=2` so mobile scanners immediately land on Stage 2.
- **Controls**: Quick-switch navigation bar (`1. HERO`, `2. NAME LIST (39)`, `3. GROUPS (G1-G5)`), QR URL Configurator & Fullscreen QR Modal for the main venue projector, and audio/blizzard intensity feel.

### Stage 2: Name List — 39 Explorers A–Z (`UI 2`)
- **Layout**: 39 participants sorted strictly A–Z (`A` to `Wit`) arranged in a tactile grid of frosted ice-crystal cards (10 columns × 4 rows on desktop widescreen matching the sketch, responsive 2–3 columns on mobile).
- **Live Filtering & Sync**:
  - Displays live remaining count (e.g., `39 / 39 REMAINING`) and a search bar for instant filtering on mobile.
  - Anyone who has already registered is **immediately hidden/removed** from `UI 2` for every user globally.
- **Confirmation & Signature Transition**:
  - Clicking a name opens an **Ice Crystal Confirmation Modal** (*"ยืนยันการลงทะเบียนในชื่อ [Name]?"*) to prevent accidental clicks on a colleague's name.
  - Confirming triggers the **Signature Move ("Glacial Shatter & Group Flight")**: the selected ice card glows, cracks, and launches a glowing ice-shard projectile carrying the participant's name directly into Stage 3 (`UI 3`), locking into their assigned group (`G1`–`G5`).

### Stage 3: Name List by Group — `G1` to `G5` (`UI 3`)
- **Layout**: 5 vertical expedition columns (`G1`, `G2`, `G3`, `G4`, `G5`) side-by-side matching the reference sketch and group color coding:
  - **G1**: Emerald Frost (`#4E8737` / `#6ee7b7`) — 8 members max
  - **G2**: Glacial Azure (`#2B72B5` / `#60a5fa`) — 8 members max
  - **G3**: Amber Aurora (`#BF8F00` / `#fbbf24`) — 8 members max
  - **G4**: Titanium Slate (`#7B7B7B` / `#cbd5e1`) — 8 members max
  - **G5**: Magma Copper (`#C55A11` / `#fb923c`) — 7 members max
- **Real-Time Group Roster**:
  - Displays only registered members in each column (building up live as people check in), with member count badges (`e.g., 3 / 8`).
  - Newly registered user's name animates into their column with an icy shockwave and a `"YOU / NEW"` frost beacon.

---

## 3. Data & Backend Architecture (`Code.gs` + Google Sheets)
- **Spreadsheet ID**: `1H1mOeMVX1mFlmtD_1sYIofmIDL7YIVa1kAxfuxRmcCk`
- **Sheet 1 (`Group`)**:
  - Columns `A, C, E, G, I`: Group 1–5 Member Names
  - Columns `B, D, F, H, J`: Corresponding `Status` cells (`""` when unregistered, `"Registered"` when checked in)
- **Sheet 2 (`Log`)**:
  - Automatically created if missing; records `[Timestamp, Name, Group, Status, Source]` for every check-in.
- **Concurrency Safety**:
  - Uses `LockService.getScriptLock()` in `Code.gs` so simultaneous mobile scans never overwrite each other.
- **Dual-Mode Compatibility**:
  - Works via `fetch()` REST API (`GET ?action=getState`, `POST action=register | reset`) AND native `google.script.run` when embedded in Google Apps Script `HtmlService`.

---

## 4. Staged Execution & Verification Plan (Superpowers)
1. **Stage 1**: Author `Code.gs` with `LockService`, `Group` status reader/writer, `Log` sheet appender, `doGet`/`doPost` JSON endpoints, and `HtmlService` support.
2. **Stage 2**: Build `index.html` with Polar/Blizzard visual engine, 3-screen state machine (`Hero` -> `Name List (39)` -> `Group Columns (G1-G5)`), Confirmation Modal, Flying Name Transition, QR Generator, and Real-Time Sync engine.
3. **Stage 3**: Verify data accuracy (all 39 names + groups), test registration flow, verify responsive desktop & mobile layouts, and write deployment instructions (`SETUP_GUIDE.md`).
