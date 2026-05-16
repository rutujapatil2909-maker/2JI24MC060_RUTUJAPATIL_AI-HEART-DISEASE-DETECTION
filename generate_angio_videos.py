"""
generate_angio_videos.py
Generates 5 realistic synthetic coronary angiography MP4 videos
that CardioViz 3D can analyze and detect findings from.

Run:  python generate_angio_videos.py
Output: uploads/sample_angio_*.mp4
"""

import cv2
import numpy as np
import os
import math

OUTPUT_DIR = "uploads"
os.makedirs(OUTPUT_DIR, exist_ok=True)

W, H = 512, 512
FPS  = 15
DURATION = 4  # seconds
FRAMES = FPS * DURATION


def make_base_frame():
    """Dark X-ray style background with noise."""
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    noise = np.random.randint(0, 18, (H, W, 3), dtype=np.uint8)
    frame = cv2.add(frame, noise)
    # Vignette
    cx, cy = W // 2, H // 2
    Y, X = np.ogrid[:H, :W]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
    vignette = np.clip(1.0 - dist / (W * 0.65), 0.0, 1.0)
    for c in range(3):
        frame[:, :, c] = (frame[:, :, c] * vignette).astype(np.uint8)
    return frame


def draw_vessel(frame, pts, width, brightness, alpha=1.0):
    """Draw a curved vessel with given brightness (contrast dye simulation)."""
    overlay = frame.copy()
    for i in range(len(pts) - 1):
        p1 = (int(pts[i][0]),   int(pts[i][1]))
        p2 = (int(pts[i+1][0]), int(pts[i+1][1]))
        b  = int(brightness * alpha)
        # Glow halo first
        cv2.line(overlay, p1, p2, (b//3, b//3, b//3), width+6, cv2.LINE_AA)
        cv2.line(overlay, p1, p2, (b, b, b), width, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.9, frame, 0.1, 0, frame)
    return frame


def fill_zone(frame, x0_n, y0_n, x1_n, y1_n, brightness, alpha=1.0):
    """Fill an anatomical zone rectangle to create strong temporal variance signal."""
    x0 = int(x0_n * W); y0 = int(y0_n * H)
    x1 = int(x1_n * W); y1 = int(y1_n * H)
    b = int(brightness * alpha)
    if b > 5:
        overlay = frame.copy()
        cv2.rectangle(overlay, (x0, y0), (x1, y1), (b, b, b), -1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
    return frame


def bezier(p0, p1, p2, p3, n=60):
    """Cubic bezier curve points."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1-t)**3*p0[0] + 3*(1-t)**2*t*p1[0] + 3*(1-t)*t**2*p2[0] + t**3*p3[0]
        y = (1-t)**3*p0[1] + 3*(1-t)**2*t*p1[1] + 3*(1-t)*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts


def dye_wave(frame_idx, total, delay=0.0, speed=1.0):
    """Returns 0.0-1.0 contrast dye fill level for a given frame."""
    t = (frame_idx / total - delay) * speed
    if t < 0:
        return 0.0
    # Sigmoid-like fill then washout
    fill = 1.0 / (1.0 + math.exp(-12 * (t - 0.3)))
    washout = max(0.0, 1.0 - max(0.0, (t - 0.7)) * 3.0)
    return min(fill, 1.0) * washout


def add_stenosis_marker(frame, x, y, severity_pct):
    """Draw a stenosis narrowing marker."""
    col = (0, 0, 200) if severity_pct >= 70 else (0, 120, 220) if severity_pct >= 50 else (0, 200, 220)
    cv2.circle(frame, (int(x), int(y)), 6, col, 2, cv2.LINE_AA)
    label = f"{severity_pct}%"
    cv2.putText(frame, label, (int(x)+8, int(y)-4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, col, 1, cv2.LINE_AA)


def add_watermark(frame, text):
    cv2.putText(frame, text, (8, H - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.30, (140, 140, 140), 1, cv2.LINE_AA)
    cv2.putText(frame, "CardioViz 3D | Synthetic Angiography", (8, 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.28, (100, 100, 100), 1, cv2.LINE_AA)


def write_video(filename, frame_generator):
    path = os.path.join(OUTPUT_DIR, filename)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(path, fourcc, FPS, (W, H))
    for frame in frame_generator():
        out.write(frame)
    out.release()
    size_kb = os.path.getsize(path) // 1024
    print(f"  Created: {path}  ({size_kb} KB)")
    return path


# ═══════════════════════════════════════════════════════════════
#  VIDEO 1 — Triple Vessel Disease (Severe LAD + RCA + LCx)
# ═══════════════════════════════════════════════════════════════
def video1():
    def gen():
        # LAD: center-left, vertical
        lad = bezier((256,120),(248,220),(244,320),(240,420))
        # RCA: left side, curved
        rca = bezier((160,140),(140,220),(145,320),(155,400))
        # LCx: right side, diagonal
        lcx = bezier((280,200),(320,240),(350,290),(370,360))
        # LMCA: short trunk
        lmca = bezier((256,100),(256,120),(256,130),(256,145))

        for fi in range(FRAMES):
            frame = make_base_frame()

            # LMCA — normal, fills first
            alpha_lmca = dye_wave(fi, FRAMES, delay=0.0, speed=1.2)
            draw_vessel(frame, lmca, 5, 200, alpha_lmca)

            # LAD — severe stenosis at proximal (85%) — reduced brightness after stenosis point
            alpha_lad_prox = dye_wave(fi, FRAMES, delay=0.05, speed=1.1)
            alpha_lad_dist = dye_wave(fi, FRAMES, delay=0.25, speed=0.6)  # delayed distal fill
            draw_vessel(frame, lad[:25], 4, 190, alpha_lad_prox)
            draw_vessel(frame, lad[25:], 2, 100, alpha_lad_dist)  # narrowed
            if alpha_lad_prox > 0.3:
                add_stenosis_marker(frame, lad[22][0], lad[22][1], 85)

            # RCA — total occlusion mid (100%) — no distal fill
            alpha_rca = dye_wave(fi, FRAMES, delay=0.08, speed=1.0)
            draw_vessel(frame, rca[:30], 4, 185, alpha_rca)
            # No distal fill (CTO)
            if alpha_rca > 0.3:
                add_stenosis_marker(frame, rca[28][0], rca[28][1], 100)

            # LCx — severe proximal (75%)
            alpha_lcx = dye_wave(fi, FRAMES, delay=0.10, speed=0.9)
            draw_vessel(frame, lcx[:20], 3, 175, alpha_lcx)
            draw_vessel(frame, lcx[20:], 2, 90, dye_wave(fi, FRAMES, delay=0.30, speed=0.5))
            if alpha_lcx > 0.3:
                add_stenosis_marker(frame, lcx[18][0], lcx[18][1], 75)

            add_watermark(frame, "Sample 1 | Triple Vessel Disease | LAD 85% | RCA CTO | LCx 75%")
            yield frame
    return gen


# ═══════════════════════════════════════════════════════════════
#  VIDEO 2 — Mild Non-Obstructive (all vessels patent)
# ═══════════════════════════════════════════════════════════════
def video2():
    def gen():
        lad  = bezier((256,120),(248,220),(244,320),(240,420))
        rca  = bezier((160,140),(140,220),(145,320),(155,400))
        lcx  = bezier((280,200),(320,240),(350,290),(370,360))
        lmca = bezier((256,100),(256,120),(256,130),(256,145))
        om1  = bezier((350,290),(370,310),(385,340),(390,370))

        for fi in range(FRAMES):
            frame = make_base_frame()

            alpha = dye_wave(fi, FRAMES, delay=0.0, speed=1.3)
            draw_vessel(frame, lmca, 5, 210, alpha)
            draw_vessel(frame, lad,  4, 200, dye_wave(fi, FRAMES, delay=0.05, speed=1.2))
            draw_vessel(frame, rca,  4, 195, dye_wave(fi, FRAMES, delay=0.08, speed=1.1))
            draw_vessel(frame, lcx,  3, 185, dye_wave(fi, FRAMES, delay=0.10, speed=1.1))
            draw_vessel(frame, om1,  2, 160, dye_wave(fi, FRAMES, delay=0.15, speed=1.0))

            # Mild markers only
            a = dye_wave(fi, FRAMES, delay=0.05, speed=1.2)
            if a > 0.4:
                add_stenosis_marker(frame, lad[15][0], lad[15][1], 30)
                add_stenosis_marker(frame, rca[12][0], rca[12][1], 35)
                add_stenosis_marker(frame, lcx[10][0], lcx[10][1], 25)

            add_watermark(frame, "Sample 2 | Non-Obstructive CAD | LAD 30% | RCA 35% | LCx 25%")
            yield frame
    return gen


# ═══════════════════════════════════════════════════════════════
#  VIDEO 3 — Critical LAD (Subtotal Occlusion 95%)
# ═══════════════════════════════════════════════════════════════
def video3():
    def gen():
        lad  = bezier((256,120),(248,220),(244,320),(240,420))
        rca  = bezier((160,140),(140,220),(145,320),(155,400))
        lcx  = bezier((280,200),(320,240),(350,290),(370,360))
        lmca = bezier((256,100),(256,120),(256,130),(256,145))

        for fi in range(FRAMES):
            frame = make_base_frame()

            draw_vessel(frame, lmca, 5, 205, dye_wave(fi, FRAMES, delay=0.0, speed=1.2))

            # LAD — subtotal occlusion proximal (95%) — barely any distal fill
            alpha_lad = dye_wave(fi, FRAMES, delay=0.05, speed=1.1)
            draw_vessel(frame, lad[:18], 4, 195, alpha_lad)
            draw_vessel(frame, lad[18:], 1, 40, dye_wave(fi, FRAMES, delay=0.50, speed=0.3))
            if alpha_lad > 0.3:
                add_stenosis_marker(frame, lad[16][0], lad[16][1], 95)

            # RCA — mild
            draw_vessel(frame, rca, 4, 190, dye_wave(fi, FRAMES, delay=0.08, speed=1.1))
            a = dye_wave(fi, FRAMES, delay=0.08, speed=1.1)
            if a > 0.4:
                add_stenosis_marker(frame, rca[10][0], rca[10][1], 30)

            # LCx — mild
            draw_vessel(frame, lcx, 3, 180, dye_wave(fi, FRAMES, delay=0.10, speed=1.0))
            a2 = dye_wave(fi, FRAMES, delay=0.10, speed=1.0)
            if a2 > 0.4:
                add_stenosis_marker(frame, lcx[8][0], lcx[8][1], 20)

            add_watermark(frame, "Sample 3 | Critical LAD | Proximal LAD 95% Subtotal Occlusion")
            yield frame
    return gen


# ═══════════════════════════════════════════════════════════════
#  VIDEO 4 — Left Main + Multivessel
# ═══════════════════════════════════════════════════════════════
def video4():
    def gen():
        lad  = bezier((256,120),(248,220),(244,320),(240,420))
        rca  = bezier((160,140),(140,220),(145,320),(155,400))
        lcx  = bezier((280,200),(320,240),(350,290),(370,360))
        lmca = bezier((256,100),(256,120),(256,130),(256,145))
        d1   = bezier((248,220),(230,250),(215,290),(205,330))

        for fi in range(FRAMES):
            frame = make_base_frame()

            # LMCA — 55% stenosis (significant)
            alpha_lmca = dye_wave(fi, FRAMES, delay=0.0, speed=1.0)
            draw_vessel(frame, lmca[:3], 5, 200, alpha_lmca)
            draw_vessel(frame, lmca[3:], 3, 130, dye_wave(fi, FRAMES, delay=0.15, speed=0.8))
            if alpha_lmca > 0.3:
                add_stenosis_marker(frame, lmca[2][0], lmca[2][1], 55)

            # LAD — severe proximal (80%)
            alpha_lad = dye_wave(fi, FRAMES, delay=0.18, speed=0.9)
            draw_vessel(frame, lad[:20], 4, 180, alpha_lad)
            draw_vessel(frame, lad[20:], 2, 85, dye_wave(fi, FRAMES, delay=0.40, speed=0.5))
            if alpha_lad > 0.3:
                add_stenosis_marker(frame, lad[18][0], lad[18][1], 80)

            # D1 diagonal — 50%
            alpha_d1 = dye_wave(fi, FRAMES, delay=0.22, speed=0.8)
            draw_vessel(frame, d1[:15], 2, 160, alpha_d1)
            draw_vessel(frame, d1[15:], 1, 80, dye_wave(fi, FRAMES, delay=0.40, speed=0.5))
            if alpha_d1 > 0.3:
                add_stenosis_marker(frame, d1[13][0], d1[13][1], 50)

            # LCx — severe proximal (70%)
            alpha_lcx = dye_wave(fi, FRAMES, delay=0.20, speed=0.85)
            draw_vessel(frame, lcx[:18], 3, 175, alpha_lcx)
            draw_vessel(frame, lcx[18:], 2, 90, dye_wave(fi, FRAMES, delay=0.38, speed=0.5))
            if alpha_lcx > 0.3:
                add_stenosis_marker(frame, lcx[16][0], lcx[16][1], 70)

            # RCA — mild (40%)
            draw_vessel(frame, rca, 4, 185, dye_wave(fi, FRAMES, delay=0.08, speed=1.0))
            a = dye_wave(fi, FRAMES, delay=0.08, speed=1.0)
            if a > 0.4:
                add_stenosis_marker(frame, rca[20][0], rca[20][1], 40)

            add_watermark(frame, "Sample 4 | Left Main 55% + LAD 80% + LCx 70% | CABG Indicated")
            yield frame
    return gen


# ═══════════════════════════════════════════════════════════════
#  VIDEO 5 — Mixed Severity + Distal RCA CTO
# ═══════════════════════════════════════════════════════════════
def video5():
    def gen():
        lad  = bezier((256,120),(248,220),(244,320),(240,420))
        rca  = bezier((160,140),(140,220),(145,320),(155,400))
        lcx  = bezier((280,200),(320,240),(350,290),(370,360))
        lmca = bezier((256,100),(256,120),(256,130),(256,145))

        for fi in range(FRAMES):
            frame = make_base_frame()

            draw_vessel(frame, lmca, 5, 205, dye_wave(fi, FRAMES, delay=0.0, speed=1.2))

            # LAD — moderate proximal (65%)
            alpha_lad = dye_wave(fi, FRAMES, delay=0.05, speed=1.0)
            draw_vessel(frame, lad[:22], 4, 185, alpha_lad)
            draw_vessel(frame, lad[22:], 3, 130, dye_wave(fi, FRAMES, delay=0.20, speed=0.75))
            if alpha_lad > 0.3:
                add_stenosis_marker(frame, lad[20][0], lad[20][1], 65)

            # LCx — severe proximal (72%)
            alpha_lcx = dye_wave(fi, FRAMES, delay=0.10, speed=0.9)
            draw_vessel(frame, lcx[:19], 3, 178, alpha_lcx)
            draw_vessel(frame, lcx[19:], 2, 95, dye_wave(fi, FRAMES, delay=0.28, speed=0.55))
            if alpha_lcx > 0.3:
                add_stenosis_marker(frame, lcx[17][0], lcx[17][1], 72)

            # RCA — severe proximal (78%), severe mid (85%), distal CTO (100%)
            alpha_rca = dye_wave(fi, FRAMES, delay=0.08, speed=1.0)
            draw_vessel(frame, rca[:15], 4, 182, alpha_rca)
            draw_vessel(frame, rca[15:35], 3, 110, dye_wave(fi, FRAMES, delay=0.18, speed=0.7))
            # No distal fill (CTO)
            if alpha_rca > 0.3:
                add_stenosis_marker(frame, rca[12][0], rca[12][1], 78)
                add_stenosis_marker(frame, rca[28][0], rca[28][1], 85)
            a2 = dye_wave(fi, FRAMES, delay=0.18, speed=0.7)
            if a2 > 0.3:
                add_stenosis_marker(frame, rca[34][0], rca[34][1], 100)

            add_watermark(frame, "Sample 5 | LAD 65% | LCx 72% | RCA 78-85% + Distal CTO")
            yield frame
    return gen


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\nGenerating synthetic angiography videos...\n")

    videos = [
        ("sample_angio_1_triple_vessel.mp4",   video1()),
        ("sample_angio_2_mild_nonobstructive.mp4", video2()),
        ("sample_angio_3_critical_lad.mp4",    video3()),
        ("sample_angio_4_left_main.mp4",       video4()),
        ("sample_angio_5_mixed_severity.mp4",  video5()),
    ]

    for filename, gen in videos:
        write_video(filename, gen)

    print("\nDone! Upload any of these files at http://localhost:5000")
    print("Go to: Patient form -> Upload page -> Video Upload tab -> select file\n")
