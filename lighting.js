/**
 * lighting.js
 * Clinical-cinematic lighting rig matching the Blender reference:
 *   - Strong cool-white key from front-top (surgical lamp feel)
 *   - Warm fill from the left to bring out the salmon muscle tones
 *   - Blue-tinted rim from behind to separate vessels from background
 *   - Soft inner point light to illuminate chamber interiors
 *   - Environment-style hemisphere light for ambient bounce
 */

export function setupLighting(scene) {
  // Hemisphere: sky (cool white) / ground (warm dark) — ambient bounce
  const hemi = new THREE.HemisphereLight(0xddeeff, 0x221108, 0.55);
  scene.add(hemi);

  // Key light — surgical overhead, cool-white, strong
  const key = new THREE.DirectionalLight(0xfaf8ff, 1.6);
  key.position.set(2, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.width  = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 30;
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top   =  5;
  scene.add(key);

  // Fill light — warm left, brings out salmon/pink muscle tones
  const fill = new THREE.DirectionalLight(0xffddcc, 0.65);
  fill.position.set(-5, 2, 2);
  scene.add(fill);

  // Rim light — cool blue from behind, separates vessels from background
  const rim = new THREE.DirectionalLight(0x8899cc, 0.50);
  rim.position.set(0, -2, -6);
  scene.add(rim);

  // Secondary rim — right side highlight for vessel sheen
  const rim2 = new THREE.DirectionalLight(0xffeeff, 0.30);
  rim2.position.set(5, 1, -3);
  scene.add(rim2);

  // Inner point — illuminates chamber interiors with warm blood-red glow
  const inner = new THREE.PointLight(0xff4444, 0.55, 5);
  inner.position.set(0, 0, 0);
  scene.add(inner);

  return { hemi, key, fill, rim, rim2, inner };
}
