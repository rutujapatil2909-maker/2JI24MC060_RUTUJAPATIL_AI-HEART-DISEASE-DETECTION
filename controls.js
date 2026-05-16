/**
 * controls.js
 * Wires up all UI controls: visibility toggles, opacity sliders, mode toggles.
 */

export class UIControls {
  /**
   * @param {object} heartParts  flat { name: mesh }
   * @param {object} animator    BloodFlowAnimator instance
   * @param {object} interaction InteractionManager instance
   * @param {THREE.Scene} scene
   */
  constructor(heartParts, animator, interaction, scene) {
    this.parts       = heartParts;
    this.animator    = animator;
    this.interaction = interaction;
    this.scene       = scene;

    // Category opacity state
    this.opacityState = {
      chambers: 0.55,
      vessels:  0.65,
      valves:   0.80,
      coronary: 0.85,
    };

    this._bindVisibility();
    this._bindOpacity();
    this._bindModes();
  }

  /** Get all meshes belonging to a category */
  _byCategory(cat) {
    return Object.values(this.parts).filter(m => m.userData.category === cat);
  }

  _bindVisibility() {
    const map = {
      'vis-chambers': ['chambers'],
      'vis-vessels':  ['vessels'],
      'vis-valves':   ['valves'],
      'vis-coronary': ['coronary'],
    };
    Object.entries(map).forEach(([id, cats]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        cats.forEach(cat => {
          this._byCategory(cat).forEach(m => { m.visible = el.checked; });
        });
      });
    });
  }

  _bindOpacity() {
    // Global opacity
    const globalSlider = document.getElementById('opacity-global');
    const globalVal    = document.getElementById('opacity-global-val');
    globalSlider.addEventListener('input', () => {
      const v = parseFloat(globalSlider.value);
      globalVal.textContent = v.toFixed(2);
      Object.values(this.parts).forEach(m => {
        m.material.opacity = v;
        m.material.depthWrite = v > 0.9;
      });
    });

    // Per-category sliders
    const cats = ['chambers', 'vessels', 'valves'];
    cats.forEach(cat => {
      const slider = document.getElementById(`opacity-${cat}`);
      const valEl  = document.getElementById(`opacity-${cat}-val`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valEl.textContent = v.toFixed(2);
        this._byCategory(cat).forEach(m => {
          m.material.opacity = v;
          m.material.depthWrite = v > 0.9;
        });
      });
    });
  }

  _bindModes() {
    // Blood flow toggle
    const flowToggle = document.getElementById('toggle-flow');
    flowToggle.addEventListener('change', () => {
      flowToggle.checked ? this.animator.start() : this.animator.stop();
    });

    // Cross-section slice
    const sliceToggle = document.getElementById('toggle-slice');
    const sliceRow    = document.getElementById('slice-row');
    const sliceSlider = document.getElementById('slice-y');
    const sliceVal    = document.getElementById('slice-y-val');

    sliceToggle.addEventListener('change', () => {
      sliceRow.style.display = sliceToggle.checked ? 'flex' : 'none';
      if (!sliceToggle.checked) {
        // Remove clipping
        this.scene.traverse(obj => {
          if (obj.isMesh) obj.material.clippingPlanes = [];
        });
        this.scene.renderer && (this.scene.renderer.localClippingEnabled = false);
      } else {
        this._applySlice(parseFloat(sliceSlider.value));
      }
    });

    sliceSlider.addEventListener('input', () => {
      const v = parseFloat(sliceSlider.value);
      sliceVal.textContent = v.toFixed(2);
      if (sliceToggle.checked) this._applySlice(v);
    });

    // Blockage simulation
    const blockageToggle = document.getElementById('toggle-blockage');
    blockageToggle.addEventListener('change', () => {
      this.interaction.showBlockage(blockageToggle.checked);
    });
  }

  /** Apply a horizontal clipping plane at world Y = sliceY */
  _applySlice(sliceY) {
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), sliceY);
    Object.values(this.parts).forEach(m => {
      m.material.clippingPlanes = [plane];
      m.material.clipShadows    = true;
    });
    // Enable local clipping on renderer (stored reference)
    if (window._heartRenderer) {
      window._heartRenderer.localClippingEnabled = true;
    }
  }
}
