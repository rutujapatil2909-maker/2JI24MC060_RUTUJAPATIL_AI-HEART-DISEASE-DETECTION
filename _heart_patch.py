import re

NEW = """/* ─── 3. THREE.JS TRANSPARENT ANATOMICAL HEART ─── */
(function(){
  const container = document.getElementById('heart-3d');
  if(!container || typeof THREE === 'undefined') return;

  const W = 420, H = 460;
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W/H, 0.01, 100);
  camera.position.set(0, 0.3, 5.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.sortObjects = true;
  container.appendChild(renderer.domElement);

  /* ── LIGHTS ── */
  scene.add(new THREE.AmbientLight(0x112244, 1.5));

  const sun = new THREE.DirectionalLight(0xffeedd, 2.2);
  sun.position.set(2, 3, 4); sun.castShadow = true; scene.add(sun);

  const rimL = new THREE.PointLight(0x00d4ff, 5.0, 16);
  rimL.position.set(-4, 1, -2); scene.add(rimL);

  const rimR = new THREE.PointLight(0xff2d78, 4.5, 14);
  rimR.position.set(4, 0, 2); scene.add(rimR);

  const bot = new THREE.PointLight(0x7b2fff, 2.5, 10);
  bot.position.set(0, -4, 0); scene.add(bot);

  const top = new THREE.PointLight(0xffffff, 1.2, 12);
  top.position.set(0, 6, 1); scene.add(top);

  /* ── HEART GROUP ── */
  const G = new THREE.Group();
  scene.add(G);

  /* ── MATERIAL HELPERS ── */
  // Opaque solid parts (vessels, inner structures)
  function solidMat(col, emi, ei, rgh, mtl) {
    return new THREE.MeshStandardMaterial({
      color: col, emissive: emi, emissiveIntensity: ei||0.25,
      roughness: rgh||0.5, metalness: mtl||0.1,
      side: THREE.FrontSide,
    });
  }
  // Transparent outer wall — key for "see-through" look
  function transMat(col, emi, ei, op, rgh, mtl) {
    return new THREE.MeshPhysicalMaterial({
      color: col, emissive: emi, emissiveIntensity: ei||0.2,
      roughness: rgh||0.15, metalness: mtl||0.05,
      transparent: true, opacity: op||0.42,
      transmission: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  /* ════════════════════════════════════════
     INNER STRUCTURES (rendered first, solid)
  ════════════════════════════════════════ */

  // Left ventricle inner cavity (bright red — oxygenated)
  const lvCavGeo = new THREE.SphereGeometry(0.62, 40, 40);
  lvCavGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.88, 1.28, 0.80));
  const lvCav = new THREE.Mesh(lvCavGeo, solidMat(0xdd1a2e, 0xaa0010, 0.5, 0.6, 0.05));
  lvCav.position.set(-0.20, -0.25, 0.0);
  G.add(lvCav);

  // Right ventricle inner cavity (dark blue — deoxygenated)
  const rvCavGeo = new THREE.SphereGeometry(0.48, 36, 36);
  rvCavGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.78, 1.18, 0.72));
  const rvCav = new THREE.Mesh(rvCavGeo, solidMat(0x1a3a9b, 0x0a1a60, 0.45, 0.55, 0.08));
  rvCav.position.set(0.44, -0.16, 0.16);
  G.add(rvCav);

  // Left atrium inner (red)
  const laCavGeo = new THREE.SphereGeometry(0.34, 28, 28);
  laCavGeo.applyMatrix4(new THREE.Matrix4().makeScale(1.1, 0.75, 0.88));
  const laCav = new THREE.Mesh(laCavGeo, solidMat(0xcc1828, 0x880010, 0.4, 0.55, 0.06));
  laCav.position.set(-0.36, 0.70, -0.16);
  G.add(laCav);

  // Right atrium inner (blue)
  const raCavGeo = new THREE.SphereGeometry(0.30, 28, 28);
  raCavGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.88, 0.72, 0.82));
  const raCav = new THREE.Mesh(raCavGeo, solidMat(0x162e8a, 0x081440, 0.4, 0.55, 0.06));
  raCav.position.set(0.48, 0.62, -0.10);
  G.add(raCav);

  // Interventricular septum (visible divider)
  const septGeo = new THREE.BoxGeometry(0.08, 1.1, 0.65);
  const sept = new THREE.Mesh(septGeo, solidMat(0x8a1020, 0x440008, 0.3, 0.7, 0.05));
  sept.position.set(0.12, -0.22, 0.05);
  G.add(sept);

  // Mitral valve (left AV valve)
  const mvGeo = new THREE.TorusGeometry(0.18, 0.04, 12, 24);
  const mv = new THREE.Mesh(mvGeo, solidMat(0xf5e6c8, 0xc8a060, 0.3, 0.4, 0.15));
  mv.position.set(-0.20, 0.28, 0.0);
  mv.rotation.x = Math.PI / 2;
  G.add(mv);

  // Tricuspid valve (right AV valve)
  const tvGeo = new THREE.TorusGeometry(0.16, 0.035, 12, 24);
  const tv = new THREE.Mesh(tvGeo, solidMat(0xf0ddb8, 0xc09050, 0.3, 0.4, 0.15));
  tv.position.set(0.44, 0.26, 0.14);
  tv.rotation.x = Math.PI / 2;
  G.add(tv);

  // Aortic valve
  const avGeo = new THREE.TorusGeometry(0.14, 0.03, 10, 20);
  const av = new THREE.Mesh(avGeo, solidMat(0xf5e6c8, 0xc8a060, 0.35, 0.35, 0.2));
  av.position.set(-0.08, 0.82, -0.06);
  av.rotation.x = Math.PI / 2;
  G.add(av);

  /* ════════════════════════════════════════
     OUTER TRANSPARENT MYOCARDIUM WALLS
  ════════════════════════════════════════ */

  // Left ventricle outer wall — semi-transparent deep red
  const lvGeo = new THREE.SphereGeometry(0.88, 56, 56);
  lvGeo.applyMatrix4(new THREE.Matrix4().makeScale(1.0, 1.42, 0.92));
  const lv = new THREE.Mesh(lvGeo, transMat(0xc01828, 0x880010, 0.3, 0.45));
  lv.position.set(-0.20, -0.26, 0.0);
  lv.renderOrder = 1;
  G.add(lv);

  // Right ventricle outer wall — semi-transparent dark red
  const rvGeo = new THREE.SphereGeometry(0.68, 44, 44);
  rvGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.82, 1.26, 0.78));
  const rv = new THREE.Mesh(rvGeo, transMat(0x8a0e1e, 0x4a0008, 0.22, 0.40));
  rv.position.set(0.44, -0.16, 0.18);
  rv.renderOrder = 1;
  G.add(rv);

  // Apex
  const apexGeo = new THREE.ConeGeometry(0.36, 0.72, 28);
  const apex = new THREE.Mesh(apexGeo, transMat(0x980e18, 0x4a0008, 0.2, 0.42));
  apex.position.set(-0.10, -1.16, 0.04);
  apex.rotation.z = 0.12;
  apex.renderOrder = 1;
  G.add(apex);

  // Left atrium outer
  const laGeo = new THREE.SphereGeometry(0.50, 36, 36);
  laGeo.applyMatrix4(new THREE.Matrix4().makeScale(1.14, 0.82, 0.94));
  const la = new THREE.Mesh(laGeo, transMat(0xc01828, 0x780012, 0.28, 0.40));
  la.position.set(-0.36, 0.72, -0.18);
  la.renderOrder = 1;
  G.add(la);

  // Right atrium outer
  const raGeo = new THREE.SphereGeometry(0.44, 36, 36);
  raGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.92, 0.78, 0.88));
  const ra = new THREE.Mesh(raGeo, transMat(0x8a1020, 0x480010, 0.22, 0.38));
  ra.position.set(0.48, 0.64, -0.12);
  ra.renderOrder = 1;
  G.add(ra);

  /* ════════════════════════════════════════
     AORTA — blue/cyan, semi-transparent
  ════════════════════════════════════════ */
  const aortaMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a3a9b, emissive: 0x0a1a60, emissiveIntensity: 0.5,
    roughness: 0.2, metalness: 0.3,
    transparent: true, opacity: 0.82,
    side: THREE.DoubleSide, depthWrite: false,
  });

  // Aortic root
  G.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.24,0.36,20), aortaMat), {position: new THREE.Vector3(-0.08,0.98,-0.08)}));
  // Ascending
  G.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.20,0.66,18), aortaMat), {position: new THREE.Vector3(-0.06,1.42,-0.06)}));
  // Arch
  const archM = new THREE.Mesh(new THREE.TorusGeometry(0.32,0.16,16,28,Math.PI*0.85), aortaMat);
  archM.position.set(0.18,1.72,-0.06); archM.rotation.z=Math.PI/2; archM.rotation.y=0.25; G.add(archM);
  // Descending
  const descM = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.18,0.56,16), aortaMat);
  descM.position.set(0.46,1.42,-0.06); descM.rotation.z=0.28; G.add(descM);
  // Branches
  [[0.05,1.95,0,-0.3],[0.22,1.98,0,-0.1],[0.38,1.92,0,0.15]].forEach(([x,y,z,rz])=>{
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.28,10),aortaMat);
    m.position.set(x,y,z); m.rotation.z=rz; G.add(m);
  });

  /* ════════════════════════════════════════
     PULMONARY ARTERY — blue, semi-transparent
  ════════════════════════════════════════ */
  const pulMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e4aaa, emissive: 0x0c2270, emissiveIntensity: 0.45,
    roughness: 0.22, metalness: 0.28,
    transparent: true, opacity: 0.80,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const pMain = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.20,0.70,18), pulMat);
  pMain.position.set(0.34,0.95,0.22); pMain.rotation.z=-0.22; G.add(pMain);
  const plb = new THREE.CatmullRomCurve3([new THREE.Vector3(0.22,1.28,0.22),new THREE.Vector3(0.0,1.42,0.18),new THREE.Vector3(-0.22,1.38,0.12)]);
  G.add(new THREE.Mesh(new THREE.TubeGeometry(plb,14,0.10,10,false),pulMat));
  const prb = new THREE.CatmullRomCurve3([new THREE.Vector3(0.44,1.28,0.22),new THREE.Vector3(0.62,1.38,0.18),new THREE.Vector3(0.78,1.32,0.10)]);
  G.add(new THREE.Mesh(new THREE.TubeGeometry(prb,14,0.09,10,false),pulMat));

  /* ════════════════════════════════════════
     VENA CAVA — dark blue
  ════════════════════════════════════════ */
  const vcMat = new THREE.MeshPhysicalMaterial({
    color:0x162e7a, emissive:0x081440, emissiveIntensity:0.4,
    roughness:0.3, metalness:0.25, transparent:true, opacity:0.78,
    side:THREE.DoubleSide, depthWrite:false,
  });
  const svcM = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,0.72,14),vcMat);
  svcM.position.set(0.62,0.95,-0.08); G.add(svcM);
  const ivcM = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,0.50,14),vcMat);
  ivcM.position.set(0.66,0.22,-0.08); ivcM.rotation.z=0.18; G.add(ivcM);

  /* ════════════════════════════════════════
     PULMONARY VEINS — red
  ════════════════════════════════════════ */
  const pvMat = new THREE.MeshPhysicalMaterial({
    color:0xcc1a30, emissive:0x880015, emissiveIntensity:0.35,
    roughness:0.35, metalness:0.15, transparent:true, opacity:0.75,
    side:THREE.DoubleSide, depthWrite:false,
  });
  [[-0.62,0.72,-0.28,0.55],[-0.62,0.55,-0.24,0.50],[0.02,0.75,-0.30,-0.50],[0.02,0.58,-0.26,-0.48]].forEach(([x,y,z,rz])=>{
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.10,0.42,10),pvMat);
    m.position.set(x,y,z); m.rotation.z=rz; G.add(m);
  });

  /* ════════════════════════════════════════
     CORONARY ARTERIES — bright glowing on surface
  ════════════════════════════════════════ */
  const corMat = new THREE.MeshStandardMaterial({
    color:0xff7799, emissive:0xff2255, emissiveIntensity:0.7,
    roughness:0.2, metalness:0.45,
  });
  const ladPts=[new THREE.Vector3(-0.05,0.42,0.72),new THREE.Vector3(-0.12,0.18,0.82),new THREE.Vector3(-0.18,-0.08,0.80),new THREE.Vector3(-0.22,-0.35,0.72),new THREE.Vector3(-0.24,-0.62,0.60),new THREE.Vector3(-0.22,-0.88,0.44),new THREE.Vector3(-0.18,-1.05,0.28)];
  G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ladPts),28,0.038,8,false),corMat));
  const lcxPts=[new THREE.Vector3(-0.05,0.42,0.72),new THREE.Vector3(-0.28,0.35,0.65),new THREE.Vector3(-0.55,0.18,0.48),new THREE.Vector3(-0.72,-0.05,0.28),new THREE.Vector3(-0.78,-0.28,0.08),new THREE.Vector3(-0.72,-0.52,-0.12)];
  G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lcxPts),24,0.032,8,false),corMat));
  const rcaPts=[new THREE.Vector3(0.28,0.38,0.58),new THREE.Vector3(0.52,0.18,0.52),new THREE.Vector3(0.68,-0.05,0.38),new THREE.Vector3(0.72,-0.32,0.22),new THREE.Vector3(0.68,-0.58,0.05),new THREE.Vector3(0.55,-0.82,-0.10),new THREE.Vector3(0.35,-1.0,-0.18)];
  G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rcaPts),28,0.034,8,false),corMat));
  const diagPts=[new THREE.Vector3(-0.14,0.08,0.82),new THREE.Vector3(-0.35,-0.08,0.72),new THREE.Vector3(-0.52,-0.22,0.55),new THREE.Vector3(-0.58,-0.42,0.38)];
  G.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(diagPts),16,0.025,8,false),corMat));

  /* ════════════════════════════════════════
     HOLOGRAPHIC SPHERE BUBBLE
  ════════════════════════════════════════ */
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color:0x00d4ff, emissive:0x003344, emissiveIntensity:0.08,
    roughness:0.0, metalness:0.0,
    transparent:true, opacity:0.05,
    side:THREE.FrontSide, depthWrite:false,
  });
  G.add(new THREE.Mesh(new THREE.SphereGeometry(1.75,48,48), bubbleMat));

  // Sphere ring lines
  const ringMat = new THREE.LineBasicMaterial({color:0x00d4ff,transparent:true,opacity:0.20});
  [0,Math.PI/4,Math.PI/2,-Math.PI/4].forEach(a=>{
    const pts=[];
    for(let i=0;i<=64;i++){const t=(i/64)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(t)*1.75,Math.sin(t)*1.75*Math.cos(a),Math.sin(t)*1.75*Math.sin(a)));}
    G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),ringMat));
  });

  /* ════════════════════════════════════════
     NEON PARTICLES
  ════════════════════════════════════════ */
  const pGeo=new THREE.BufferGeometry();
  const pN=200, pPos=new Float32Array(pN*3), pCol=new Float32Array(pN*3);
  for(let i=0;i<pN;i++){
    const th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI, r=1.55+Math.random()*0.85;
    pPos[i*3]=r*Math.sin(ph)*Math.cos(th); pPos[i*3+1]=r*Math.cos(ph)*0.85; pPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    const c=Math.random()>0.45;
    pCol[i*3]=c?0.0:1.0; pCol[i*3+1]=c?0.83:0.18; pCol[i*3+2]=c?1.0:0.47;
  }
  pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
  pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
  const pMat=new THREE.PointsMaterial({size:0.048,vertexColors:true,transparent:true,opacity:0.80,blending:THREE.AdditiveBlending,depthWrite:false});
  const particles=new THREE.Points(pGeo,pMat);
  G.add(particles);

  /* ── DRAG CONTROLS ── */
  let isDrag=false,lx=0,ly=0,rotY=0,rotX=0.14;
  renderer.domElement.addEventListener('mousedown',e=>{isDrag=true;lx=e.clientX;ly=e.clientY;renderer.domElement.style.cursor='grabbing';});
  window.addEventListener('mouseup',()=>{isDrag=false;renderer.domElement.style.cursor='grab';});
  window.addEventListener('mousemove',e=>{if(!isDrag)return;rotY+=(e.clientX-lx)*0.011;rotX+=(e.clientY-ly)*0.005;rotX=Math.max(-0.85,Math.min(0.85,rotX));lx=e.clientX;ly=e.clientY;});
  renderer.domElement.addEventListener('touchstart',e=>{isDrag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;},{passive:true});
  renderer.domElement.addEventListener('touchmove',e=>{if(!isDrag)return;rotY+=(e.touches[0].clientX-lx)*0.011;lx=e.touches[0].clientX;},{passive:true});
  renderer.domElement.addEventListener('touchend',()=>isDrag=false);

  /* ── ANIMATE ── */
  let autoAngle=0;
  const clock=new THREE.Clock();

  function animate(){
    requestAnimationFrame(animate);
    const t=clock.getElapsedTime();
    if(!isDrag) autoAngle+=0.006;
    G.rotation.y=autoAngle+rotY;
    G.rotation.x=rotX;

    // Realistic lub-dub heartbeat
    const phase=(t%0.88)/0.88;
    const lub=Math.max(0,Math.sin(phase*Math.PI/0.20))*0.042;
    const dub=Math.max(0,Math.sin(((t+0.24)%0.88)*Math.PI/0.16))*0.024;
    const sc=1.0+lub+dub;
    G.scale.setScalar(sc);

    // Lights pulse with beat
    rimR.intensity=4.5+lub*14;
    rimL.intensity=5.0+dub*10;
    corMat.emissiveIntensity=0.6+lub*2.0;

    // Transparent walls breathe slightly
    lv.material.opacity=0.42+lub*0.12;
    rv.material.opacity=0.38+lub*0.10;

    // Particles orbit
    particles.rotation.y=t*0.10;
    particles.rotation.x=Math.sin(t*0.07)*0.12;

    renderer.render(scene,camera);
  }
  animate();
})();

"""

c = open('patient.html', encoding='utf-8').read()

# Find boundaries using the unicode dash characters
import re
m_start = re.search(r'/\* \u2500{3} 3\. THREE\.JS', c)
m_end   = re.search(r'/\* \u2500{3} 4\. ECG CANVAS', c)

if not m_start or not m_end:
    print("ERROR: markers not found")
    print("start:", m_start, "end:", m_end)
else:
    si = m_start.start()
    ei = m_end.start()
    new_c = c[:si] + NEW + c[ei:]
    open('patient.html', 'w', encoding='utf-8').write(new_c)
    print("Done. Lines:", new_c.count('\n'))
    print("Has transMat:", 'transMat' in new_c)
    print("Has MeshPhysicalMaterial:", 'MeshPhysicalMaterial' in new_c)
    print("Has inner cavities:", 'lvCav' in new_c)
