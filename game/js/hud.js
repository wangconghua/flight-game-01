// Cockpit instruments drawn over the 3D view: airspeed, altitude, heading
// compass, fuel and damage bars, artificial horizon, throttle, score and
// the current objective. Everything shown is read from the live state.
import { clamp } from './util.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(20, 14, 10, 0.62)';
  ctx.strokeStyle = 'rgba(255, 200, 130, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 4);
}

export function drawHud(ctx, W, H, state, mission, objective, objectiveDist) {
  ctx.textBaseline = 'alphabetic';

  // --- Compass strip, top centre ---
  const headingDeg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  const cx = W / 2, cy = 34;
  panel(ctx, cx - 190, 12, 380, 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, 12, 380, 46);
  ctx.clip();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round(headingDeg + d);
    const norm = ((deg % 360) + 360) % 360;
    const sx = cx + d * 3.1;
    const isMajor = norm % 30 === 0;
    const isCard = norm % 90 === 0;
    ctx.strokeStyle = 'rgba(255,233,196,0.8)';
    ctx.beginPath();
    ctx.moveTo(sx, cy + 12);
    ctx.lineTo(sx, cy + (isMajor ? 22 : 17));
    ctx.stroke();
    if (isMajor) {
      const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W'
        : String(norm).padStart(3, '0');
      ctx.fillText(label, sx, cy + 36);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(cx, 14);
  ctx.lineTo(cx - 6, 24);
  ctx.lineTo(cx + 6, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, 74);

  // --- Left panel: airspeed, altitude, vertical speed ---
  panel(ctx, 16, 14, 168, 108);
  ctx.fillStyle = '#ffe9c4';
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`${Math.round(state.speed * 1.944)}`, 30, 52);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('KT  AIRSPEED', 92, 40);
  ctx.fillText('ALT', 30, 78);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`${Math.round(Math.max(0, state.y * 3.28))} ft`, 30, 102);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = state.vy >= 0 ? '#9fe08a' : '#ff9a7a';
  ctx.fillText(`${state.vy >= 0 ? '+' : ''}${Math.round(state.vy * 197)} fpm`, 108, 78);

  // --- Right panel: fuel, damage, score, mission ---
  panel(ctx, W - 216, 14, 200, 132);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${mission.score}`, W - 202, 38);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(mission.title.toUpperCase(), W - 202, 58);
  bar(ctx, W - 202, 68, 172, 14, state.fuel / 100,
    state.fuel < 25 ? '#ff5a3c' : '#ffb020', `FUEL ${Math.round(state.fuel)}%`);
  bar(ctx, W - 202, 90, 172, 14, state.damage / 100,
    state.damage > 60 ? '#ff5a3c' : '#e8702a', `DAMAGE ${Math.round(state.damage)}%`);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = '13px system-ui, sans-serif';
  if (mission.kind === 'rings') {
    ctx.fillText(`RINGS  ${mission.ringIndex} / 6`, W - 202, 128);
  } else if (mission.kind === 'drop') {
    ctx.fillText(`PARCELS  ${mission.parcelsLeft}  (SPACE to drop)`, W - 202, 128);
  } else {
    ctx.fillText(state.landed ? 'LANDED — well flown!' : 'LAND ON RUNWAY 07', W - 202, 128);
  }

  // --- Artificial horizon, bottom left ---
  const hx = 78, hy = H - 78, hr = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-state.roll);
  ctx.translate(0, state.pitch * 130);
  ctx.fillStyle = '#e8965a';
  ctx.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
  ctx.fillStyle = '#4a3220';
  ctx.fillRect(-hr, 0, hr * 2, hr * 2);
  ctx.strokeStyle = 'rgba(255,233,196,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, 0);
  ctx.lineTo(hr, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,200,130,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffb020';
  ctx.beginPath();
  ctx.moveTo(hx, hy - hr - 4);
  ctx.lineTo(hx - 6, hy - hr + 6);
  ctx.lineTo(hx + 6, hy - hr + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 16);

  // --- Throttle, bottom right ---
  const tx = W - 78, ty = H - 132;
  panel(ctx, tx - 42, ty - 6, 84, 138);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(tx - 12, ty + 8, 24, 96);
  ctx.fillStyle = '#7ddc7d';
  const th = state.throttle * 96;
  ctx.fillRect(tx - 12, ty + 104 - th, 24, th);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`THR ${Math.round(state.throttle * 100)}%`, tx, ty + 122);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('W / S', tx, ty + 12 - 14);

  // --- Centre reticle and objective distance ---
  ctx.strokeStyle = 'rgba(255,233,196,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, H / 2); ctx.lineTo(W / 2 - 8, H / 2);
  ctx.moveTo(W / 2 + 8, H / 2); ctx.lineTo(W / 2 + 22, H / 2);
  ctx.moveTo(W / 2, H / 2 - 22); ctx.lineTo(W / 2, H / 2 - 8);
  ctx.moveTo(W / 2, H / 2 + 8); ctx.lineTo(W / 2, H / 2 + 22);
  ctx.stroke();
  if (objective && objectiveDist != null && mission.status === 'flying') {
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = mission.kind === 'rings' ? `NEXT RING — ${Math.round(objectiveDist)} m`
      : mission.kind === 'drop' ? `DROP ZONE — ${Math.round(objectiveDist)} m`
      : `RUNWAY 07 — ${Math.round(objectiveDist)} m`;
    ctx.fillText(label, W / 2, H / 2 + 52);
  }

  // --- Low fuel / damage warnings ---
  if (state.fuel > 0 && state.fuel < 25 && !state.crashed) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — land at the airfield to refuel', W / 2, 108);
  }
  if (state.fuel === 0 && !state.crashed) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FUEL EMPTY — gliding! Find the runway!', W / 2, 108);
  }
}
