// Golden-hour sky: gradient, low sun with glow, a distant ridge silhouette
// and drifting clouds anchored in the world so they parallax with the view.
import { hash1 } from './util.js';

const CLOUDS = [];
for (let k = 0; k < 14; k++) {
  CLOUDS.push({
    x: (hash1(k * 3 + 1) - 0.5) * 3200,
    z: (hash1(k * 3 + 2) - 0.5) * 3200,
    y: 190 + hash1(k * 3 + 3) * 90,
    r: 50 + hash1(k * 7 + 5) * 90,
  });
}

// Sun direction in world space: low in the west (compass 250 deg).
const SUN_AZ = (250 * Math.PI) / 180;
const SUN_EL = (13 * Math.PI) / 180;
export const SUN_DIR = {
  x: Math.sin(SUN_AZ) * Math.cos(SUN_EL),
  y: Math.sin(SUN_EL),
  z: Math.cos(SUN_AZ) * Math.cos(SUN_EL),
};

export function drawSky(ctx, W, H, heading, camPos, project) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b2350');
  g.addColorStop(0.42, '#7a4a7a');
  g.addColorStop(0.64, '#e07b3f');
  g.addColorStop(0.76, '#f7b267');
  g.addColorStop(1, '#3d2b1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Sun: project a far point along its direction from the camera.
  const sunPoint = project(
    camPos.x + SUN_DIR.x * 4000,
    camPos.y + SUN_DIR.y * 4000,
    camPos.z + SUN_DIR.z * 4000,
  );
  if (sunPoint && sunPoint.y > -80 && sunPoint.y < H * 0.75) {
    const glow = ctx.createRadialGradient(
      sunPoint.x, sunPoint.y, 4, sunPoint.x, sunPoint.y, 150,
    );
    glow.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 170, 90, 0.55)');
    glow.addColorStop(1, 'rgba(255, 150, 70, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunPoint.x - 160, sunPoint.y - 160, 320, 320);
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(sunPoint.x, sunPoint.y, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant ridge silhouette, scrolling with heading.
  ctx.fillStyle = 'rgba(74, 53, 96, 0.9)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.64);
  const scale = H / 720;
  for (let sx = 0; sx <= W; sx += 16) {
    const az = heading + (sx / W - 0.5) * 1.5;
    const ridge =
      26 +
      30 * Math.pow(Math.abs(Math.sin(az * 2.3 + 1.2)), 1.5) +
      18 * Math.sin(az * 5.1 + 0.3);
    ctx.lineTo(sx, H * 0.62 - ridge * scale);
  }
  ctx.lineTo(W, H * 0.64);
  ctx.closePath();
  ctx.fill();

  // Clouds: soft warm blobs, drawn before the terrain so hills cover them.
  for (const c of CLOUDS) {
    const p = project(c.x, c.y, c.z);
    if (!p) continue;
    const r = c.r * p.s;
    if (r < 2 || p.x < -r * 3 || p.x > W + r * 3 || p.y < -r * 2 || p.y > H * 0.8) continue;
    ctx.fillStyle = 'rgba(255, 232, 208, 0.82)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.55, p.y + r * 0.06, r * 0.62, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
