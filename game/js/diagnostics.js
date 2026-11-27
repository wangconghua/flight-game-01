// Self-checks for the game world: terrain shape, mission layout and the
// flight model. These run only when the page is opened with ?selftest=1
// (they log a JSON report to the console) and never touch the game loop.
import { heightAt, onRunway, RUNWAY } from './terrain.js';
import { createFlightState, stepFlight } from './physics.js';
import { createMission, MISSION_DEFS, nextObjective } from './missions.js';

// The terrain must be flyable: no cliff steps between neighbouring samples.
export function checkTerrainContinuity() {
  let worst = 0;
  let worstAt = null;
  for (let x = -900; x <= 900; x += 30) {
    for (let z = -1500; z <= 400; z += 30) {
      const step = Math.abs(heightAt(x + 30, z) - heightAt(x, z));
      if (step > worst) {
        worst = step;
        worstAt = [x, z];
      }
    }
  }
  return {
    name: 'terrain-continuity',
    pass: worst < 14,
    detail: `worst 30m step ${worst.toFixed(2)}m at ${worstAt}`,
  };
}

// The runway must sit on flat ground, or landings would be a lottery.
export function checkRunwayFlat() {
  let min = Infinity, max = -Infinity;
  for (let x = -RUNWAY.halfWidth; x <= RUNWAY.halfWidth; x += 4) {
    for (let z = -RUNWAY.halfLength; z <= RUNWAY.halfLength; z += 20) {
      const h = heightAt(x, z);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  }
  return {
    name: 'runway-flat',
    pass: max - min < 1.2,
    detail: `runway height range ${min.toFixed(2)}..${max.toFixed(2)}m`,
  };
}

// Every mission definition must be distinct and complete.
export function checkMissionDefs() {
  const kinds = new Set(MISSION_DEFS.map((m) => m.kind));
  const complete = MISSION_DEFS.every((m) => m.title && m.blurb && m.blurb.length > 20);
  return {
    name: 'mission-defs',
    pass: kinds.size === MISSION_DEFS.length && complete && MISSION_DEFS.length === 3,
    detail: `${MISSION_DEFS.length} missions, kinds: ${[...kinds].join(', ')}`,
  };
}

// The ring course must be reachable: rings in the sky, close enough together.
export function checkRingCourse() {
  const mission = createMission('rings');
  let ok = true;
  let detail = '';
  for (let i = 0; i < mission.rings.length; i++) {
    const r = mission.rings[i];
    if (r.y < 20 || r.y > 200) {
      ok = false;
      detail = `ring ${i} at y=${r.y.toFixed(0)} out of band`;
    }
    if (i > 0) {
      const p = mission.rings[i - 1];
      const d = Math.hypot(r.x - p.x, r.y - p.y, r.z - p.z);
      if (d > 400) {
        ok = false;
        detail = `rings ${i - 1}..${i} are ${d.toFixed(0)}m apart`;
      }
    }
  }
  if (ok) detail = `${mission.rings.length} rings, all in band and in reach`;
  return { name: 'ring-course', pass: ok, detail };
}

// The flight model must gain speed with throttle, climb with pitch, burn
// fuel, and crash when flown into a hillside.
export function checkPhysicsSanity() {
  const checks = [];
  const s = createFlightState();
  s.y = 120;
  s.onGround = false;
  s.throttle = 1;
  for (let i = 0; i < 600; i++) stepFlight(s, { pitch: 0, bank: 0, throttleUp: false, throttleDown: false }, 1 / 60);
  checks.push(['full throttle reaches cruise speed', s.speed > 40]);
  checks.push(['fuel burns', s.fuel < 100]);
  const yBefore = s.y;
  for (let i = 0; i < 300; i++) stepFlight(s, { pitch: 1, bank: 0, throttleUp: false, throttleDown: false }, 1 / 60);
  checks.push(['pitch up climbs', s.y > yBefore + 20]);
  const dive = createFlightState();
  dive.y = 120;
  dive.onGround = false;
  dive.speed = 45;
  dive.throttle = 0.5;
  for (let i = 0; i < 900 && !dive.crashed; i++) {
    stepFlight(dive, { pitch: -1, bank: 0, throttleUp: false, throttleDown: false }, 1 / 60);
  }
  checks.push(['diving into terrain crashes', dive.crashed]);
  const taxi = createFlightState();
  taxi.throttle = 1;
  for (let i = 0; i < 900 && !taxi.crashed; i++) {
    stepFlight(taxi, { pitch: 0.6, bank: 0, throttleUp: false, throttleDown: false }, 1 / 60);
    if (!taxi.onGround) break;
  }
  checks.push(['takeoff roll lifts off', !taxi.onGround]);
  const failed = checks.filter((c) => !c[1]).map((c) => c[0]);
  return {
    name: 'physics-sanity',
    pass: failed.length === 0,
    detail: failed.length ? `failed: ${failed.join('; ')}` : `${checks.length} sub-checks passed`,
  };
}

// Banking right (input.bank +1) must turn the nose clockwise: from a
// south heading the compass must grow toward west.
export function checkBankTurnsRight() {
  const s = createFlightState();
  s.y = 120;
  s.onGround = false;
  s.speed = 40;
  s.throttle = 0.6;
  s.heading = Math.PI;
  for (let i = 0; i < 180; i++) {
    stepFlight(s, { pitch: 0, bank: 1, throttleUp: false, throttleDown: false }, 1 / 60);
  }
  const deg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;
  return {
    name: 'bank-turns-right',
    pass: deg > 180 && deg < 270,
    detail: `heading went 180 -> ${deg.toFixed(0)} deg under right bank`,
  };
}

// Every mission must expose a next objective the HUD can point at.
export function checkObjectives() {
  const kinds = MISSION_DEFS.map((m) => m.kind);
  const missing = kinds.filter((k) => !nextObjective(createMission(k)));
  return {
    name: 'objectives',
    pass: missing.length === 0,
    detail: missing.length ? `no objective for: ${missing.join(', ')}` : 'all missions have objectives',
  };
}

export function runAllDiagnostics() {
  return [
    checkTerrainContinuity(),
    checkRunwayFlat(),
    checkMissionDefs(),
    checkRingCourse(),
    checkPhysicsSanity(),
    checkBankTurnsRight(),
    checkObjectives(),
  ];
}
