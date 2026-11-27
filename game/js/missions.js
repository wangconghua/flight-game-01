// Three sorties for the courier. Each mission owns its objectives, its
// score and its completion, and reports toasts and sounds back to main.js.
export const MISSION_DEFS = [
  {
    kind: 'rings',
    title: 'Ring Run',
    blurb: 'Thread all six valley rings in order. Smooth throttle and gentle banks win.',
  },
  {
    kind: 'drop',
    title: 'Parcel Drop',
    blurb: 'Carry the parcel to the amber meadow and drop it low and slow. One parcel, one chance.',
  },
  {
    kind: 'landing',
    title: 'Valley Landing',
    blurb: 'Take off, fly the valley, and put Kite down softly on runway 07. Mind the fuel.',
  },
];

function ringCourse() {
  const rings = [];
  for (let i = 0; i < 6; i++) {
    rings.push({
      x: 300 * Math.sin(i * 0.9 + 0.3),
      y: 58 + 38 * Math.sin(i * 1.15 + 0.4),
      z: -220 - i * 230,
      r: 16,
      passed: false,
    });
  }
  return rings;
}

export function createMission(kind) {
  const def = MISSION_DEFS.find((m) => m.kind === kind) || MISSION_DEFS[0];
  return {
    kind: def.kind,
    title: def.title,
    blurb: def.blurb,
    rings: def.kind === 'rings' ? ringCourse() : [],
    ringIndex: 0,
    target: { x: 260, z: -760 },
    parcelsLeft: def.kind === 'drop' ? 1 : 0,
    score: 0,
    elapsed: 0,
    status: 'flying', // flying | done
    doneReason: '',
  };
}

export function nextObjective(mission) {
  if (mission.kind === 'rings') {
    return mission.rings[mission.ringIndex] || null;
  }
  if (mission.kind === 'drop') {
    return { x: mission.target.x, y: 0, z: mission.target.z };
  }
  return { x: 0, y: 0, z: -220 }; // runway threshold
}

// events: [{ type: 'landed' | 'parcel', x, z, vy? }] from the game loop.
// Returns { toasts: string[], sounds: string[] }.
export function updateMission(mission, state, events, dt) {
  const out = { toasts: [], sounds: [] };
  if (mission.status !== 'flying') return out;
  mission.elapsed += dt;

  if (mission.kind === 'rings') {
    const ring = mission.rings[mission.ringIndex];
    if (ring) {
      const dx = state.x - ring.x, dy = state.y - ring.y, dz = state.z - ring.z;
      if (Math.hypot(dx, dy, dz) < ring.r + 5) {
        ring.passed = true;
        mission.ringIndex++;
        mission.score += 500;
        out.toasts.push(`Ring ${mission.ringIndex} of 6 — +500`);
        out.sounds.push('ring');
        if (mission.ringIndex >= mission.rings.length) {
          const bonus = Math.max(0, Math.round(1200 - mission.elapsed * 5));
          mission.score += bonus;
          mission.status = 'done';
          mission.doneReason = `All six rings flown. Time bonus +${bonus}.`;
          out.sounds.push('success');
        }
      }
    }
  }

  for (const ev of events) {
    if (ev.type === 'parcel' && mission.kind === 'drop') {
      const dist = Math.hypot(ev.x - mission.target.x, ev.z - mission.target.z);
      const pts = Math.max(0, Math.round(1000 - dist * 8));
      mission.score += pts;
      mission.status = 'done';
      mission.doneReason = pts >= 700
        ? `Dead centre — the parcel landed ${dist.toFixed(0)} m from the flag. +${pts}`
        : pts > 0
          ? `Parcel down ${dist.toFixed(0)} m from the flag. +${pts}`
          : `Parcel missed the meadow by ${dist.toFixed(0)} m. No points.`;
      out.toasts.push(mission.doneReason);
      out.sounds.push(pts >= 700 ? 'success' : 'thud');
    }
    if (ev.type === 'landed') {
      if (mission.kind === 'landing') {
        const softness = Math.max(0, 1 - Math.abs(ev.vy) / 4.5);
        const pts = Math.round(400 + 600 * softness);
        mission.score += pts;
        mission.status = 'done';
        mission.doneReason = softness > 0.8
          ? `Butter-smooth touchdown. +${pts}`
          : `Down safe, a little firm. +${pts}`;
        out.toasts.push(mission.doneReason);
        out.sounds.push('thud');
      } else if (state.fuel < 100) {
        // Any runway stop refuels the plane.
        state.fuel = 100;
        out.toasts.push('Refuelled at the airfield — tanks full.');
      }
    }
  }
  return out;
}
