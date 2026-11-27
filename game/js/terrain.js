// Procedural valley terrain: a height field, a river, a flattened airfield
// with a runway, and scattered pine trees. Everything is deterministic so
// the valley looks the same on every run.
import { clamp, hash2, smoothstep } from './util.js';

export const RUNWAY = { x: 0, z: 0, halfWidth: 13, halfLength: 220 };

// The river meanders down the east side of the valley.
export function riverX(z) {
  return 260 * Math.sin(z * 0.0016 + 0.8);
}

function rawHeight(x, z) {
  let h = 16 * Math.sin(x * 0.004 + 1.7) * Math.cos(z * 0.0031);
  h += 11 * Math.sin(x * 0.011 + 0.4) * Math.sin(z * 0.0072 + 0.5);
  h += 7 * Math.sin((x + z) * 0.0021 + 2.0);
  const ridge = Math.sin(x * 0.0016 + 2.0) * Math.sin(z * 0.0013 + 0.7);
  h += 22 * ridge * ridge;
  h += 4 * Math.sin(x * 0.031) * Math.cos(z * 0.027);
  return h * 0.8; // keep the valley green and the hills climbable-looking
}

export function heightAt(x, z) {
  let h = rawHeight(x, z);
  // Carve the river valley (wide, gentle banks).
  const dRiver = Math.abs(x - riverX(z));
  h -= 6 * smoothstep(40, 8, dRiver);
  // Flatten the airfield: blend to 0.5 m over 260 m from the runway
  // rectangle's edge, so the strip is flat and the surroundings roll away.
  const dx = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.halfWidth);
  const dz = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.halfLength);
  const d = Math.hypot(dx, dz);
  const flat = 1 - smoothstep(0, 260, d);
  h = h * (1 - flat) + 0.5 * flat;
  return h;
}

export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.halfLength
  );
}

const SUN = { x: 0.55, y: 0.8, z: 0.3 };
const SUN_LEN = Math.hypot(SUN.x, SUN.y, SUN.z);
const SUN_DIR = { x: SUN.x / SUN_LEN, y: SUN.y / SUN_LEN, z: SUN.z / SUN_LEN };

function groundShade(x, z, h) {
  const v = hash2(Math.floor(x / 18), Math.floor(z / 18));
  const jitter = 0.92 + v * 0.16;
  let r, g, b;
  if (Math.abs(x - riverX(z)) < 11 && h < 2.5) {
    r = 64; g = 122; b = 150; // river water
  } else if (h < 1.6) {
    r = 198; g = 168; b = 106; // sandy bank
  } else if (h < 12) {
    r = 104; g = 148; b = 74; // meadow
  } else if (h < 24) {
    r = 82; g = 122; b = 62; // forest floor
  } else if (h < 34) {
    r = 122; g = 104; b = 82; // rock
  } else if (h < 42) {
    r = 138; g = 130; b = 122; // high rock
  } else {
    r = 232; g = 232; b = 236; // snow
  }
  // Simple lambert shading from the finite-difference normal.
  const dhdx = (heightAt(x + 2, z) - heightAt(x - 2, z)) / 4;
  const dhdz = (heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
  const nx = -dhdx, ny = 1, nz = -dhdz;
  const nl = Math.hypot(nx, ny, nz);
  const dot =
    (nx / nl) * SUN_DIR.x + (ny / nl) * SUN_DIR.y + (nz / nl) * SUN_DIR.z;
  const light = 0.72 + 0.38 * Math.max(0, dot);
  const rr = Math.round(clamp(r * jitter * light, 0, 255));
  const gg = Math.round(clamp(g * jitter * light, 0, 255));
  const bb = Math.round(clamp(b * jitter * light, 0, 255));
  return `rgb(${rr},${gg},${bb})`;
}

// Draw the terrain as a grid of quads around (focusX, focusZ), far to near,
// with pine trees interleaved by depth. `project` maps world points to
// screen points ({x, y, s, cz}) or null when behind the camera.
export function drawTerrain(ctx, project, focusX, focusZ) {
  const cell = 45;
  const half = 14;
  const items = [];
  const i0 = Math.floor((focusX - half * cell) / cell);
  const j0 = Math.floor((focusZ - half * cell) / cell);
  for (let j = j0; j < j0 + half * 2; j++) {
    for (let i = i0; i < i0 + half * 2; i++) {
      const x0 = i * cell, x1 = (i + 1) * cell;
      const z0 = j * cell, z1 = (j + 1) * cell;
      const h00 = heightAt(x0, z0), h10 = heightAt(x1, z0);
      const h11 = heightAt(x1, z1), h01 = heightAt(x0, z1);
      const p00 = project(x0, h00, z0), p10 = project(x1, h10, z0);
      const p11 = project(x1, h11, z1), p01 = project(x0, h01, z1);
      if (!p00 || !p10 || !p11 || !p01) continue;
      const depth = (p00.cz + p10.cz + p11.cz + p01.cz) / 4;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const ch = (h00 + h10 + h11 + h01) / 4;
      const fill = groundShade(cx, cz, ch);
      items.push({
        depth,
        draw() {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.lineTo(p11.x, p11.y);
          ctx.lineTo(p01.x, p01.y);
          ctx.closePath();
          ctx.fill();
        },
      });
      // Pine tree in this cell, if the hash says so and the spot suits one.
      const hv = hash2(i, j);
      if (hv < 0.09) {
        const tx = x0 + 8 + hash2(i, j + 31) * (cell - 16);
        const tz = z0 + 8 + hash2(i + 17, j) * (cell - 16);
        const th = heightAt(tx, tz);
        const nearField = Math.abs(tx) < 70 && Math.abs(tz) < 270;
        const nearRiver = Math.abs(tx - riverX(tz)) < 14;
        if (th > 2.5 && th < 32 && !nearField && !nearRiver) {
          const base = project(tx, th, tz);
          const top = project(tx, th + 10, tz);
          const left = project(tx - 2.6, th + 4.5, tz);
          const right = project(tx + 2.6, th + 4.5, tz);
          if (base && top && left && right) {
            const tv = hash2(i + 5, j + 5);
            const green = `rgb(${34 + tv * 20 | 0},${86 + tv * 22 | 0},${46 + tv * 14 | 0})`;
            items.push({
              depth: base.cz,
              draw() {
                ctx.strokeStyle = '#5a3d24';
                ctx.lineWidth = Math.max(1, 0.28 * base.s);
                ctx.beginPath();
                ctx.moveTo(base.x, base.y);
                ctx.lineTo(base.x, base.y - 3.2 * base.s);
                ctx.stroke();
                ctx.fillStyle = green;
                ctx.beginPath();
                ctx.moveTo(top.x, top.y);
                ctx.lineTo(left.x, left.y);
                ctx.lineTo(right.x, right.y);
                ctx.closePath();
                ctx.fill();
              },
            });
          }
        }
      }
    }
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const item of items) item.draw();
}

// The runway strip: dark asphalt, white centre dashes, threshold bars and
// amber edge lights, plus a windsock on the grass beside it.
export function drawRunway(ctx, project) {
  const y = 0.75;
  const hw = RUNWAY.halfWidth, hl = RUNWAY.halfLength;
  const c = [
    project(-hw, y, -hl), project(hw, y, -hl),
    project(hw, y, hl), project(-hw, y, hl),
  ];
  if (c.every(Boolean)) {
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(c[k].x, c[k].y);
    ctx.closePath();
    ctx.fill();
    // Centre dashes.
    ctx.fillStyle = '#f2f2e8';
    for (let z = -200; z <= 200; z += 26) {
      const a = project(-1.1, y + 0.05, z), b = project(1.1, y + 0.05, z);
      const d = project(1.1, y + 0.05, z + 12), e = project(-1.1, y + 0.05, z + 12);
      if (a && b && d && e) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y);
        ctx.closePath(); ctx.fill();
      }
    }
    // Threshold bars at both ends.
    for (const zend of [-208, 208]) {
      for (const xoff of [-9, -3, 3, 9]) {
        const a = project(xoff - 1.6, y + 0.05, zend - 7);
        const b = project(xoff + 1.6, y + 0.05, zend - 7);
        const d = project(xoff + 1.6, y + 0.05, zend + 7);
        const e = project(xoff - 1.6, y + 0.05, zend + 7);
        if (a && b && d && e) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    // Edge lights.
    ctx.fillStyle = '#ffb020';
    for (let z = -200; z <= 200; z += 40) {
      for (const xoff of [-hw, hw]) {
        const p = project(xoff, y + 0.4, z);
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.6, 0.32 * p.s), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // Windsock: pole with an orange cone pointing downwind.
  const wx = 34, wz = 150;
  const wy = heightAt(wx, wz);
  const poleTop = project(wx, wy + 7, wz);
  const poleBase = project(wx, wy, wz);
  const coneTip = project(wx + 5.5, wy + 6.2, wz);
  if (poleTop && poleBase && coneTip) {
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 0.22 * poleBase.s);
    ctx.beginPath();
    ctx.moveTo(poleBase.x, poleBase.y);
    ctx.lineTo(poleTop.x, poleTop.y);
    ctx.stroke();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(coneTip.x, coneTip.y - 1.1 * poleTop.s);
    ctx.lineTo(coneTip.x, coneTip.y + 1.1 * poleTop.s);
    ctx.closePath();
    ctx.fill();
  }
}
