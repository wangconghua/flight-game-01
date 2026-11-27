// Arcade flight model for the bush plane: throttle sets target speed,
// bank turns the nose, pitch trades speed for height, and a stall drops
// the nose when the airspeed gets too low. Fuel burns with throttle;
// damage comes from hard touchdowns and terrain strikes.
import { clamp } from './util.js';
import { heightAt, onRunway } from './terrain.js';

export function createFlightState() {
  return {
    x: 0, y: 1.1, z: 180,
    heading: Math.PI, // facing -z, down the valley
    pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    vy: 0,
    fuel: 100, damage: 0,
    onGround: true,
    crashed: false, crashReason: '',
    landed: false, touchdownVy: 0,
  };
}

// input: { pitch: -1..1 (up positive), bank: -1..1 (right positive),
//          throttleUp, throttleDown } — all from keyboard or autopilot.
export function stepFlight(state, input, dt) {
  if (state.crashed) return;
  const authority = state.speed < 16 ? 0.4 : 1;

  if (input.throttleUp) state.throttle = clamp(state.throttle + 0.5 * dt, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - 0.5 * dt, 0, 1);

  // Fuel: cruise at 70% throttle lasts about four minutes.
  if (state.fuel > 0 && state.throttle > 0) {
    state.fuel = Math.max(0, state.fuel - (0.1 + state.throttle * 0.42) * dt);
    if (state.fuel === 0) state.throttle = 0;
  }

  const groundCap = state.onGround ? 25 : 62;
  const targetSpeed = state.fuel > 0
    ? Math.min(12 + state.throttle * 50, groundCap)
    : 0;
  const accel = targetSpeed > state.speed ? 5 : 8;
  state.speed += clamp(targetSpeed - state.speed, -accel * dt, accel * dt);

  // Bank toward the commanded roll; the bank turns the heading.
  // input.bank +1 means bank right (right wing down): roll is negative
  // for a right bank in plane-local space, and a right bank turns the
  // nose clockwise, i.e. the heading grows.
  const rollTarget = -input.bank * 1.05 * authority;
  state.roll += (rollTarget - state.roll) * Math.min(1, 3 * dt);
  const turnRate = Math.tan(state.roll) * 9.81 / Math.max(state.speed, 14);
  state.heading -= turnRate * dt;

  // Pitch toward the commanded pitch; a stall forces the nose down.
  let pitchTarget = input.pitch * 0.55 * authority;
  if (state.speed < 17 && !state.onGround) pitchTarget = Math.min(pitchTarget, -0.25);
  state.pitch += (pitchTarget - state.pitch) * Math.min(1, 2.5 * dt);

  state.vy = state.speed * Math.sin(state.pitch);
  if (state.onGround) {
    state.vy = 0;
    // Rolling takeoff: enough speed and a pull lifts off.
    if (state.speed > 20 && state.pitch > 0.12) {
      state.onGround = false;
      state.y = heightAt(state.x, state.z) + 1.3;
    }
  }

  const cosP = Math.cos(state.pitch);
  state.x += Math.sin(state.heading) * state.speed * cosP * dt;
  state.z += Math.cos(state.heading) * state.speed * cosP * dt;
  state.y += state.vy * dt;

  // Ground contact.
  const groundY = heightAt(state.x, state.z) + 1.1;
  if (state.y <= groundY) {
    const soft = Math.abs(state.vy) <= 4.5 && state.speed <= 46 &&
      Math.abs(state.pitch) < 0.22 && Math.abs(state.roll) < 0.5;
    if (state.onGround) {
      state.y = groundY;
    } else if (onRunway(state.x, state.z) && soft) {
      state.onGround = true;
      state.landed = true;
      state.touchdownVy = state.vy;
      state.y = groundY;
      state.vy = 0;
      state.pitch = 0;
      state.roll *= 0.3;
    } else if (state.vy < -5) {
      state.crashed = true;
      state.crashReason = state.speed > 30
        ? 'Flew into the hillside at speed.'
        : 'Stalled into the ground.';
      state.damage = 100;
      state.y = groundY;
    } else {
      // Hard bounce: damage, a hop and a speed penalty.
      state.damage = Math.min(100, state.damage + 12 + Math.abs(state.vy) * 3);
      state.y = groundY + 1.5;
      state.vy = 2.5;
      state.pitch = 0.1;
      state.speed *= 0.75;
      if (state.damage >= 100) {
        state.crashed = true;
        state.crashReason = 'Airframe broke up after repeated hard hits.';
      }
    }
  }

  // Rolling on the ground slows the plane unless power is applied.
  if (state.onGround && !state.crashed) {
    state.speed = Math.max(0, state.speed - 6 * dt * (state.throttle < 0.15 ? 1 : 0));
  }
}
