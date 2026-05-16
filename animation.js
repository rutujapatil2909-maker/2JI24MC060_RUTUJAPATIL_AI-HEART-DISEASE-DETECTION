/**
 * animation.js
 * Blood flow particle animation through heart chambers and vessels.
 * Uses small spheres traveling along predefined paths.
 */

export class BloodFlowAnimator {
  constructor(scene) {
    this.scene    = scene;
    this.active   = false;
    this.particles = [];
    this.clock    = new THREE.Clock();
    this._buildPaths();
    this._createParticles();
  }

  /** Define flow paths: [points[], color, speed] */
  _buildPaths() {
    this.paths = [
      // Deoxygenated: body → SVC → RA → RV → Pulmonary Artery
      {
        pts: [
          [-0.68,  2.00,  0.00],
          [-0.68,  1.40,  0.02],
          [-0.70,  0.75,  0.05],  // SVC → RA
          [-0.60,  0.40,  0.20],  // RA → RV
          [-0.55, -0.25,  0.35],
          [-0.40,  0.55,  0.45],  // RV → PA
          [-0.25,  1.20,  0.40],
          [-0.10,  1.45,  0.20],
        ],
        color: 0x3366cc,
        speed: 0.28,
        count: 8,
      },
      // Oxygenated: Pulmonary veins → LA → LV → Aorta
      {
        pts: [
          [ 0.85,  1.30, -0.10],
          [ 0.45,  0.95, -0.28],
          [ 0.20,  0.88, -0.35],  // PV → LA
          [ 0.15,  0.85, -0.35],
          [ 0.20,  0.22, -0.05],  // LA → LV (mitral)
          [ 0.25, -0.10,  0.05],
          [ 0.25, -0.80,  0.05],  // LV
          [ 0.30,  0.90,  0.10],  // LV → Aorta
          [ 0.35,  1.30,  0.15],
          [ 0.10,  1.95,  0.00],
          [-0.50,  1.90, -0.20],
          [-0.70,  1.20, -0.30],
        ],
        color: 0xcc2233,
        speed: 0.32,
        count: 10,
      },
      // Coronary flow: Aorta → LAD → back
      {
        pts: [
          [ 0.28,  0.85,  0.18],
          [ 0.10,  0.55,  0.40],
          [ 0.05, -0.20,  0.55],
          [ 0.00, -1.00,  0.45],
          [-0.05, -1.55,  0.20],
          [-0.02, -1.00,  0.38],
          [ 0.00, -0.20,  0.44],
          [-0.30,  0.50,  0.10],
          [-0.70,  0.30, -0.20],
        ],
        color: 0xdd3344,
        speed: 0.22,
        count: 6,
      },
    ];

    // Build CatmullRom curves
    this.curves = this.paths.map(p => ({
      curve: new THREE.CatmullRomCurve3(p.pts.map(pt => new THREE.Vector3(...pt))),
      color: p.color,
      speed: p.speed,
      count: p.count,
    }));
  }

  _createParticles() {
    this.curves.forEach(({ curve, color, speed, count }) => {
      for (let i = 0; i < count; i++) {
        const geo = new THREE.SphereGeometry(0.035, 8, 6);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.visible = false;
        this.scene.add(sphere);
        this.particles.push({
          mesh: sphere,
          curve,
          t: i / count,   // stagger start positions
          speed,
        });
      }
    });
  }

  start() {
    this.active = true;
    this.particles.forEach(p => { p.mesh.visible = true; });
  }

  stop() {
    this.active = false;
    this.particles.forEach(p => { p.mesh.visible = false; });
  }

  update() {
    if (!this.active) return;
    const dt = this.clock.getDelta();
    this.particles.forEach(p => {
      p.t = (p.t + p.speed * dt) % 1;
      const pos = p.curve.getPoint(p.t);
      p.mesh.position.copy(pos);
    });
  }
}
