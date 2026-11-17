// Vic's story: four jobs that take the player across Solara Bay. Each mission is a
// small state machine of steps; step() watches the world and fires events when a
// step or a whole job is done. The HUD reads currentObjective() for the text, the
// gold marker and the progress bar.

import { MISSIONS, PLACES } from './config.js';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createMissions(city, random, entities, police) {
  const state = entities.state;
  let index = 0;
  let stepIndex = 0;
  let crewPicked = 0;
  let crewMembers = [];
  let vaultTimer = 0;
  let started = false;

  function current() {
    return MISSIONS[index] ?? null;
  }

  function start(events) {
    if (started || !current()) return;
    started = true;
    stepIndex = 0;
    crewPicked = 0;
    vaultTimer = 0;
    const mission = current();
    if (mission.id === 'heat') {
      police.wanted = 2;
    }
    if (mission.id === 'crew') {
      crewMembers = [];
      const spots = [
        { x: 1000, y: 300 },
        { x: 1800, y: 1100 },
      ];
      for (const spot of spots) {
        const ped = entities.spawnPed(spot.x, spot.y, 'crew');
        ped.speed = 0;
        crewMembers.push(ped);
      }
    }
    events.push({ kind: 'missionStart', title: mission.title, intro: mission.intro });
  }

  function completeStep(events) {
    stepIndex += 1;
  }

  function completeMission(events) {
    const mission = current();
    const reward = mission.reward;
    state.player.money += reward;
    events.push({ kind: 'missionComplete', title: mission.title, reward });
    index += 1;
    stepIndex = 0;
    crewPicked = 0;
    vaultTimer = 0;
    crewMembers = [];
    if (!current()) {
      events.push({ kind: 'storyComplete' });
      return;
    }
    const next = current();
    if (next.id === 'heat') police.wanted = 2;
    if (next.id === 'crew') {
      const spots = [
        { x: 1000, y: 300 },
        { x: 1800, y: 1100 },
      ];
      for (const spot of spots) {
        const ped = entities.spawnPed(spot.x, spot.y, 'crew');
        ped.speed = 0;
        crewMembers.push(ped);
      }
    }
    events.push({ kind: 'missionStart', title: next.title, intro: next.intro });
  }

  function step(dt, events) {
    if (!started) {
      start(events);
      return events;
    }
    const mission = current();
    if (!mission) return events;
    const player = state.player;

    if (mission.id === 'wheels') {
      if (stepIndex === 0) {
        if (!player.onFoot && player.car && player.car.type === 'taxi') completeStep(events);
      } else if (dist2(player.x, player.y, PLACES.docks.x, PLACES.docks.y) < 70 * 70) {
        completeMission(events);
      }
    } else if (mission.id === 'heat') {
      if (police.wanted === 0) completeMission(events);
    } else if (mission.id === 'crew') {
      if (stepIndex === 0) {
        // Crew members wait where they stand until the player's car stops by.
        for (const ped of crewMembers) {
          ped.target = { x: ped.x, y: ped.y };
          if (!player.onFoot && player.car && dist2(player.x, player.y, ped.x, ped.y) < 50 * 50) {
            crewPicked += 1;
            const at = state.peds.indexOf(ped);
            if (at >= 0) state.peds.splice(at, 1);
            events.push({ kind: 'crewPicked', count: crewPicked });
            if (crewPicked >= 2) completeStep(events);
            break;
          }
        }
      } else if (dist2(player.x, player.y, PLACES.hideout.x, PLACES.hideout.y) < 70 * 70) {
        completeMission(events);
      }
    } else if (mission.id === 'score') {
      if (stepIndex === 0) {
        if (dist2(player.x, player.y, PLACES.bank.x, PLACES.bank.y) < 70 * 70) {
          completeStep(events);
          police.wanted = 3;
          events.push({ kind: 'wantedUp', level: 3 });
        }
      } else if (stepIndex === 1) {
        if (dist2(player.x, player.y, PLACES.bank.x, PLACES.bank.y) < 90 * 90) {
          vaultTimer += dt;
          if (vaultTimer >= 8) {
            vaultTimer = 8;
            completeStep(events);
          }
        } else {
          vaultTimer = Math.max(0, vaultTimer - dt * 0.5);
        }
      } else if (dist2(player.x, player.y, PLACES.hideout.x, PLACES.hideout.y) < 70 * 70) {
        completeMission(events);
      }
    }
    return events;
  }

  function currentObjective() {
    const mission = current();
    if (!mission) {
      return { text: 'Free roam — Solara Bay is yours. Earn cash, lose the heat, have fun.', marker: null, progress: null };
    }
    const player = state.player;
    if (mission.id === 'wheels') {
      if (stepIndex === 0) {
        const taxi = state.cars.find((c) => c.type === 'taxi');
        return {
          text: 'Steal a taxi',
          marker: taxi ? { x: taxi.x, y: taxi.y } : { x: 1400, y: 800 },
          progress: null,
        };
      }
      return { text: 'Deliver the package to the East Docks', marker: PLACES.docks, progress: null };
    }
    if (mission.id === 'heat') {
      return {
        text: `Lose the heat — ${police.wanted} star${police.wanted === 1 ? '' : 's'} left. Lay low at the Hideout.`,
        marker: PLACES.hideout,
        progress: null,
      };
    }
    if (mission.id === 'crew') {
      if (stepIndex === 0) {
        const next = crewMembers.find((ped) => state.peds.includes(ped));
        return {
          text: `Pick up the crew (${crewPicked}/2)`,
          marker: next ? { x: next.x, y: next.y } : PLACES.hideout,
          progress: null,
        };
      }
      return { text: 'Drive the crew to the Hideout', marker: PLACES.hideout, progress: null };
    }
    if (mission.id === 'score') {
      if (stepIndex === 0) return { text: 'Reach Solara Bank', marker: PLACES.bank, progress: null };
      if (stepIndex === 1) {
        return {
          text: `Crack the vault — hold inside (${Math.ceil(8 - vaultTimer)}s)`,
          marker: PLACES.bank,
          progress: vaultTimer / 8,
        };
      }
      return { text: 'Escape to the Hideout', marker: PLACES.hideout, progress: null };
    }
    return { text: mission.title, marker: null, progress: null };
  }

  function reset() {
    index = 0;
    stepIndex = 0;
    crewPicked = 0;
    crewMembers = [];
    vaultTimer = 0;
    started = false;
  }

  function setProgress(missionIndex, missionStep, vault) {
    // For staged screenshots: jump straight to a mission and step.
    index = Math.max(0, Math.min(MISSIONS.length, missionIndex));
    stepIndex = missionStep;
    vaultTimer = vault ?? 0;
    started = true;
    crewPicked = 0;
    crewMembers = [];
  }

  return {
    get index() {
      return index;
    },
    get storyComplete() {
      return index >= MISSIONS.length;
    },
    get crewPickedCount() {
      return crewPicked;
    },
    current,
    start,
    reset,
    step,
    currentObjective,
    setProgress,
  };
}
