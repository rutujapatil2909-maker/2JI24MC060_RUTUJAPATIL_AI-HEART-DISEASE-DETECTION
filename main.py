
#!/usr/bin/env python3
"""
main.py
Flask REST API server for the 3D Heart Patient Visualization System.

Endpoints:
  POST /api/patient          — Save patient info, create session
  POST /api/upload/<sid>     — Upload MP4, run video analysis
  GET  /api/session/<sid>    — Retrieve session + findings
  GET  /api/health           — Health check

Also serves all static frontend files (HTML/CSS/JS).

Run:
  pip install flask flask-cors opencv-python numpy
  python main.py
"""

import os
import sys
import json
import uuid
import logging
import tempfile
import webbrowser
import threading
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────
MISSING = []
try:
    from flask import Flask, request, jsonify, send_from_directory, send_file
    from flask_cors import CORS
except ImportError:
    MISSING.append("flask flask-cors")

try:
    import cv2
    import numpy as np
except ImportError:
    MISSING.append("opencv-python numpy")

if MISSING:
    print("\n\033[91m✗ Missing dependencies. Install with:\033[0m")
    print(f"  pip install {' '.join(MISSING)}\n")
    sys.exit(1)

# ── Local imports ─────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from backend.analyzer    import VideoAnalyzer
from backend.nlp_parser  import NLPParser
from backend.report      import (
    PatientInfo, PatientSession, AnalysisResult, Finding,
    create_session, get_session, update_session, session_to_response
)

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("HeartServer")

# ── Flask app ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app)

app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB max upload

# ══════════════════════════════════════════════════════════════════════════
#  STATIC FILE SERVING
# ══════════════════════════════════════════════════════════════════════════

@app.route("/")
def serve_index():
    """Serve the patient entry page."""
    return send_from_directory(str(BASE_DIR), "patient.html")

@app.route("/<path:filename>")
def serve_static(filename):
    """Serve any static file (HTML, CSS, JS, assets)."""
    target = BASE_DIR / filename
    if target.is_file():
        return send_from_directory(str(BASE_DIR), filename)
    return jsonify({"error": "Not found"}), 404

# ══════════════════════════════════════════════════════════════════════════
#  API: HEALTH
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "3D Heart Visualization API"})

# ══════════════════════════════════════════════════════════════════════════
#  API: PATIENT
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/patient", methods=["POST"])
def save_patient():
    """
    Create a new session with patient info.
    Body (JSON):
      { name, patient_id, age, gender, report_date }
    Returns:
      { session_id }
    """
    data = request.get_json(force=True)

    required = ["name", "patient_id", "age", "gender", "report_date"]
    missing  = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        patient = PatientInfo(
            name        = str(data["name"]).strip(),
            patient_id  = str(data["patient_id"]).strip(),
            age         = int(data["age"]),
            gender      = str(data["gender"]).strip(),
            report_date = str(data["report_date"]).strip(),
        )
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid data: {e}"}), 400

    session = create_session()
    session.patient = patient
    update_session(session)

    logger.info(f"Patient session created: {session.session_id} — {patient.name}")
    return jsonify({"session_id": session.session_id}), 201

# ══════════════════════════════════════════════════════════════════════════
#  API: VIDEO UPLOAD + ANALYSIS
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/upload/<session_id>", methods=["POST"])
def upload_video(session_id):
    """
    Accept MP4 upload, run video analysis, store findings in session.
    Returns full session data including findings.
    """
    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    if "video" not in request.files:
        return jsonify({"error": "No video file in request (field name: 'video')"}), 400

    video_file = request.files["video"]
    if not video_file.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Validate extension
    ext = Path(video_file.filename).suffix.lower()
    if ext not in (".mp4", ".avi", ".mov", ".mkv"):
        return jsonify({"error": "Unsupported format. Use MP4, AVI, MOV, or MKV."}), 400

    # Save to temp file
    tmp_path = UPLOAD_DIR / f"{session_id}{ext}"
    video_file.save(str(tmp_path))
    session.video_filename = video_file.filename
    logger.info(f"Video saved: {tmp_path} ({tmp_path.stat().st_size // 1024} KB)")

    # Run analysis
    try:
        analyzer = VideoAnalyzer(str(tmp_path), sample_frames=40)
        result   = analyzer.analyze()
    except Exception as e:
        logger.exception("Analysis failed")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
    finally:
        # Clean up uploaded file
        try:
            tmp_path.unlink()
        except Exception:
            pass

    # Store findings
    findings_objs = []
    for f in result.get("findings", []):
        findings_objs.append(Finding(
            structure   = f["structure"],
            category    = f["category"],
            severity    = f["severity"],
            ratio       = f["ratio"],
            color       = f["color"],
            description = f["description"],
            zone        = f.get("zone", {}),
        ))

    session.analysis = AnalysisResult(
        frames_analyzed = result["frames_analyzed"],
        findings        = findings_objs,
        preview_frame   = result.get("preview_frame", ""),
    )
    update_session(session)

    logger.info(f"Analysis complete: {len(findings_objs)} findings for session {session_id}")
    return jsonify(session_to_response(session)), 200

# ══════════════════════════════════════════════════════════════════════════
#  API: NLP REPORT ANALYSIS
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/report/<session_id>", methods=["POST"])
def analyze_report(session_id):
    """
    Accept free-text angiography report, run NLP parsing, store findings.
    Body (JSON):
      { "report_text": "<string>" }
    Returns full session data including findings.
    """
    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404

    data = request.get_json(force=True) or {}
    report_text = data.get("report_text", "")

    if not report_text or not report_text.strip():
        return jsonify({"error": "report_text is required"}), 400

    if len(report_text) > 10000:
        return jsonify({"error": "report_text exceeds maximum length of 10000 characters"}), 400

    try:
        parser   = NLPParser()
        findings = parser.parse(report_text)
        pretty   = parser.pretty_print(findings)
    except Exception as e:
        logger.exception("NLP parsing failed")
        return jsonify({"error": str(e)}), 500

    findings_objs = [
        Finding(
            structure    = f["structure"],
            category     = f["category"],
            severity     = f["severity"],
            ratio        = f["ratio"],
            color        = f["color"],
            description  = f["description"],
            zone         = f.get("zone", {}),
            severity_pct = f.get("severity_pct", 0),
            inferred     = f.get("inferred", False),
            clamped      = f.get("clamped", False),
        )
        for f in findings
    ]

    session.analysis      = AnalysisResult(frames_analyzed=0, findings=findings_objs, preview_frame=None)
    session.source        = "nlp"
    session.report_text   = report_text
    session.pretty_summary = pretty
    update_session(session)

    logger.info(f"NLP analysis complete: {len(findings_objs)} findings for session {session_id}")

    response = session_to_response(session)
    if not findings_objs:
        response["message"] = "No recognizable coronary findings detected in the report text."

    return jsonify(response), 200

# ══════════════════════════════════════════════════════════════════════════
#  API: GET SESSION
# ══════════════════════════════════════════════════════════════════════════

@app.route("/api/session/<session_id>", methods=["GET"])
def get_session_data(session_id):
    """Return full session data for the dashboard."""
    session = get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(session_to_response(session)), 200

# ══════════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════════

def print_banner(port):
    print("\n" + "═"*62)
    print("  🫀  3D Heart Patient Visualization System")
    print("      Backend API + Frontend Server")
    print("═"*62)
    print(f"\n  URL  →  http://localhost:{port}")
    print(f"  API  →  http://localhost:{port}/api/health")
    print("\n  Press Ctrl+C to stop\n")
    print("─"*62 + "\n")

def open_browser(port, delay=1.5):
    """Open browser after a short delay to let Flask start."""
    import time
    time.sleep(delay)
    webbrowser.open(f"http://localhost:{port}")

if __name__ == "__main__":
    PORT = int(os.environ.get("PORT", 5000))
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

    print_banner(PORT)

    # Open browser in background thread
    t = threading.Thread(target=open_browser, args=(PORT,), daemon=True)
    t.start()

    app.run(host="0.0.0.0", port=PORT, debug=DEBUG, use_reloader=False)
