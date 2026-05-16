/**
 * materials.js
 * Tissue-realistic Three.js materials matching the Blender reference:
 *   - Muscle tissue: wet glistening myocardium (pink/salmon, subsurface-like)
 *   - Great vessels: oxygenated red / deoxygenated blue-purple
 *   - Coronary vessels: fine bright-red arteries, dark-blue veins
 *   - Valves: translucent ivory with slight sheen
 *
 * Uses MeshPhysicalMaterial with canvas-generated normal + roughness maps
 * to simulate the fibrous, wet surface visible in the reference image.
 */

/* ── Color palette (matches Blender reference) ── */
export const COLOR = {
  myocardium:        0xc8606e,   // warm salmon-pink muscle
  oxygenated:        0xb01828,   // deep arterial red
  oxygenatedLight:   0xd03040,
  deoxygenated:      0x4455aa,   // blue-purple venous
  deoxygenatedLight: 0x5566cc,
  valve:             0xf5ead8,   // ivory translucent
  coronaryArtery:    0xcc2233,   // bright coronary red
  coronaryVein:      0x2a3a88,   // dark coronary blue
  septum:            0xb85868,   // slightly darker muscle
  highlight:         0xffdd44,
};

/* ── Procedural texture helpers ── */

/**
 * Generate a canvas-based normal map simulating fibrous muscle striations.
 * Produces subtle horizontal fiber lines like myocardium under a microscope.
 */
function makeMuscleNormalMap(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base neutral normal (128,128,255)
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // Horizontal fiber striations
  for (let y = 0; y < size; y += 4) {
    const strength = 8 + Math.random() * 10;
    const r = Math.round(128 + strength);
    const g = Math.round(128 - strength * 0.3);
    ctx.strokeStyle = `rgb(${r},${g},255)`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.globalAlpha = 0.25 + Math.random() * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 3);
    ctx.bezierCurveTo(
      size * 0.3, y + (Math.random() - 0.5) * 6,
      size * 0.7, y + (Math.random() - 0.5) * 6,
      size,       y + Math.random() * 3
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Generate a roughness map: mostly smooth (wet) with subtle variation.
 * Bright = rough, dark = smooth/glossy.
 */
function makeMuscleRoughnessMap(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base: medium-low roughness (wet surface)
  ctx.fillStyle = 'rgb(80,80,80)';
  ctx.fillRect(0, 0, size, size);

  // Add subtle variation
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 8;
    const v = Math.round(60 + Math.random() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Generate a vessel normal map: smooth tube with subtle longitudinal ridges.
 */
function makeVesselNormalMap(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // Longitudinal ridges
  for (let x = 0; x < size; x += 6) {
    const strength = 6 + Math.random() * 8;
    ctx.strokeStyle = `rgb(${128 + strength},128,255)`;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  return tex;
}

// Cache textures so they're only generated once
let _muscleNormal = null;
let _muscleRoughness = null;
let _vesselNormal = null;

function getMuscleNormal()    { return _muscleNormal    || (_muscleNormal    = makeMuscleNormalMap()); }
function getMuscleRoughness() { return _muscleRoughness || (_muscleRoughness = makeMuscleRoughnessMap()); }
function getVesselNormal()    { return _vesselNormal    || (_vesselNormal    = makeVesselNormalMap()); }

/* ── Core material factory ── */
export function makeMaterial(color, opacity = 0.55, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.55,          // wet glistening surface
    clearcoatRoughness: 0.15,
    depthWrite: opacity > 0.9,
    ...extra,
  });
}

/* ── Tissue-specific material factories ── */

/** Myocardium: wet glistening muscle with fibrous normal map */
export function chamberMaterial(opacity = 0.88) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.myocardium,
    opacity,
    transparent:        true,
    side:               THREE.DoubleSide,
    roughness:          0.42,
    metalness:          0.0,
    clearcoat:          0.7,          // strong wet sheen
    clearcoatRoughness: 0.12,
    normalMap:          getMuscleNormal(),
    normalScale:        new THREE.Vector2(0.6, 0.6),
    roughnessMap:       getMuscleRoughness(),
    depthWrite:         opacity > 0.9,
    // Fake subsurface: slightly emissive warm undertone
    emissive:           new THREE.Color(0x3a0808),
    emissiveIntensity:  0.06,
  });
}

/** Oxygenated vessels: deep arterial red, smooth and slightly shiny */
export function oxygenatedMaterial(opacity = 0.92) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.oxygenated,
    opacity,
    transparent:        true,
    side:               THREE.DoubleSide,
    roughness:          0.30,
    metalness:          0.0,
    clearcoat:          0.8,
    clearcoatRoughness: 0.10,
    normalMap:          getVesselNormal(),
    normalScale:        new THREE.Vector2(0.4, 0.4),
    depthWrite:         opacity > 0.9,
    emissive:           new THREE.Color(0x1a0000),
    emissiveIntensity:  0.05,
  });
}

/** Deoxygenated vessels: blue-purple, smooth */
export function deoxygenatedMaterial(opacity = 0.92) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.deoxygenated,
    opacity,
    transparent:        true,
    side:               THREE.DoubleSide,
    roughness:          0.32,
    metalness:          0.0,
    clearcoat:          0.75,
    clearcoatRoughness: 0.12,
    normalMap:          getVesselNormal(),
    normalScale:        new THREE.Vector2(0.4, 0.4),
    depthWrite:         opacity > 0.9,
    emissive:           new THREE.Color(0x00000a),
    emissiveIntensity:  0.04,
  });
}

/** Valves: translucent ivory with slight sheen */
export function valveMaterial(opacity = 0.82) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.valve,
    opacity,
    transparent:        true,
    side:               THREE.DoubleSide,
    roughness:          0.25,
    metalness:          0.0,
    clearcoat:          0.9,
    clearcoatRoughness: 0.08,
    transmission:       0.15,   // slight translucency
    depthWrite:         false,
  });
}

/** Coronary arteries: bright red, fine surface detail */
export function coronaryArteryMaterial(opacity = 0.97) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.coronaryArtery,
    opacity,
    transparent:        opacity < 1,
    side:               THREE.DoubleSide,
    roughness:          0.28,
    metalness:          0.0,
    clearcoat:          0.85,
    clearcoatRoughness: 0.08,
    normalMap:          getVesselNormal(),
    normalScale:        new THREE.Vector2(0.3, 0.3),
    depthWrite:         true,
    emissive:           new THREE.Color(0x1a0000),
    emissiveIntensity:  0.08,
  });
}

/** Coronary veins: dark blue, similar to arteries */
export function coronaryVeinMaterial(opacity = 0.97) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.coronaryVein,
    opacity,
    transparent:        opacity < 1,
    side:               THREE.DoubleSide,
    roughness:          0.30,
    metalness:          0.0,
    clearcoat:          0.80,
    clearcoatRoughness: 0.10,
    normalMap:          getVesselNormal(),
    normalScale:        new THREE.Vector2(0.3, 0.3),
    depthWrite:         true,
  });
}

/** Septum: slightly darker muscle tissue */
export function septumMaterial(opacity = 0.85) {
  return new THREE.MeshPhysicalMaterial({
    color:              COLOR.septum,
    opacity,
    transparent:        true,
    side:               THREE.DoubleSide,
    roughness:          0.45,
    metalness:          0.0,
    clearcoat:          0.6,
    clearcoatRoughness: 0.15,
    normalMap:          getMuscleNormal(),
    normalScale:        new THREE.Vector2(0.5, 0.5),
    roughnessMap:       getMuscleRoughness(),
    depthWrite:         opacity > 0.9,
    emissive:           new THREE.Color(0x2a0606),
    emissiveIntensity:  0.05,
  });
}
