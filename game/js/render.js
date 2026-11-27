// Scene assembly: chase camera, perspective projection, then sky, terrain,
// runway, mission markers, the plane and transient effects, in that order.
import { drawSky } from './sky.js';
import { drawTerrain, drawRunway, heightAt } from './terrain.js';
import { drawPlane } from './plane.js';
import { lerp } from './util.js';

const W = 1280, H = 720;
const FOCAL = H * 1.0;

let camPos = { x: 0, y: 6, z: 196 };
let camTarget = { x: 0, y: 2, z: 150 };

export function resetCamera(state) {
  const fx = Math.sin(state.heading), fz = Math.cos(state.heading);
  camPos = { x: state.x - fx * 17, y: state.y + 5, z: state.z - fz * 17 };
  camTarget = { x: state.x + fx * 30, y: state.y + 0.5, z: state.z + fz * 30 };
}

// Project a world point to screen space; null when behind the camera.
function makeProject() {
  const fwd = {
    x: camTarget.x - camPos.x,
    y: camTarget.y - camPos.y,
    z: camTarget.z - camPos.z,
  };
  const fl = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
  fwd.x /= fl; fwd.y /= fl; fwd.z /= fl;
  // right = normalize(cross(fwd, up(0,1,0))) = (-fwd.z, 0, fwd.x) normalised
  const rl = Math.hypot(fwd.z, fwd.x) || 1;
  const right = { x: -fwd.z / rl, y: 0, z: fwd.x / rl };
  // up = cross(right, fwd)
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  return function project(wx, wy, wz) {
    const dx = wx - camPos.x, dy = wy - camPos.y, dz = wz - camPos.z;
    const cz = dx * fwd.x + dy * fwd.y + dz * fwd.z;
    if (cz < 1) return null;
    const cx = dx * right.x + dy * right.y + dz * right.z;
    const cy = dx * up.x + dy * up.y + dz * up.z;
    const s = FOCAL / cz;
    return { x: W / 2 + cx * s, y: H / 2 - cy * s, s, cz };
  };
}

function drawRings(ctx, project, mission) {
  if (mission.kind !== 'rings') return;
  mission.rings.forEach((ring, idx) => {
    const isNext = idx === mission.ringIndex;
    const isPassed = ring.passed;
    const color = isPassed ? '#7ddc7d' : isNext ? '#ffb020' : '#9fd8e8';
    const alpha = isNext ? 1 : isPassed ? 0.55 : 0.7;
    // Ring plane faces along the course (toward the next ring / -z).
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const px = ring.x + Math.cos(a) * ring.r;
      const py = ring.y + Math.sin(a) * ring.r;
      const pz = ring.z;
      const p = project(px, py, pz);
      if (p) pts.push(p);
    }
    if (pts.length < 3) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = isNext ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Guide beam from the ring down to the ground, for the next ring only.
    if (isNext) {
      const top = project(ring.x, ring.y, ring.z);
      const bot = project(ring.x, heightAt(ring.x, ring.z), ring.z);
      if (top && bot) {
        ctx.strokeStyle = 'rgba(255, 176, 32, 0.5)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bot.x, bot.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });
}

function drawDropZone(ctx, project, mission, time) {
  if (mission.kind !== 'drop') return;
  const { x, z } = mission.target;
  const gy = heightAt(x, z);
  // Pulsing amber circle on the meadow.
  const pulse = 1 + 0.06 * Math.sin(time * 3);
  const pts = [];
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const p = project(x + Math.cos(a) * 25 * pulse, gy + 0.6, z + Math.sin(a) * 25 * pulse);
    if (p) pts.push(p);
  }
  if (pts.length > 2) {
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Flag pole with a waving orange flag.
  const poleTop = project(x, gy + 9, z);
  const poleBase = project(x, gy, z);
  if (poleTop && poleBase) {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 0.22 * poleBase.s);
    ctx.beginPath();
    ctx.moveTo(poleBase.x, poleBase.y);
    ctx.lineTo(poleTop.x, poleTop.y);
    ctx.stroke();
    const wave = Math.sin(time * 5) * 1.2 * poleTop.s;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(poleTop.x + 7 * poleTop.s, poleTop.y + 1.2 * poleTop.s + wave * 0.3);
    ctx.lineTo(poleTop.x, poleTop.y + 2.4 * poleTop.s);
    ctx.closePath();
    ctx.fill();
  }
}

function drawEffects(ctx, project, fx) {
  // Falling parcels: a brown box under a white parachute.
  for (const p of fx.parcels) {
    const bp = project(p.x, p.y, p.z);
    if (!bp) continue;
    const r = Math.max(2, 3.2 * bp.s);
    ctx.fillStyle = '#f2f2e8';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y - r * 2.2, r * 1.6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#a8763e';
    ctx.fillRect(bp.x - r * 0.7, bp.y - r * 0.6, r * 1.4, r * 1.4);
  }
  // Smoke puffs rising from the drop zone.
  for (const s of fx.smoke) {
    const p = project(s.x, s.y, s.z);
    if (!p) continue;
    const r = Math.max(2, s.r * p.s);
    ctx.fillStyle = `rgba(230, 230, 225, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Crash debris.
  for (const d of fx.debris) {
    const p = project(d.x, d.y, d.z);
    if (!p) continue;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, d.r * p.s), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderScene(ctx, state, mission, fx, time) {
  // Chase camera: behind and above the plane, looking ahead of it.
  const fx0 = Math.sin(state.heading), fz0 = Math.cos(state.heading);
  const wantPos = {
    x: state.x - fx0 * 17,
    y: state.y + 5,
    z: state.z - fz0 * 17,
  };
  const wantTarget = {
    x: state.x + fx0 * 30,
    y: state.y + 0.5,
    z: state.z + fz0 * 30,
  };
  const k = 1 - Math.pow(0.001, 1 / 60); // smooth follow
  camPos.x = lerp(camPos.x, wantPos.x, k);
  camPos.y = lerp(camPos.y, wantPos.y, k);
  camPos.z = lerp(camPos.z, wantPos.z, k);
  camTarget.x = lerp(camTarget.x, wantTarget.x, k);
  camTarget.y = lerp(camTarget.y, wantTarget.y, k);
  camTarget.z = lerp(camTarget.z, wantTarget.z, k);

  const project = makeProject();
  drawSky(ctx, W, H, state.heading, camPos, project);
  drawTerrain(ctx, project, state.x, state.z);
  drawRunway(ctx, project);
  drawRings(ctx, project, mission);
  drawDropZone(ctx, project, mission, time);
  drawEffects(ctx, project, fx);
  drawPlane(ctx, project, state, time, camPos);
}
