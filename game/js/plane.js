// The courier's bush plane, "Kite": a cream-and-orange high-wing monoplane
// built from triangles in plane-local space (nose +z, up +y, right +x).
// drawPlane rotates it by roll, pitch and heading and paints it far to near.
import { SUN_DIR } from './sky.js';

function quad(tris, a, b, c, d, color) {
  tris.push({ pts: [a, b, c], color });
  tris.push({ pts: [a, c, d], color });
}

function buildPlaneMesh() {
  const tris = [];
  const cream = [242, 227, 198];
  const creamDark = [214, 196, 162];
  const orange = [232, 112, 42];
  const orangeDark = [198, 88, 28];
  const teal = [42, 122, 122];
  const glass = [52, 68, 92];
  const dark = [46, 42, 44];

  // Fuselage: tapered box from five cross-sections.
  // Each section: [z, halfWidth, halfHeight].
  const sections = [
    [3.6, 0.05, 0.05],
    [3.0, 0.5, 0.5],
    [1.2, 0.62, 0.62],
    [-1.5, 0.5, 0.5],
    [-3.0, 0.28, 0.3],
    [-3.4, 0.05, 0.05],
  ];
  const corner = (sec, which) => {
    const [z, w, h] = sec;
    if (which === 0) return [0, h, z];
    if (which === 1) return [w, 0, z];
    if (which === 2) return [0, -h, z];
    return [-w, 0, z];
  };
  for (let s = 0; s < sections.length - 1; s++) {
    const a = sections[s], b = sections[s + 1];
    for (let w = 0; w < 4; w++) {
      const w2 = (w + 1) % 4;
      const color = w === 2 ? creamDark : cream;
      quad(tris, corner(a, w), corner(a, w2), corner(b, w2), corner(b, w), color);
    }
  }
  // Canopy: dark glass hump over the cockpit.
  quad(tris, [-0.42, 0.5, 1.9], [0.42, 0.5, 1.9], [0.42, 0.5, 0.7], [-0.42, 0.5, 0.7], glass);
  quad(tris, [-0.42, 0.5, 1.9], [-0.3, 0.95, 1.5], [0.3, 0.95, 1.5], [0.42, 0.5, 1.9], glass);
  quad(tris, [-0.3, 0.95, 1.5], [-0.3, 0.95, 0.7], [0.3, 0.95, 0.7], [0.3, 0.95, 1.5], glass);
  quad(tris, [-0.42, 0.5, 0.7], [-0.3, 0.95, 0.7], [0.3, 0.95, 0.7], [0.42, 0.5, 0.7], glass);
  // Main wing: high wing with slight dihedral, orange on top.
  quad(tris, [-5.6, 0.75, 1.25], [5.6, 0.75, 1.25], [5.6, 0.75, -0.35], [-5.6, 0.75, -0.35], orange);
  quad(tris, [-5.6, 0.68, -0.35], [5.6, 0.68, -0.35], [5.6, 0.68, 1.25], [-5.6, 0.68, 1.25], orangeDark);
  // Wing struts.
  quad(tris, [-1.9, 0.7, 0.9], [-1.85, 0.7, 0.9], [-1.1, -0.45, 0.9], [-1.15, -0.45, 0.9], dark);
  quad(tris, [1.9, 0.7, 0.9], [1.85, 0.7, 0.9], [1.1, -0.45, 0.9], [1.15, -0.45, 0.9], dark);
  // Tailplane.
  quad(tris, [-1.8, 0.35, -2.4], [1.8, 0.35, -2.4], [1.8, 0.35, -3.15], [-1.8, 0.35, -3.15], orange);
  quad(tris, [-1.8, 0.3, -3.15], [1.8, 0.3, -3.15], [1.8, 0.3, -2.4], [-1.8, 0.3, -2.4], orangeDark);
  // Vertical fin, teal with an orange tip stripe.
  tris.push({ pts: [[0, 0.3, -2.5], [0, 1.7, -3.15], [0, 0.3, -3.3]], color: teal });
  tris.push({ pts: [[0, 1.15, -2.95], [0, 1.7, -3.15], [0, 1.15, -3.22]], color: orange });
  // Tail stripe along the rear fuselage.
  quad(tris, [-0.51, 0.18, -1.5], [0.51, 0.18, -1.5], [0.51, 0.18, -3.0], [-0.51, 0.18, -3.0], teal);
  // Fixed landing gear: two legs and wheels.
  quad(tris, [-0.9, -0.5, 1.1], [-0.84, -0.5, 1.1], [-0.9, -1.25, 1.1], [-0.96, -1.25, 1.1], dark);
  quad(tris, [0.9, -0.5, 1.1], [0.84, -0.5, 1.1], [0.9, -1.25, 1.1], [0.96, -1.25, 1.1], dark);
  tris.push({ pts: [[-1.15, -1.15, 1.1], [-0.65, -1.15, 1.1], [-0.9, -1.6, 1.1]], color: dark });
  tris.push({ pts: [[0.65, -1.15, 1.1], [1.15, -1.15, 1.1], [0.9, -1.6, 1.1]], color: dark });
  return tris;
}

const MESH = buildPlaneMesh();

function rotatePoint(p, heading, pitch, roll) {
  const [x0, y0, z0] = p;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const x1 = x0 * cr - y0 * sr;
  const y1 = x0 * sr + y0 * cr;
  const z1 = z0;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = y1 * cp + z1 * sp;
  const z2 = -y1 * sp + z1 * cp;
  const x2 = x1;
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const x3 = x2 * ch + z2 * sh;
  const z3 = -x2 * sh + z2 * ch;
  return [x3, y2, z3];
}

function shadeColor(color, nx, ny, nz) {
  const dot = Math.max(0, nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z);
  const light = 0.62 + 0.5 * dot;
  const r = Math.round(Math.min(255, color[0] * light));
  const g = Math.round(Math.min(255, color[1] * light));
  const b = Math.round(Math.min(255, color[2] * light));
  return `rgb(${r},${g},${b})`;
}

export function drawPlane(ctx, project, state, time, camPos) {
  const painted = [];
  for (const tri of MESH) {
    const world = tri.pts.map((p) => {
      const [rx, ry, rz] = rotatePoint(p, state.heading, state.pitch, state.roll);
      return [rx + state.x, ry + state.y, rz + state.z];
    });
    const a = project(world[0][0], world[0][1], world[0][2]);
    const b = project(world[1][0], world[1][1], world[1][2]);
    const c = project(world[2][0], world[2][1], world[2][2]);
    if (!a || !b || !c) continue;
    // Face normal in world space, for shading.
    const ux = world[1][0] - world[0][0], uy = world[1][1] - world[0][1], uz = world[1][2] - world[0][2];
    const vx = world[2][0] - world[0][0], vy = world[2][1] - world[0][1], vz = world[2][2] - world[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    painted.push({
      depth: (a.cz + b.cz + c.cz) / 3,
      fill: shadeColor(tri.color, nx, ny, nz),
      pts: [a, b, c],
    });
  }
  painted.sort((p, q) => q.depth - p.depth);
  for (const t of painted) {
    ctx.fillStyle = t.fill;
    ctx.beginPath();
    ctx.moveTo(t.pts[0].x, t.pts[0].y);
    ctx.lineTo(t.pts[1].x, t.pts[1].y);
    ctx.lineTo(t.pts[2].x, t.pts[2].y);
    ctx.closePath();
    ctx.fill();
  }
  // Spinning propeller: only visible when the camera is ahead of the plane
  // (from the chase view the fuselage hides it, as it should).
  const fwdX = Math.sin(state.heading), fwdZ = Math.cos(state.heading);
  const camBehind = (camPos.x - state.x) * fwdX + (camPos.z - state.z) * fwdZ < 0;
  if (camBehind) return;
  const nose = rotatePoint([0, 0, 3.7], state.heading, state.pitch, state.roll);
  const np = project(nose[0] + state.x, nose[1] + state.y, nose[2] + state.z);
  if (np) {
    const r = 1.15 * np.s;
    const ang = time * 22;
    ctx.fillStyle = 'rgba(40, 36, 34, 0.15)';
    ctx.beginPath();
    ctx.arc(np.x, np.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 26, 24, 0.75)';
    ctx.lineWidth = Math.max(2, r * 0.12);
    for (const off of [ang, ang + Math.PI]) {
      ctx.beginPath();
      ctx.moveTo(np.x, np.y);
      ctx.lineTo(np.x + Math.cos(off) * r, np.y + Math.sin(off) * r);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8702a';
    ctx.beginPath();
    ctx.arc(np.x, np.y, Math.max(2, r * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
}
