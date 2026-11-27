// Golden Hour Courier: boot, game loop, keyboard + mouse input, screens
// (title / flying / paused / crashed / complete), parcel drops, crash
// debris, and the ?scene= presets the screenshots are taken from.
import { createFlightState, stepFlight } from './physics.js';
import { createMission, updateMission, nextObjective, MISSION_DEFS } from './missions.js';
import { renderScene, resetCamera } from './render.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { heightAt } from './terrain.js';
import { clamp, wrapAngle } from './util.js';
import { runAllDiagnostics } from './diagnostics.js';

const W = 1280, H = 720;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();

let screen = 'title'; // title | playing | paused | crashed | success
let flight = createFlightState();
let mission = createMission('rings');
let selectedMission = 0;
let fx = { parcels: [], smoke: [], debris: [] };
let toasts = [];
let keys = {};
let mouse = { x: 0, y: 0 };
let autopilot = false;
let time = 0;
let lastTick = 0;
let successAt = 0;
let smokeTimer = 0;

function toast(text) {
  toasts.push({ text, until: time + 3.2 });
  if (toasts.length > 3) toasts.shift();
}

function playSound(name) {
  if (name === 'ring') audio.ring();
  else if (name === 'thud') audio.thud();
  else if (name === 'success') audio.success();
  else if (name === 'crash') audio.crash();
}

function startMission(kind) {
  mission = createMission(kind);
  flight = createFlightState();
  fx = { parcels: [], smoke: [], debris: [] };
  toasts = [];
  autopilot = false;
  resetCamera(flight);
  screen = 'playing';
  toast(mission.blurb);
  if (kind === 'rings') toast('Fly through the amber rings, in order.');
  if (kind === 'drop') toast('The drop zone is the amber circle on the meadow.');
  if (kind === 'landing') toast('Take off with W, then come back and land on runway 07.');
}

function restart() {
  startMission(mission.kind);
}

function dropParcel() {
  if (screen !== 'playing' || mission.kind !== 'drop') return;
  if (mission.parcelsLeft <= 0) return;
  if (flight.onGround) return;
  mission.parcelsLeft--;
  fx.parcels.push({
    x: flight.x, y: flight.y - 1, z: flight.z,
    vx: Math.sin(flight.heading) * flight.speed * 0.6,
    vz: Math.cos(flight.heading) * flight.speed * 0.6,
    vy: -1,
  });
  toast('Parcel away!');
}

function burstDebris(x, y, z) {
  const colors = ['#e8702a', '#f2e3c6', '#3a3a40', '#ff7a1a'];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 14;
    fx.debris.push({
      x, y: y + 1, z,
      vx: Math.cos(a) * sp, vy: 3 + Math.random() * 10, vz: Math.sin(a) * sp,
      r: 0.5 + Math.random() * 1.1,
      color: colors[i % colors.length],
      life: 1.4 + Math.random() * 0.8,
    });
  }
}

// Gentle autopilot used by the ?scene= screenshot presets (and only there):
// steer toward the objective, hold a sensible altitude, keep 65% throttle.
function autopilotInput() {
  let obj = nextObjective(mission);
  const input = { pitch: 0, bank: 0, throttleUp: false, throttleDown: false };
  if (!obj) return input;
  // On the landing mission, once over the strip aim at its far end so the
  // plane flies straight down the runway instead of turning back to the
  // threshold it just passed.
  let pitchGain = 0.02;
  let pitchFloor = -1;
  let targetAlt = mission.kind === 'rings' && obj.y ? obj.y : 80;
  let thrTarget = 0.65;
  if (mission.kind === 'landing') {
    const dist0 = Math.hypot(obj.x - flight.x, obj.z - flight.z);
    targetAlt = clamp(dist0 * 0.12, 25, 90);
    if (dist0 < 300) thrTarget = 0.5;
    if (Math.abs(flight.x) < 40 && flight.z > -260 && flight.z < 220) {
      obj = { x: 0, y: 0, z: 220 };
      targetAlt = 1.2; // gentle exponential flare onto the strip
      // Pitch here is in input units: physics scales it by 0.55, so
      // -0.22 input is about -0.12 rad, a -4.8 m/s sink at most.
      pitchGain = 0.036;
      pitchFloor = -0.22;
    }
  }
  const dx = obj.x - flight.x, dz = obj.z - flight.z;
  const desiredHeading = Math.atan2(dx, dz);
  const err = wrapAngle(desiredHeading - flight.heading);
  input.bank = clamp(err * 1.4, -1, 1);
  input.pitch = clamp(Math.max(pitchFloor, (targetAlt - flight.y) * pitchGain), -1, 1);
  if (flight.onGround && flight.speed < 22) input.pitch = 0.6;
  if (flight.throttle < thrTarget) input.throttleUp = true;
  if (flight.throttle > thrTarget + 0.05) input.throttleDown = true;
  if (mission.kind === 'drop' && mission.parcelsLeft > 0) {
    const dist = Math.hypot(dx, dz);
    if (dist < 45 && flight.y < 75) dropParcel();
  }
  return input;
}

function readInput() {
  if (autopilot) return autopilotInput();
  return {
    pitch: (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0),
    bank: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0),
    throttleUp: !!keys.KeyW,
    throttleDown: !!keys.KeyS,
  };
}

// Screenshot presets: ?scene=cruise|takeoff|approach|drop starts the game
// at a fixed, lively moment with the autopilot holding the plane steady.
function applyScenePreset(scene) {
  const presets = {
    cruise: { kind: 'rings', x: 180, y: 90, z: -480, heading: 2.765, speed: 46, throttle: 0.7, fuel: 78 },
    takeoff: { kind: 'rings', x: 0, y: 1.1, z: 190, heading: Math.PI, speed: 0, throttle: 0.7, fuel: 100 },
    approach: { kind: 'landing', x: 26, y: 72, z: -720, heading: 0.05, speed: 40, throttle: 0.55, fuel: 64 },
    drop: { kind: 'drop', x: 250, y: 58, z: -860, heading: 0.12, speed: 34, throttle: 0.55, fuel: 71 },
  };
  const p = presets[scene];
  if (!p) return false;
  startMission(p.kind);
  flight.x = p.x; flight.y = p.y; flight.z = p.z;
  flight.heading = p.heading;
  flight.speed = p.speed;
  flight.throttle = p.throttle;
  flight.fuel = p.fuel;
  flight.onGround = p.y <= heightAt(p.x, p.z) + 1.2;
  if (scene === 'cruise') mission.ringIndex = 2;
  autopilot = true;
  resetCamera(flight);
  return true;
}

function update(dt) {
  time += dt;
  // Smoke puffs rising from the drop zone.
  if (mission.kind === 'drop') {
    smokeTimer -= dt;
    if (smokeTimer <= 0) {
      smokeTimer = 0.55;
      fx.smoke.push({
        x: mission.target.x + (Math.random() - 0.5) * 6,
        y: heightAt(mission.target.x, mission.target.z) + 2,
        z: mission.target.z + (Math.random() - 0.5) * 6,
        r: 2 + Math.random() * 2,
        alpha: 0.55,
        life: 3,
      });
    }
  }
  for (const s of fx.smoke) {
    s.y += 4 * dt;
    s.r += 1.5 * dt;
    s.alpha -= 0.18 * dt;
    s.life -= dt;
  }
  fx.smoke = fx.smoke.filter((s) => s.life > 0 && s.alpha > 0);
  for (const d of fx.debris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    d.vy -= 12 * dt;
    d.life -= dt;
  }
  fx.debris = fx.debris.filter((d) => d.life > 0);
  for (const p of fx.parcels) {
    p.vy -= 14 * dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.y += p.vy * dt;
  }

  if (screen !== 'playing') return;

  const events = [];
  const wasLanded = flight.landed;
  const wasCrashed = flight.crashed;
  stepFlight(flight, readInput(), dt);
  if (flight.landed && !wasLanded) events.push({ type: 'landed', vy: flight.touchdownVy });
  if (flight.crashed && !wasCrashed) {
    events.push({ type: 'crashed' });
    screen = 'crashed';
    burstDebris(flight.x, flight.y + 1, flight.z);
    playSound('crash');
  }

  const landedParcels = [];
  fx.parcels = fx.parcels.filter((p) => {
    if (p.y <= heightAt(p.x, p.z)) {
      landedParcels.push(p);
      return false;
    }
    return true;
  });
  for (const p of landedParcels) events.push({ type: 'parcel', x: p.x, z: p.z });

  const result = updateMission(mission, flight, events, dt);
  for (const t of result.toasts) toast(t);
  for (const s of result.sounds) playSound(s);
  if (mission.status === 'done' && !successAt) {
    successAt = time + 1.4;
    playSound('success');
  }
  if (successAt && time >= successAt) {
    screen = 'success';
    successAt = 0;
  }
  audio.engine(flight.throttle, flight.speed, flight.onGround);
  toasts = toasts.filter((t) => t.until > time);
}

function drawTitle() {
  ctx.fillStyle = 'rgba(20, 12, 8, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('GOLDEN HOUR COURIER', W / 2, 150);
  ctx.font = '22px Georgia, serif';
  ctx.fillStyle = '#f7b267';
  ctx.fillText('A bush-plane courier run through a valley at sunset', W / 2, 190);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c4';
  ctx.fillText('Fly Kite, the little orange high-wing, and earn your wings before dark.', W / 2, 222);

  // Mission cards, clickable and selectable with 1 / 2 / 3.
  const cardW = 340, cardH = 150, gap = 30;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2, y0 = 280;
  MISSION_DEFS.forEach((def, i) => {
    const x = x0 + i * (cardW + gap);
    const hovered = mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y0 && mouse.y <= y0 + cardH;
    const selected = selectedMission === i;
    ctx.fillStyle = selected ? 'rgba(255, 176, 32, 0.28)' : hovered ? 'rgba(255, 233, 196, 0.14)' : 'rgba(20, 14, 10, 0.66)';
    ctx.strokeStyle = selected ? '#ffb020' : 'rgba(255, 200, 130, 0.5)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y0, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`${i + 1} — ${def.title.toUpperCase()}`, W / 2 - totalW / 2 + i * (cardW + gap) + cardW / 2, y0 + 34);
    ctx.fillStyle = '#ffe9c4';
    ctx.font = '14px system-ui, sans-serif';
    wrapText(def.blurb, x + 18, y0 + 62, cardW - 36, 20);
  });

  ctx.fillStyle = '#ffe9c4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('ARROWS fly  ·  W / S throttle  ·  SPACE drop a parcel  ·  P pause  ·  M mute  ·  R restart', W / 2, 490);
  ctx.fillStyle = '#f7b267';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Click a mission, or press ENTER to fly', W / 2, 540);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 233, 196, 0.7)';
  ctx.fillText('Land on the runway to refuel. Watch the fuel gauge — a glide home is a long walk.', W / 2, 570);
}

function wrapText(text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawCenteredOverlay(title, titleColor, lines, footer) {
  ctx.fillStyle = 'rgba(20, 12, 8, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText(title, W / 2, 250);
  ctx.fillStyle = '#ffe9c4';
  ctx.font = '20px system-ui, sans-serif';
  let y = 310;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 34;
  }
  ctx.fillStyle = '#f7b267';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(footer, W / 2, y + 40);
}

function draw() {
  renderScene(ctx, flight, mission, fx, time);
  if (screen === 'playing' || screen === 'paused') {
    const obj = nextObjective(mission);
    const dist = obj ? Math.hypot(obj.x - flight.x, obj.z - flight.z) : null;
    drawHud(ctx, W, H, flight, mission, obj, dist);
    for (let i = 0; i < toasts.length; i++) {
      ctx.fillStyle = 'rgba(20, 14, 10, 0.72)';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const text = toasts[i].text;
      const tw = ctx.measureText(text).width;
      ctx.beginPath();
      ctx.roundRect(W / 2 - tw / 2 - 14, 128 + i * 34, tw + 28, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#ffe9c4';
      ctx.fillText(text, W / 2, 148 + i * 34);
    }
  }
  if (screen === 'title') drawTitle();
  if (screen === 'paused') {
    drawCenteredOverlay('PAUSED', '#ffe9c4', ['Take a breath. The valley will wait.'], 'Press P to keep flying');
  }
  if (screen === 'crashed') {
    drawCenteredOverlay('CRASHED', '#ff5a3c', [
      flight.crashReason,
      `Damage 100% — the courier walks home this time.`,
      `Score: ${mission.score}`,
    ], 'Press R to fly again');
  }
  if (screen === 'success') {
    drawCenteredOverlay('MISSION COMPLETE', '#7ddc7d', [
      mission.doneReason,
      `Final score: ${mission.score}`,
      mission.kind === 'rings' ? `Finished in ${mission.elapsed.toFixed(0)} seconds.` : '',
    ].filter(Boolean), 'Press R to fly another sortie');
  }
}

function tick(t) {
  const dt = Math.min(0.05, (t - lastTick) / 1000 || 0.016);
  lastTick = t;
  update(dt);
  draw();
  requestAnimationFrame(tick);
}

function titleClick(x, y) {
  const cardW = 340, cardH = 150, gap = 30;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2, y0 = 280;
  for (let i = 0; i < 3; i++) {
    const cx = x0 + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= y0 && y <= y0 + cardH) {
      selectedMission = i;
      startMission(MISSION_DEFS[i].kind);
      return;
    }
  }
  startMission(MISSION_DEFS[selectedMission].kind);
}

function canvasPos(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) * (W / rect.width),
    y: (ev.clientY - rect.top) * (H / rect.height),
  };
}

window.addEventListener('keydown', (ev) => {
  audio.unlock();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
    ev.preventDefault();
  }
  if (ev.repeat) return;
  keys[ev.code] = true;
  if (ev.code === 'Enter' && screen === 'title') {
    startMission(MISSION_DEFS[selectedMission].kind);
  } else if (ev.code === 'Digit1' && screen === 'title') {
    selectedMission = 0;
    startMission('rings');
  } else if (ev.code === 'Digit2' && screen === 'title') {
    selectedMission = 1;
    startMission('drop');
  } else if (ev.code === 'Digit3' && screen === 'title') {
    selectedMission = 2;
    startMission('landing');
  } else if (ev.code === 'KeyP' && (screen === 'playing' || screen === 'paused')) {
    screen = screen === 'playing' ? 'paused' : 'playing';
  } else if (ev.code === 'KeyM') {
    audio.setMuted(!audio.muted);
    toast(audio.muted ? 'Sound off' : 'Sound on');
  } else if (ev.code === 'KeyR' && screen !== 'title') {
    restart();
  } else if (ev.code === 'Space' && screen === 'playing') {
    dropParcel();
  }
});
window.addEventListener('keyup', (ev) => {
  keys[ev.code] = false;
});
canvas.addEventListener('mousemove', (ev) => {
  mouse = canvasPos(ev);
});
canvas.addEventListener('click', (ev) => {
  audio.unlock();
  const p = canvasPos(ev);
  if (screen === 'title') titleClick(p.x, p.y);
  else if (screen === 'playing') dropParcel();
  else if (screen === 'crashed' || screen === 'success') restart();
});

// Boot: title screen over a parked plane; ?scene= jumps straight into flight.
const params = new URLSearchParams(window.location.search);
if (params.get('selftest') === '1') {
  console.log('[selftest]', JSON.stringify(runAllDiagnostics()));
}
if (!applyScenePreset(params.get('scene') || '')) {
  resetCamera(flight);
} else {
  // ?ff=N fast-forwards the simulation N fixed steps at load, so a
  // screenshot shows a real mid-flight state instead of the preset pose.
  const ff = Math.min(parseInt(params.get('ff') || '0', 10) || 0, 1200);
  for (let i = 0; i < ff; i++) update(1 / 60);
  resetCamera(flight);
}
requestAnimationFrame(tick);
