/**
 * dashboard.js
 * Patient-specific 3D heart dashboard controller.
 * Loads session data from API, builds heart, applies disease highlighting
 * ONLY to affected structures, wires all UI controls.
 */

import { buildHeart }         from './heart.js';
import { setupLighting }      from './lighting.js';
import { InteractionManager } from './interaction.js';
import { BloodFlowAnimator }  from './animation.js';
import { exportOBJ, exportSTL, captureScreenshot } from './exporter.js';

const API    = 'http://localhost:5000';
const params = new URLSearchParams(location.search);
const SID    = params.get('sid') || sessionStorage.getItem('session_id') || '';

if (!SID) { window.location.href = 'patient.html'; }

/* ── Scene ── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);

// Subtle floor grid
const grid = new THREE.GridHelper(12, 24, 0x1a2a3a, 0x1a2a3a);
grid.position.y = -2.8;
scene.add(grid);

/* ── Camera ── */
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 0.4, 5.8);

/* ── Renderer ── */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = false;
document.getElementById('canvas-container').appendChild(renderer.domElement);
window._heartRenderer = renderer;

/* ── Orbit controls ── */
const orbit = new THREE.OrbitControls(camera, renderer.domElement);
orbit.enableDamping   = true;
orbit.dampingFactor   = 0.06;
orbit.minDistance     = 1.5;
orbit.maxDistance     = 14;
orbit.autoRotate      = true;
orbit.autoRotateSpeed = 0.6;

/* ── Lighting ── */
setupLighting(scene);

/* ── Progress ── */
const setProgress = pct => {
  document.getElementById('loading-bar').style.width = pct + '%';
};

/* ══════════════════════════════════════════════════════════
   DISEASE APPLICATOR
   Applies color/emissive highlight ONLY to affected structures.
   All other meshes remain at their original medical colors.
   ══════════════════════════════════════════════════════════ */

/**
 * @param {object} parts     flat { name: mesh }
 * @param {Array}  findings  from API: [{ structure, severity, color }]
 */
function applyDiseaseHighlights(parts, findings) {
  if (!findings || findings.length === 0) return;

  // Build lookup: structure name → finding
  const findingMap = {};
  findings.forEach(f => { findingMap[f.structure] = f; });

  Object.values(parts).forEach(mesh => {
    const finding = findingMap[mesh.name];
    if (!finding) return; // untouched — keep original color

    // Store originals for reset
    if (mesh.userData.origColor === undefined) {
      mesh.userData.origColor            = mesh.material.color.getHex();
      mesh.userData.origEmissive         = mesh.material.emissive.getHex();
      mesh.userData.origEmissiveIntensity = mesh.material.emissiveIntensity;
      mesh.userData.origRoughness        = mesh.material.roughness;
      mesh.userData.origClearcoat        = mesh.material.clearcoat || 0;
    }

    // Severity → highlight color (bright, saturated)
    const highlightColors = {
      severe:   new THREE.Color(0xff1a1a),   // bright red
      moderate: new THREE.Color(0xff7700),   // bright orange
      mild:     new THREE.Color(0xffdd00),   // bright yellow
    };
    const emissiveColors = {
      severe:   new THREE.Color(0xff0000),
      moderate: new THREE.Color(0xff5500),
      mild:     new THREE.Color(0xffaa00),
    };
    const intensityMap = { mild: 1.2, moderate: 1.8, severe: 2.5 };

    const hColor = highlightColors[finding.severity] || highlightColors.severe;
    const eColor = emissiveColors[finding.severity]  || emissiveColors.severe;
    const intensity = intensityMap[finding.severity] || 1.5;

    // Apply strong highlight — override color + emissive + reduce clearcoat
    mesh.material.color.set(hColor);
    mesh.material.emissive.set(eColor);
    mesh.material.emissiveIntensity = intensity;
    mesh.material.roughness         = 0.15;   // shinier when diseased
    mesh.material.clearcoat         = 0.0;    // remove clearcoat so emissive shows through
    mesh.material.needsUpdate       = true;

    // Store finding on mesh for click info
    mesh.userData.finding = finding;
  });
}

/* ══════════════════════════════════════════════════════════
   PULSING GLOW ANIMATION for diseased structures
   ══════════════════════════════════════════════════════════ */
function buildGlowAnimator(parts, findings) {
  if (!findings || findings.length === 0) return { update: () => {} };

  const affected = findings.map(f => parts[f.structure]).filter(Boolean);
  const clock    = new THREE.Clock();

  return {
    update() {
      const t = clock.getElapsedTime();
      affected.forEach(mesh => {
        const sev = mesh.userData.finding?.severity || 'mild';
        const base = { mild: 0.8,  moderate: 1.4,  severe: 2.0  }[sev];
        const amp  = { mild: 0.4,  moderate: 0.6,  severe: 0.8  }[sev];
        const freq = { mild: 1.0,  moderate: 1.5,  severe: 2.0  }[sev];
        mesh.material.emissiveIntensity = base + amp * Math.sin(t * freq * Math.PI * 2);
      });
    }
  };
}

/* ══════════════════════════════════════════════════════════
   STENOSIS SCALE
   Narrows vessel meshes radially (X/Z) proportional to severity_pct.
   ══════════════════════════════════════════════════════════ */

/**
 * @param {object} parts     flat { name: mesh }
 * @param {Array}  findings  from API: [{ structure, severity_pct }]
 */
function applyStenosisScale(parts, findings) {
  if (!findings || findings.length === 0) return;
  findings.forEach(f => {
    if ((f.severity_pct || 0) <= 20) return;
    const mesh = parts[f.structure];
    if (!mesh) return;
    // Store originals once
    if (mesh.userData.origScaleX === undefined) {
      mesh.userData.origScaleX = mesh.scale.x;
      mesh.userData.origScaleZ = mesh.scale.z;
    }
    const scale = Math.max(0.30, 1.0 - (f.severity_pct / 100) * 0.7);
    mesh.scale.x = scale;
    mesh.scale.z = scale;
  });
}

/**
 * Restores original X/Z scale stored by applyStenosisScale.
 * @param {object} parts  flat { name: mesh }
 */
function resetStenosisScale(parts) {
  Object.values(parts).forEach(mesh => {
    if (mesh.userData.origScaleX !== undefined) {
      mesh.scale.x = mesh.userData.origScaleX;
      mesh.scale.z = mesh.userData.origScaleZ;
    }
  });
}

/* ══════════════════════════════════════════════════════════
   CAMERA FOCUS
   Smoothly lerps camera.position and orbit.target over durationMs.
   ══════════════════════════════════════════════════════════ */

/**
 * @param {THREE.Camera}        camera
 * @param {THREE.OrbitControls} orbit
 * @param {{x,y,z}}             targetVec  destination camera position
 * @param {number}              durationMs
 */
function focusCamera(camera, orbit, targetVec, durationMs) {
  const startPos    = camera.position.clone();
  const startTarget = orbit.target.clone();
  const endPos      = new THREE.Vector3(targetVec.x, targetVec.y, targetVec.z);
  const endTarget   = new THREE.Vector3(0, 0, 0);
  const startTime   = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / durationMs, 1);
    camera.position.lerpVectors(startPos, endPos, t);
    orbit.target.lerpVectors(startTarget, endTarget, t);
    orbit.update();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ══════════════════════════════════════════════════════════
   EXPLODED VIEW
   Offsets meshes outward from centroid by category; animates back.
   ══════════════════════════════════════════════════════════ */

const EXPLODE_OFFSETS = { chambers: 1.5, coronary: 2.2, valves: 1.8 };
const EXPLODE_DEFAULT = 1.2;

/**
 * @param {object}  parts   flat { name: mesh }
 * @param {boolean} active  true = explode, false = collapse back
 */
function buildExplodedView(parts, active) {
  const meshes = Object.values(parts);

  if (active) {
    meshes.forEach(mesh => {
      // Store original position once
      if (!mesh.userData.origPos) {
        mesh.userData.origPos = mesh.position.clone();
      }
      const offset = EXPLODE_OFFSETS[mesh.userData.category] || EXPLODE_DEFAULT;
      const dir = mesh.userData.origPos.clone().normalize();
      // If mesh is at origin, pick a small default direction
      if (dir.lengthSq() < 0.0001) dir.set(0, 1, 0);
      mesh.position.copy(mesh.userData.origPos).addScaledVector(dir, offset);
    });
  } else {
    // Animate back over 600 ms
    const startPositions = meshes.map(m => m.position.clone());
    const startTime = performance.now();
    function collapse(now) {
      const t = Math.min((now - startTime) / 600, 1);
      meshes.forEach((mesh, i) => {
        if (mesh.userData.origPos) {
          mesh.position.lerpVectors(startPositions[i], mesh.userData.origPos, t);
        }
      });
      if (t < 1) requestAnimationFrame(collapse);
    }
    requestAnimationFrame(collapse);
  }
}

/* ══════════════════════════════════════════════════════════
   FINDINGS PANEL (right panel chips)
   ══════════════════════════════════════════════════════════ */
function buildFindingsPanel(findings, parts, interaction) {
  const container = document.getElementById('findings-list');
  if (!findings || findings.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#2dc653;">&#10003; No abnormalities detected</div>';
    return;
  }

  findings.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'finding-chip';
    chip.innerHTML = `
      <span class="chip-dot" style="background:${f.color}"></span>
      <span class="chip-name">${f.structure}</span>
      <span class="chip-sev sev-${f.severity}">${f.severity.toUpperCase()}</span>
    `;
    chip.addEventListener('click', () => {
      const mesh = parts[f.structure];
      if (mesh) interaction.select(mesh);
      if (f.camera) focusCamera(camera, orbit, f.camera, 800);
    });
    container.appendChild(chip);
  });
}

/* ══════════════════════════════════════════════════════════
   UI CONTROLS WIRING
   ══════════════════════════════════════════════════════════ */
function wireControls(parts, animator, interaction) {

  // Visibility toggles
  const visMap = {
    'vis-wall':     m => m.name === 'Pericardium',
    'vis-chambers': m => m.userData.category === 'chambers' && m.name !== 'Pericardium',
    'vis-vessels':  m => m.userData.category === 'vessels',
    'vis-valves':   m => m.userData.category === 'valves',
    'vis-coronary': m => m.userData.category === 'coronary',
  };
  Object.entries(visMap).forEach(([id, pred]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      Object.values(parts).filter(pred).forEach(m => { m.visible = el.checked; });
    });
  });

  // Opacity sliders
  const opacityMap = {
    'opacity-global':  () => Object.values(parts),
    'opacity-wall':    () => Object.values(parts).filter(m => m.name === 'Pericardium'),
    'opacity-vessels': () => Object.values(parts).filter(m => m.userData.category === 'vessels'),
    'opacity-valves':  () => Object.values(parts).filter(m => m.userData.category === 'valves'),
  };
  Object.entries(opacityMap).forEach(([id, getMeshes]) => {
    const slider = document.getElementById(id);
    const valEl  = document.getElementById(id + '-val');
    if (!slider) return;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      if (valEl) valEl.textContent = v.toFixed(2);
      getMeshes().forEach(m => {
        m.material.opacity   = v;
        m.material.depthWrite = v > 0.95;
      });
    });
  });

  // Auto-rotate
  document.getElementById('toggle-rotate').addEventListener('change', e => {
    orbit.autoRotate = e.target.checked;
  });

  // Exploded view
  const explodeToggle = document.getElementById('toggle-explode');
  if (explodeToggle) {
    explodeToggle.addEventListener('change', e => {
      buildExplodedView(parts, e.target.checked);
    });
  }

  // Blood flow
  document.getElementById('toggle-flow').addEventListener('change', e => {
    e.target.checked ? animator.start() : animator.stop();
  });

  // Cross-section
  const sliceToggle = document.getElementById('toggle-slice');
  const sliceRow    = document.getElementById('slice-row');
  const sliceSlider = document.getElementById('slice-y');
  const sliceVal    = document.getElementById('slice-y-val');

  sliceToggle.addEventListener('change', () => {
    sliceRow.style.display = sliceToggle.checked ? 'flex' : 'none';
    if (!sliceToggle.checked) {
      Object.values(parts).forEach(m => { m.material.clippingPlanes = []; });
      renderer.localClippingEnabled = false;
    } else {
      applySlice(parseFloat(sliceSlider.value));
    }
  });
  sliceSlider.addEventListener('input', () => {
    const v = parseFloat(sliceSlider.value);
    sliceVal.textContent = v.toFixed(2);
    if (sliceToggle.checked) applySlice(v);
  });

  function applySlice(y) {
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), y);
    Object.values(parts).forEach(m => {
      m.material.clippingPlanes = [plane];
      m.material.clipShadows    = true;
    });
    renderer.localClippingEnabled = true;
  }

  // Export buttons
  document.getElementById('btn-reset-camera') &&
    document.getElementById('btn-reset-camera').addEventListener('click', () => {
      camera.position.set(0, 0.4, 5.8);
      orbit.target.set(0, 0, 0);
      orbit.update();
    });

  // Import group reference for export (set after build)
  window._heartGroup = null;
  document.getElementById('btn-export-obj').addEventListener('click', () => {
    if (window._heartGroup) exportOBJ(window._heartGroup);
  });
  document.getElementById('btn-export-stl').addEventListener('click', () => {
    if (window._heartGroup) exportSTL(window._heartGroup);
  });
  document.getElementById('btn-screenshot').addEventListener('click', () => {
    captureScreenshot(renderer, camera, scene, `Patient: ${window._patientName || ''}`);
  });
}

/* ══════════════════════════════════════════════════════════
   INTERACTION: override select to show finding info
   ══════════════════════════════════════════════════════════ */
function patchInteraction(interaction) {
  const origSelect = interaction.select.bind(interaction);
  interaction.select = function(mesh) {
    origSelect(mesh);
    // Update dashboard info panel
    document.getElementById('info-name').textContent = mesh.name;
    document.getElementById('info-desc').textContent = mesh.userData.description || '';

    const finding = mesh.userData.finding;
    const sevEl   = document.getElementById('info-severity');
    if (finding) {
      sevEl.innerHTML = `<span class="sev-badge sev-${finding.severity}">${finding.severity.toUpperCase()}</span>
        <span style="font-size:11px;color:#aaa;margin-left:6px;">${(finding.ratio*100).toFixed(1)}% affected</span>`;
      document.getElementById('info-swatch').style.background = finding.color;
    } else {
      sevEl.innerHTML = '<span style="font-size:11px;color:#2dc653;">&#10003; Normal</span>';
      const hex = '#' + (mesh.userData.originalColor || 0xffffff).toString(16).padStart(6,'0');
      document.getElementById('info-swatch').style.background = hex;
    }
  };
}

/* ══════════════════════════════════════════════════════════
   MAIN INIT
   ══════════════════════════════════════════════════════════ */
async function init() {
  setProgress(10);
  await tick();

  // Load session from API
  let sessionData = null;
  try {
    const res  = await fetch(`${API}/api/session/${SID}`);
    sessionData = await res.json();
    if (!res.ok) throw new Error('session fetch failed');
    // Cache the fresh data
    sessionStorage.setItem('analysis', JSON.stringify(sessionData));
  } catch (e) {
    // Fallback to sessionStorage only if API is completely unreachable
    const cached = sessionStorage.getItem('analysis');
    if (cached) {
      try { sessionData = JSON.parse(cached); } catch(_) {}
    }
  }

  const findings = sessionData?.findings || [];
  const patient  = sessionData?.patient  || {};
  window._patientName = patient.name || '';

  // Show patient info in header
  if (patient.name) {
    document.getElementById('patient-header-info').textContent =
      `${patient.name}  ·  ID: ${patient.patient_id}  ·  Age: ${patient.age}  ·  ${patient.gender}`;
  }

  setProgress(30);
  await tick();

  // Build heart
  const { group, parts } = buildHeart();
  scene.add(group);
  window._heartGroup = group;

  setProgress(55);
  await tick();

  // Apply disease highlights ONLY to affected structures
  applyDiseaseHighlights(parts, findings);
  applyStenosisScale(parts, findings);

  setProgress(70);
  await tick();

  // Glow animator for diseased regions
  const glowAnim = buildGlowAnimator(parts, findings);

  // Blood flow animator
  const flowAnim = new BloodFlowAnimator(scene);

  setProgress(82);
  await tick();

  // Interaction
  const interaction = new InteractionManager(camera, renderer, parts);
  patchInteraction(interaction);

  setProgress(92);
  await tick();

  // Findings panel
  buildFindingsPanel(findings, parts, interaction);

  // Wire all UI controls
  wireControls(parts, flowAnim, interaction);

  setProgress(100);
  await tick();

  // Hide loading
  const loading = document.getElementById('loading');
  loading.classList.add('hidden');
  setTimeout(() => { loading.style.display = 'none'; }, 700);

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    orbit.update();
    flowAnim.update();
    glowAnim.update();
    renderer.render(scene, camera);
  }
  animate();
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function tick() { return new Promise(r => requestAnimationFrame(r)); }

init().catch(console.error);
