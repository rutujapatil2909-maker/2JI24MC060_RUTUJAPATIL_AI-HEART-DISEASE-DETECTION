/**
 * interaction.js
 * Handles raycasting for click-to-select, hover tooltips, and highlight logic.
 */

import { COLOR, makeMaterial } from './materials.js';

export class InteractionManager {
  constructor(camera, renderer, heartParts) {
    this.camera     = camera;
    this.renderer   = renderer;
    this.parts      = heartParts; // { name: mesh }
    this.raycaster  = new THREE.Raycaster();
    this.mouse      = new THREE.Vector2();
    this.selected   = null;
    this.hovered    = null;

    // Tooltip element
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tooltip';
    document.body.appendChild(this.tooltip);

    // Info panel elements
    this.infoName  = document.getElementById('info-name');
    this.infoDesc  = document.getElementById('info-desc');
    this.infoSwatch = document.getElementById('info-color-swatch');

    this._bindEvents();
  }

  _bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousemove', e => this._onMove(e));
    canvas.addEventListener('click',     e => this._onClick(e));
  }

  _getIntersects(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Object.values(this.parts).filter(m => m.visible);
    return this.raycaster.intersectObjects(meshes, false);
  }

  _onMove(event) {
    const hits = this._getIntersects(event);
    if (hits.length > 0) {
      const m = hits[0].object;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (event.clientX + 14) + 'px';
      this.tooltip.style.top  = (event.clientY - 10) + 'px';
      this.tooltip.textContent = m.name;
      document.body.style.cursor = 'pointer';
    } else {
      this.tooltip.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  }

  _onClick(event) {
    const hits = this._getIntersects(event);
    if (hits.length > 0) {
      const m = hits[0].object;
      this.select(m);
    } else {
      this.deselect();
    }
  }

  select(mesh) {
    // Restore previous selection
    if (this.selected && this.selected !== mesh) {
      this._restoreColor(this.selected);
    }
    this.selected = mesh;
    // Apply highlight
    mesh.material.emissive = new THREE.Color(COLOR.highlight);
    mesh.material.emissiveIntensity = 0.45;

    // Update info panel
    this.infoName.textContent = mesh.name;
    this.infoDesc.textContent = mesh.userData.description || '';
    const hex = '#' + (mesh.userData.color || mesh.userData.originalColor || 0xffffff).toString(16).padStart(6, '0');
    this.infoSwatch.style.background = hex;
  }

  deselect() {
    if (this.selected) {
      this._restoreColor(this.selected);
      this.selected = null;
    }
    this.infoName.textContent = 'Click a structure';
    this.infoDesc.textContent = '';
    this.infoSwatch.style.background = 'transparent';
  }

  _restoreColor(mesh) {
    if (mesh.material.emissive) {
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  /** Highlight blockage simulation on coronary arteries */
  showBlockage(enable) {
    const blockageTargets = ['Left Anterior Descending Artery', 'Right Coronary Artery'];
    Object.values(this.parts).forEach(m => {
      if (blockageTargets.includes(m.name)) {
        if (enable) {
          m.material.emissive = new THREE.Color(0xff8800);
          m.material.emissiveIntensity = 0.7;
          m.material.color.setHex(0xff6600);
        } else {
          m.material.emissive = new THREE.Color(0x000000);
          m.material.emissiveIntensity = 0;
          m.material.color.setHex(m.userData.originalColor || COLOR.coronaryArtery);
        }
      }
    });
  }
}
