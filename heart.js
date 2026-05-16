/**
 * heart.js
 * Procedurally generates all anatomical heart structures as Three.js meshes.
 * Each structure is a separate named mesh with correct anatomical proportions.
 *
 * Coordinate system (approximate, unit = ~1 cm):
 *   +Y = superior (toward head)
 *   -Y = inferior (toward feet / apex)
 *   +X = patient's left (anatomical left)
 *   -X = patient's right
 *   +Z = anterior
 *   -Z = posterior
 */

import {
  chamberMaterial, oxygenatedMaterial, deoxygenatedMaterial,
  valveMaterial, coronaryArteryMaterial, coronaryVeinMaterial,
  septumMaterial, makeMaterial, COLOR
} from './materials.js';

/* ── Utility helpers ── */

/** Lathe geometry helper: rotates a 2-D profile around Y axis */
function lathe(points, segs = 32) {
  const pts = points.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, segs);
}

/** Scaled sphere */
function ellipsoid(rx, ry, rz, ws = 32, hs = 24) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

/** Tube along a CatmullRom curve */
function tube(pts, radius, segs = 64, radSegs = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, radius, radSegs, false);
}

/** Torus (ring / valve annulus) */
function ring(R, r, segs = 32, tSegs = 16) {
  return new THREE.TorusGeometry(R, r, tSegs, segs);
}

/** Cone-like frustum */
function frustum(rTop, rBot, h, segs = 32) {
  return new THREE.CylinderGeometry(rTop, rBot, h, segs, 1, false);
}

/** Merge two geometries (simple concat) */
function merge(geoA, geoB) {
  return THREE.BufferGeometryUtils
    ? THREE.BufferGeometryUtils.mergeBufferGeometries([geoA, geoB])
    : geoA; // fallback – just return first
}

/* ── Mesh factory ── */
function mesh(geometry, material, name, userData = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.userData = { ...userData, originalColor: material.color.getHex() };
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ════════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════════ */

/**
 * Build the complete heart model.
 * Returns { group, parts } where parts is a flat object of named meshes.
 */
export function buildHeart() {
  const group = new THREE.Group();
  group.name = 'Heart';
  const parts = {};

  function add(m, category) {
    m.userData.category = category;
    group.add(m);
    parts[m.name] = m;
  }

  /* ── 1. LEFT VENTRICLE ── thick-walled, conical, dominant chamber */
  {
    const profile = [
      [0.00,  1.10],
      [0.55,  0.90],
      [0.80,  0.50],
      [0.90,  0.00],
      [0.85, -0.50],
      [0.70, -0.90],
      [0.45, -1.30],
      [0.10, -1.60],
      [0.00, -1.65],
    ];
    const outer = lathe(profile, 40);
    const m = mesh(outer, chamberMaterial(), 'Left Ventricle', {
      description: 'The most muscular chamber. Pumps oxygenated blood into the aorta at high pressure, supplying the entire body.',
      color: COLOR.myocardium,
    });
    m.position.set(0.25, -0.1, 0.05);
    add(m, 'chambers');
  }

  /* ── 2. RIGHT VENTRICLE ── crescent-shaped, wraps around LV anteriorly */
  {
    // Approximate as a flattened ellipsoid + anterior bulge
    const g = ellipsoid(0.85, 1.0, 0.55, 36, 24);
    const m = mesh(g, deoxygenatedMaterial(0.55), 'Right Ventricle', {
      description: 'Pumps deoxygenated blood into the pulmonary artery toward the lungs. Thinner walls than the left ventricle.',
      color: COLOR.deoxygenated,
    });
    m.position.set(-0.55, -0.25, 0.35);
    add(m, 'chambers');
  }

  /* ── 3. LEFT ATRIUM ── posterior, superior, receives pulmonary veins */
  {
    const g = ellipsoid(0.70, 0.55, 0.65, 32, 20);
    const m = mesh(g, chamberMaterial(0.50), 'Left Atrium', {
      description: 'Receives oxygenated blood from the four pulmonary veins and passes it to the left ventricle through the mitral valve.',
      color: COLOR.myocardium,
    });
    m.position.set(0.15, 0.85, -0.35);
    add(m, 'chambers');
  }

  /* ── 4. RIGHT ATRIUM ── right side, receives SVC + IVC */
  {
    const g = ellipsoid(0.65, 0.60, 0.60, 32, 20);
    const m = mesh(g, deoxygenatedMaterial(0.50), 'Right Atrium', {
      description: 'Receives deoxygenated blood from the superior and inferior vena cava, then passes it to the right ventricle.',
      color: COLOR.deoxygenated,
    });
    m.position.set(-0.70, 0.75, 0.05);
    add(m, 'chambers');
  }

  /* ── 5. INTERVENTRICULAR SEPTUM ── wall between ventricles */
  {
    const g = new THREE.BoxGeometry(0.12, 1.6, 0.9);
    // Slightly curved – use a thin ellipsoid instead
    const gs = ellipsoid(0.10, 0.85, 0.55, 24, 16);
    const m = mesh(gs, septumMaterial(), 'Interventricular Septum', {
      description: 'Muscular wall separating the left and right ventricles, preventing mixing of oxygenated and deoxygenated blood.',
      color: COLOR.septum,
    });
    m.position.set(-0.12, -0.15, 0.10);
    add(m, 'chambers');
  }

  /* ── 6. AORTA ── ascending + arch + descending */
  {
    const pts = [
      [ 0.30,  0.90,  0.10],
      [ 0.35,  1.30,  0.15],
      [ 0.30,  1.70,  0.10],
      [ 0.10,  1.95,  0.00],
      [-0.20,  2.05, -0.10],
      [-0.50,  1.90, -0.20],
      [-0.65,  1.60, -0.25],
      [-0.70,  1.20, -0.30],
      [-0.72,  0.60, -0.35],
    ];
    const g = tube(pts, 0.175, 60, 14);
    const m = mesh(g, oxygenatedMaterial(0.75), 'Aorta', {
      description: 'The largest artery in the body. Carries oxygenated blood from the left ventricle to the systemic circulation.',
      color: COLOR.oxygenated,
    });
    add(m, 'vessels');
  }

  /* ── 7. PULMONARY ARTERY (trunk + bifurcation) ── */
  {
    // Main trunk
    const trunk = tube([
      [-0.40,  0.55,  0.45],
      [-0.35,  0.90,  0.50],
      [-0.25,  1.20,  0.40],
      [-0.10,  1.45,  0.20],
    ], 0.155, 40, 12);

    // Left branch
    const leftBranch = tube([
      [-0.10,  1.45,  0.20],
      [-0.30,  1.55,  0.05],
      [-0.60,  1.55, -0.10],
      [-0.90,  1.50, -0.20],
    ], 0.10, 30, 10);

    // Right branch
    const rightBranch = tube([
      [-0.10,  1.45,  0.20],
      [ 0.15,  1.50,  0.10],
      [ 0.45,  1.48,  0.00],
      [ 0.75,  1.42, -0.05],
    ], 0.10, 30, 10);

    const mTrunk = mesh(trunk,       deoxygenatedMaterial(0.72), 'Pulmonary Artery', {
      description: 'Carries deoxygenated blood from the right ventricle to the lungs for oxygenation. Unique artery carrying deoxygenated blood.',
      color: COLOR.deoxygenated,
    });
    const mLeft  = mesh(leftBranch,  deoxygenatedMaterial(0.72), 'Left Pulmonary Artery', {
      description: 'Branch of the pulmonary artery supplying the left lung.',
      color: COLOR.deoxygenated,
    });
    const mRight = mesh(rightBranch, deoxygenatedMaterial(0.72), 'Right Pulmonary Artery', {
      description: 'Branch of the pulmonary artery supplying the right lung.',
      color: COLOR.deoxygenated,
    });
    add(mTrunk, 'vessels');
    add(mLeft,  'vessels');
    add(mRight, 'vessels');
  }

  /* ── 8. PULMONARY VEINS (4 veins entering left atrium) ── */
  {
    const veins = [
      { name: 'Right Superior Pulmonary Vein', pts: [[ 0.85, 1.30, -0.10],[ 0.65, 1.10, -0.20],[ 0.45, 0.95, -0.28],[ 0.20, 0.88, -0.35]] },
      { name: 'Right Inferior Pulmonary Vein', pts: [[ 0.80, 0.80, -0.15],[ 0.60, 0.82, -0.25],[ 0.40, 0.83, -0.32],[ 0.20, 0.84, -0.38]] },
      { name: 'Left Superior Pulmonary Vein',  pts: [[-0.50, 1.30, -0.15],[-0.30, 1.10, -0.25],[-0.10, 0.95, -0.32],[ 0.10, 0.88, -0.38]] },
      { name: 'Left Inferior Pulmonary Vein',  pts: [[-0.50, 0.80, -0.20],[-0.30, 0.82, -0.28],[-0.10, 0.83, -0.34],[ 0.10, 0.84, -0.40]] },
    ];
    veins.forEach(v => {
      const g = tube(v.pts, 0.085, 30, 10);
      const m = mesh(g, oxygenatedMaterial(0.70), v.name, {
        description: 'Carries oxygenated blood from the lungs back to the left atrium. Unique veins carrying oxygenated blood.',
        color: COLOR.oxygenated,
      });
      add(m, 'vessels');
    });
  }

  /* ── 9. SUPERIOR VENA CAVA ── */
  {
    const g = tube([
      [-0.68,  2.20,  0.00],
      [-0.68,  1.80,  0.00],
      [-0.69,  1.40,  0.02],
      [-0.70,  1.00,  0.05],
      [-0.70,  0.75,  0.05],
    ], 0.145, 40, 12);
    const m = mesh(g, deoxygenatedMaterial(0.75), 'Superior Vena Cava', {
      description: 'Returns deoxygenated blood from the upper body (head, neck, arms) to the right atrium.',
      color: COLOR.deoxygenated,
    });
    add(m, 'vessels');
  }

  /* ── 10. INFERIOR VENA CAVA ── */
  {
    const g = tube([
      [-0.65, -1.80,  0.00],
      [-0.65, -1.40,  0.02],
      [-0.66, -1.00,  0.04],
      [-0.67, -0.60,  0.05],
      [-0.68,  0.20,  0.05],
      [-0.70,  0.55,  0.05],
    ], 0.155, 40, 12);
    const m = mesh(g, deoxygenatedMaterial(0.75), 'Inferior Vena Cava', {
      description: 'Returns deoxygenated blood from the lower body (abdomen, legs) to the right atrium.',
      color: COLOR.deoxygenated,
    });
    add(m, 'vessels');
  }

  /* ── 11. TRICUSPID VALVE (right AV valve) ── */
  {
    const g = ring(0.30, 0.055, 32, 12);
    const m = mesh(g, valveMaterial(), 'Tricuspid Valve', {
      description: 'Three-leaflet valve between the right atrium and right ventricle. Prevents backflow during ventricular contraction.',
      color: COLOR.valve,
    });
    m.position.set(-0.60, 0.18, 0.20);
    m.rotation.x = Math.PI / 2;
    add(m, 'valves');

    // Leaflets
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const lg = new THREE.PlaneGeometry(0.22, 0.28);
      const lm = mesh(lg, valveMaterial(0.75), `Tricuspid Leaflet ${i+1}`, {
        description: 'Leaflet of the tricuspid valve.',
        color: COLOR.valve,
      });
      lm.position.set(
        -0.60 + Math.cos(angle) * 0.14,
        0.18,
        0.20 + Math.sin(angle) * 0.14
      );
      lm.rotation.x = Math.PI / 2;
      lm.rotation.z = angle;
      add(lm, 'valves');
    }
  }

  /* ── 12. MITRAL VALVE (left AV valve, bicuspid) ── */
  {
    const g = ring(0.28, 0.055, 32, 12);
    const m = mesh(g, valveMaterial(), 'Mitral Valve', {
      description: 'Two-leaflet (bicuspid) valve between the left atrium and left ventricle. Prevents backflow during systole.',
      color: COLOR.valve,
    });
    m.position.set(0.20, 0.22, -0.05);
    m.rotation.x = Math.PI / 2;
    add(m, 'valves');

    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2;
      const lg = new THREE.PlaneGeometry(0.24, 0.30);
      const lm = mesh(lg, valveMaterial(0.75), `Mitral Leaflet ${i+1}`, {
        description: 'Leaflet of the mitral valve.',
        color: COLOR.valve,
      });
      lm.position.set(
        0.20 + Math.cos(angle) * 0.14,
        0.22,
        -0.05 + Math.sin(angle) * 0.14
      );
      lm.rotation.x = Math.PI / 2;
      lm.rotation.z = angle;
      add(lm, 'valves');
    }
  }

  /* ── 13. PULMONARY VALVE ── */
  {
    const g = ring(0.155, 0.045, 32, 12);
    const m = mesh(g, valveMaterial(), 'Pulmonary Valve', {
      description: 'Semilunar valve at the base of the pulmonary artery. Opens during right ventricular systole to allow blood into the pulmonary circulation.',
      color: COLOR.valve,
    });
    m.position.set(-0.38, 0.58, 0.45);
    m.rotation.x = Math.PI / 2.5;
    add(m, 'valves');
  }

  /* ── 14. AORTIC VALVE ── */
  {
    const g = ring(0.165, 0.045, 32, 12);
    const m = mesh(g, valveMaterial(), 'Aortic Valve', {
      description: 'Semilunar valve at the base of the aorta. Opens during left ventricular systole to allow oxygenated blood into the aorta.',
      color: COLOR.valve,
    });
    m.position.set(0.28, 0.88, 0.08);
    m.rotation.x = Math.PI / 2.2;
    add(m, 'valves');
  }

  /* ── 15. CORONARY ARTERIES ── */
  {
    // Left main coronary artery → LAD + LCx
    const lmca = tube([
      [ 0.28,  0.85,  0.18],
      [ 0.20,  0.70,  0.30],
      [ 0.10,  0.55,  0.40],
    ], 0.055, 20, 8);
    add(mesh(lmca, coronaryArteryMaterial(), 'Left Main Coronary Artery', {
      description: 'Short but critical artery branching into the LAD and LCx, supplying most of the left ventricle.',
      color: COLOR.coronaryArtery,
    }), 'coronary');

    // LAD (Left Anterior Descending)
    const lad = tube([
      [ 0.10,  0.55,  0.40],
      [ 0.08,  0.20,  0.50],
      [ 0.05, -0.20,  0.55],
      [ 0.02, -0.60,  0.52],
      [ 0.00, -1.00,  0.45],
      [-0.02, -1.35,  0.35],
      [-0.05, -1.55,  0.20],
    ], 0.045, 40, 8);
    add(mesh(lad, coronaryArteryMaterial(), 'Left Anterior Descending Artery', {
      description: 'Supplies the anterior wall of the left ventricle and interventricular septum. Most commonly blocked in heart attacks.',
      color: COLOR.coronaryArtery,
    }), 'coronary');

    // LCx (Left Circumflex)
    const lcx = tube([
      [ 0.10,  0.55,  0.40],
      [-0.05,  0.50,  0.30],
      [-0.25,  0.40,  0.15],
      [-0.45,  0.30,  0.00],
      [-0.60,  0.15, -0.15],
      [-0.65, -0.10, -0.25],
    ], 0.040, 30, 8);
    add(mesh(lcx, coronaryArteryMaterial(), 'Left Circumflex Artery', {
      description: 'Supplies the lateral and posterior walls of the left ventricle.',
      color: COLOR.coronaryArtery,
    }), 'coronary');

    // RCA (Right Coronary Artery)
    const rca = tube([
      [-0.28,  0.82,  0.12],
      [-0.40,  0.65,  0.25],
      [-0.55,  0.40,  0.30],
      [-0.65,  0.10,  0.25],
      [-0.68, -0.20,  0.15],
      [-0.65, -0.50,  0.00],
      [-0.58, -0.80, -0.15],
      [-0.45, -1.05, -0.25],
      [-0.25, -1.20, -0.30],
    ], 0.045, 40, 8);
    add(mesh(rca, coronaryArteryMaterial(), 'Right Coronary Artery', {
      description: 'Supplies the right atrium, right ventricle, and inferior wall of the left ventricle. Provides the SA and AV nodes.',
      color: COLOR.coronaryArtery,
    }), 'coronary');
  }

  /* ── 16. CORONARY VEINS ── */
  {
    // Great cardiac vein (runs alongside LAD)
    const gcv = tube([
      [ 0.05, -1.40,  0.30],
      [ 0.04, -1.00,  0.38],
      [ 0.03, -0.60,  0.42],
      [ 0.02, -0.20,  0.44],
      [ 0.00,  0.15,  0.38],
      [-0.10,  0.40,  0.25],
      [-0.30,  0.50,  0.10],
      [-0.55,  0.45, -0.05],
      [-0.70,  0.30, -0.20],
      [-0.75,  0.05, -0.30],
    ], 0.038, 40, 8);
    add(mesh(gcv, coronaryVeinMaterial(), 'Great Cardiac Vein', {
      description: 'Largest coronary vein, draining the anterior heart. Runs alongside the LAD and empties into the coronary sinus.',
      color: COLOR.coronaryVein,
    }), 'coronary');

    // Coronary sinus
    const cs = tube([
      [-0.75,  0.05, -0.30],
      [-0.72,  0.20, -0.38],
      [-0.70,  0.40, -0.40],
      [-0.68,  0.55, -0.38],
    ], 0.055, 20, 8);
    add(mesh(cs, coronaryVeinMaterial(), 'Coronary Sinus', {
      description: 'Main venous channel collecting deoxygenated blood from the coronary veins and draining into the right atrium.',
      color: COLOR.coronaryVein,
    }), 'coronary');
  }

  /* ── 17. PERICARDIUM (outer sac, very transparent) ── */
  {
    const g = ellipsoid(1.55, 1.80, 1.40, 40, 30);
    const m = mesh(g, makeMaterial(0xffe0cc, 0.08, { roughness: 0.2, side: THREE.FrontSide }), 'Pericardium', {
      description: 'Double-walled fibrous sac enclosing the heart. Provides protection and reduces friction during heartbeats.',
      color: 0xffe0cc,
    });
    m.position.set(-0.10, 0.00, 0.05);
    add(m, 'chambers');
  }

  /* ── Center the group ── */
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);

  return { group, parts };
}
