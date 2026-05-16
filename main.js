/**
 * main.js
 * Entry point — initializes Three.js scene, builds heart, wires all modules.
 */

import { buildHeart }         from './heart.js';
import { setupLighting }      from './lighting.js';
import { InteractionManager } from './interaction.js';
import { BloodFlowAnimator }  from './animation.js';
import { UIControls }         from './controls.js';
import { exportOBJ, exportSTL, captureScreenshot } from './exporter.js';

/* ── Scene setup ── */
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);

// Subtle grid for depth reference
const grid = new THREE.GridHelper(10, 20, 0x1a1a2e, 0x1a1a2e);
grid.position.y = -2.5;
scene.add(grid);

/* ── Camera ── */
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0.5, 5.5);

/* ── Renderer ── */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = false;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Expose renderer globally for slice control
window._heartRenderer = renderer;

/* ── Orbit controls ── */
const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping    = true;
orbitControls.dampingFactor    = 0.06;
orbitControls.minDistance      = 1.5;
orbitControls.maxDistance      = 12;
orbitControls.autoRotate       = false;
orbitControls.autoRotateSpeed  = 0.5;

/* ── Lighting ── */
setupLighting(scene);

/* ── Progress bar simulation ── */
function setProgress(pct) {
  document.getElementById('loading-bar').style.width = pct + '%';
}

/* ── Build heart (async to allow UI update) ── */
async function init() {
  setProgress(10);
  await tick();

  setProgress(30);
  await tick();

  const { group, parts } = buildHeart();
  scene.add(group);

  setProgress(60);
  await tick();

  /* ── Blood flow animator ── */
  const animator = new BloodFlowAnimator(scene);

  setProgress(75);
  await tick();

  /* ── Interaction ── */
  const interaction = new InteractionManager(camera, renderer, parts);

  setProgress(88);
  await tick();

  /* ── UI controls ── */
  const ui = new UIControls(parts, animator, interaction, scene);

  setProgress(100);
  await tick();

  /* ── Button bindings ── */
  document.getElementById('btn-reset-camera').addEventListener('click', () => {
    camera.position.set(0, 0.5, 5.5);
    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
  });

  document.getElementById('btn-export-obj').addEventListener('click', () => exportOBJ(group));
  document.getElementById('btn-export-stl').addEventListener('click', () => exportSTL(group));
  document.getElementById('btn-screenshot').addEventListener('click', () =>
    captureScreenshot(renderer, camera, scene, new Date().toLocaleString())
  );

  /* ── Hide loading overlay ── */
  const loading = document.getElementById('loading');
  loading.classList.add('hidden');
  setTimeout(() => { loading.style.display = 'none'; }, 700);

  /* ── Render loop ── */
  function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    animator.update();
    renderer.render(scene, camera);
  }
  animate();
}

/* ── Resize handler ── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Yield to browser for one frame */
function tick() {
  return new Promise(r => requestAnimationFrame(r));
}

init().catch(console.error);
