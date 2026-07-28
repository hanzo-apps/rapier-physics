// Fracture Yard — a real rigid-body sandbox: Rapier3D (Rust→WASM) owns the
// simulation, three.js only draws it. The split is the whole point of the
// template: physics state lives in WASM and is read back once per frame, so the
// JS side stays a renderer and the sim stays deterministic and fast.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const hud = (t) => { document.getElementById('hud').textContent = t; };

await RAPIER.init();                       // loads the physics wasm
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 30, 90);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);
camera.position.set(16, 12, 24);
camera.lookAt(0, 4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0b0f1a, 1.0));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(18, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
sun.shadow.camera.right = sun.shadow.camera.top = 40;
scene.add(sun);

// ---- ground: one fixed body, one cuboid collider ------------------------
world.createCollider(
  RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setRestitution(0.15),
  world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)),
);
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(80, 1, 80),
  new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }),
);
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// ---- the dynamic set: every body is (rapier handle, three mesh) ----------
const bodies = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const ballGeo = new THREE.SphereGeometry(0.5, 20, 14);

function spawnBox(x, y, z, hue) {
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.05).setFriction(0.9), rb);
  const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(hue, 0.62, 0.56), roughness: 0.45, metalness: 0.12,
  }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  bodies.push({ rb, mesh });
}

function buildTower() {
  for (const { rb, mesh } of bodies) { world.removeRigidBody(rb); scene.remove(mesh); }
  bodies.length = 0;
  for (let level = 0; level < 14; level++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + level * 0.24;
      spawnBox(Math.cos(a) * 4.2, 0.5 + level * 1.02, Math.sin(a) * 4.2, (level / 14) * 0.55 + 0.05);
    }
  }
}
buildTower();

// ---- input: click to fire a heavy ball at the tower ---------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let shots = 0;
function fire(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const dir = ray.ray.direction.clone().normalize();
  const from = camera.position.clone().add(dir.clone().multiplyScalar(2));
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(from.x, from.y, from.z)
      .setLinvel(dir.x * 42, dir.y * 42, dir.z * 42).setCcdEnabled(true),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(0.5).setDensity(9).setRestitution(0.35), rb);
  const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({
    color: 0xfacc15, emissive: 0x854d0e, roughness: 0.25, metalness: 0.6,
  }));
  mesh.castShadow = true;
  scene.add(mesh);
  bodies.push({ rb, mesh });
  shots++;
}
addEventListener('pointerdown', fire);
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'r') { buildTower(); shots = 0; } });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- the loop: step the sim, copy transforms out, draw ------------------
let steps = 0, frames = 0, mark = performance.now(), fps = 0, cost = 0;
renderer.setAnimationLoop(() => {
  const t0 = performance.now();
  world.step();
  cost = cost * 0.9 + (performance.now() - t0) * 0.1;
  steps++;

  for (let i = bodies.length - 1; i >= 0; i--) {
    const { rb, mesh } = bodies[i];
    const p = rb.translation(), q = rb.rotation();
    if (p.y < -25) { world.removeRigidBody(rb); scene.remove(mesh); bodies.splice(i, 1); continue; }
    mesh.position.set(p.x, p.y, p.z);
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }

  camera.position.x = Math.cos(steps * 0.0016) * 26;
  camera.position.z = Math.sin(steps * 0.0016) * 26;
  camera.lookAt(0, 5, 0);
  renderer.render(scene, camera);

  if (++frames >= 30) {
    const now = performance.now();
    fps = Math.round((frames * 1000) / (now - mark));
    frames = 0; mark = now;
    hud(`Rapier3D · ${bodies.length} rigid bodies · step ${cost.toFixed(2)}ms · ${fps} fps · ${steps} steps\nclick to fire · R to rebuild the tower · shots ${shots}`);
  }
});

hud('starting simulation…');
