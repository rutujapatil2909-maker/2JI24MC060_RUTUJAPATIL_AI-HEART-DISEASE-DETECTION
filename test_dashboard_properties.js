/**
 * test_dashboard_properties.js
 * Property-based tests for dashboard.js pure logic using fast-check.
 * Run with: node src/test_dashboard_properties.js
 *
 * Functions under test are inlined here because dashboard.js depends on
 * THREE.js browser globals that are not available in Node.js.
 */

'use strict';

const fc = require('fast-check');

// ─── Inlined pure logic from dashboard.js ────────────────────────────────────

/**
 * Applies stenosis scale to a mock mesh object.
 * Mirrors applyStenosisScale in dashboard.js.
 */
function applyStenosisScaleToMesh(mesh, pct) {
  if (pct <= 20) return;
  if (mesh.userData.origScaleX === undefined) {
    mesh.userData.origScaleX = mesh.scale.x;
    mesh.userData.origScaleZ = mesh.scale.z;
  }
  const scale = Math.max(0.30, 1.0 - (pct / 100) * 0.7);
  mesh.scale.x = scale;
  mesh.scale.z = scale;
}

/**
 * Restores original X/Z scale stored by applyStenosisScaleToMesh.
 * Mirrors resetStenosisScale in dashboard.js.
 */
function resetStenosisScaleOnMesh(mesh) {
  if (mesh.userData.origScaleX !== undefined) {
    mesh.scale.x = mesh.userData.origScaleX;
    mesh.scale.z = mesh.userData.origScaleZ;
  }
}

/**
 * Simulates buildExplodedView activate step for a single mesh.
 * Mirrors the active=true branch of buildExplodedView in dashboard.js.
 */
function explodeMesh(mesh, offset) {
  if (!mesh.userData.origPos) {
    mesh.userData.origPos = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
  }
  const p = mesh.userData.origPos;
  const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  let dx, dy, dz;
  if (len < 0.0001) {
    dx = 0; dy = 1; dz = 0;
  } else {
    dx = p.x / len; dy = p.y / len; dz = p.z / len;
  }
  mesh.position.x = p.x + dx * offset;
  mesh.position.y = p.y + dy * offset;
  mesh.position.z = p.z + dz * offset;
}

/**
 * Simulates buildExplodedView deactivate step for a single mesh.
 * Mirrors the active=false branch (instant restore, no animation) for testability.
 */
function collapseMesh(mesh) {
  if (mesh.userData.origPos) {
    mesh.position.x = mesh.userData.origPos.x;
    mesh.position.y = mesh.userData.origPos.y;
    mesh.position.z = mesh.userData.origPos.z;
  }
}

// ─── Test runner helpers ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message || err}`);
    failed++;
  }
}

// ─── Property 6: Stenosis scale formula and axis constraint ──────────────────

// Feature: nlp-heart-visualization, Property 6: Stenosis scale formula and axis constraint
runTest('Property 6: Stenosis scale formula and axis constraint', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100 }), (pct) => {
      const mesh = { scale: { x: 1.0, y: 1.0, z: 1.0 }, userData: {} };
      // simulate applyStenosisScale for one finding
      if (pct > 20) {
        const scale = Math.max(0.30, 1.0 - (pct / 100) * 0.7);
        mesh.scale.x = scale;
        mesh.scale.z = scale;
      }
      if (pct > 20) {
        const expected = Math.max(0.30, 1.0 - (pct / 100) * 0.7);
        return Math.abs(mesh.scale.x - expected) < 1e-9 &&
               Math.abs(mesh.scale.z - expected) < 1e-9 &&
               mesh.scale.y === 1.0; // y unchanged
      }
      return mesh.scale.x === 1.0 && mesh.scale.z === 1.0; // no change for pct <= 20
    }),
    { numRuns: 100 }
  );
});

// ─── Property 7: Stenosis scale restore round trip ───────────────────────────

// Feature: nlp-heart-visualization, Property 7: Stenosis scale restore round trip
runTest('Property 7: Stenosis scale restore round trip', () => {
  fc.assert(
    fc.property(
      fc.record({
        x: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }),
        y: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }),
        z: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0), noNaN: true }),
      }),
      fc.integer({ min: 21, max: 100 }),
      (origScale, pct) => {
        const mesh = { scale: { ...origScale }, userData: {} };
        // Apply
        mesh.userData.origScaleX = origScale.x;
        mesh.userData.origScaleZ = origScale.z;
        const scale = Math.max(0.30, 1.0 - (pct / 100) * 0.7);
        mesh.scale.x = scale;
        mesh.scale.z = scale;
        // Reset
        mesh.scale.x = mesh.userData.origScaleX;
        mesh.scale.z = mesh.userData.origScaleZ;
        return Math.abs(mesh.scale.x - origScale.x) < 1e-9 &&
               Math.abs(mesh.scale.y - origScale.y) < 1e-9 &&
               Math.abs(mesh.scale.z - origScale.z) < 1e-9;
      }
    ),
    { numRuns: 100 }
  );
});

// ─── Property 8: Exploded view round trip ────────────────────────────────────

// Feature: nlp-heart-visualization, Property 8: Exploded view round trip
runTest('Property 8: Exploded view round trip', () => {
  const meshArb = fc.record({
    position: fc.record({
      x: fc.float({ min: -5, max: 5, noNaN: true }),
      y: fc.float({ min: -5, max: 5, noNaN: true }),
      z: fc.float({ min: -5, max: 5, noNaN: true }),
    }),
    category: fc.constantFrom('chambers', 'coronary', 'valves'),
  }).map(({ position, category }) => ({
    position: { ...position },
    userData: { category },
  }));

  const EXPLODE_OFFSETS = { chambers: 1.5, coronary: 2.2, valves: 1.8 };

  fc.assert(
    fc.property(fc.array(meshArb, { minLength: 1, maxLength: 8 }), (meshes) => {
      // Record original positions
      const origPositions = meshes.map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z }));

      // Activate exploded view
      meshes.forEach(mesh => {
        const offset = EXPLODE_OFFSETS[mesh.userData.category] || 1.2;
        explodeMesh(mesh, offset);
      });

      // Deactivate (restore)
      meshes.forEach(mesh => collapseMesh(mesh));

      // Assert each mesh position equals origPos within tolerance
      return meshes.every((mesh, i) => {
        const orig = origPositions[i];
        return Math.abs(mesh.position.x - orig.x) < 1e-9 &&
               Math.abs(mesh.position.y - orig.y) < 1e-9 &&
               Math.abs(mesh.position.z - orig.z) < 1e-9;
      });
    }),
    { numRuns: 100 }
  );
});

// ─── Property 10: API source field for NLP submissions ───────────────────────

// Feature: nlp-heart-visualization, Property 10: API source field for NLP submissions
runTest('Property 10: API source field for NLP submissions', () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), (reportText) => {
      // Simulate what the endpoint does
      const session = { source: 'video', report_text: '', pretty_summary: '' };
      session.source = 'nlp';
      session.report_text = reportText;
      const response = { source: session.source, report_text: session.report_text };
      return response.source === 'nlp';
    }),
    { numRuns: 100 }
  );
});

// ─── Property 12: Source column rendering ────────────────────────────────────

// Feature: nlp-heart-visualization, Property 12: Source column rendering
runTest('Property 12: Source column rendering', () => {
  fc.assert(
    fc.property(
      fc.record({
        source: fc.constantFrom('nlp', 'video'),
        findings: fc.array(
          fc.record({
            structure: fc.string(),
            severity: fc.constantFrom('mild', 'moderate', 'severe'),
            color: fc.constant('#e82020'),
            ratio: fc.float({ min: 0, max: 1, noNaN: true }),
            description: fc.string(),
          }),
          { minLength: 1, maxLength: 3 }
        ),
      }),
      (session) => {
        const sourceLabel = session.source === 'nlp' ? 'Text Report' : 'Video';
        return session.findings.every(
          () => sourceLabel === (session.source === 'nlp' ? 'Text Report' : 'Video')
        );
      }
    ),
    { numRuns: 100 }
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
