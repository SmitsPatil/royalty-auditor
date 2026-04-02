# Digital License Royalty Auditor: Enterprise AI 🚀

A high-performance, multi-agent contract auditing platform built for modern streaming platforms. It automatically compares complex licensing agreements against millions of play logs to identify royalty leakage and contract violations.

---

## 🏗️ Digital License Auditor Stack

*   **Backend**: FastAPI, SQLAlchemy, SQLite (with WAL mode optimization).
*   **Frontend**: React (Vite), Chart.js, Lucide Icons, Vanilla CSS (Glassmorphism design).
*   **Engine**: Multi-Agent "Swarm" Architecture (8 specialized agents).
*   **Dataset**: 1,000+ realistic contracts, 100,000+ streaming play logs.

---

## ⚡ Quick Start: How to Run

### 1. Backend Setup
Navigate to the backend folder, install dependencies, and start the FastAPI server:
```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Generate Data & Seed Database
This script generates 1,000 realistic contracts and 100,000 play logs, then performs the initial audit run:
```powershell
cd backend
python generate_data.py
python reseed_db.py
```
*Wait for the script to finish—it will identify ~3.5% leakage across thousands of violation events.*

### 3. Frontend Setup
Open a new terminal, navigate to the frontend folder, and launch the dashboard:
```powershell
cd frontend
npm install
npm run dev
```
*The dashboard will be available at [http://localhost:5174](http://localhost:5174).*

---

## 🧪 Key Demo Features to Showcase

*   **🔍 Universal Search**: Use the search bar in any tab to filter by Content ID or Studio (e.g., search for "Inception").
*   **🧠 NLQ Chat**: Go to the "AI Capabilities" tab and ask: `"Why was Movie_442 underpaid?"`
*   **🕵️ Violation Checker**: Filter by "Territory" or "Expired" in the Violations tab to show revenue protection.
*   **🎨 Agent Trace**: Show stakeholders exactly how the "Swarm" thinks during a live audit run.

---

## 📂 PRD Compliant Artifacts (Backend folder)
*   `contracts_1000.csv` - Raw contract data.
*   `streaming_logs_100k.csv` - Playback usage ledger.
*   `audit_results.csv` - Final reconciled audit log.
*   `violations.csv` - List of flagged breaches for regulators.
*   `config.json` - System and agent configuration.
