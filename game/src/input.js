// Keyboard and mouse input. Held keys give a steering direction; one-shot presses
// (enter a car, punch, shoot, pause, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// The mouse aims the pistol; clicking also confirms on menus.

export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_SHOOT = 4;
export const ACTION_PAUSE = 8;
export const ACTION_CONFIRM = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Enter']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (SPRINT.has(event.code)) {
      held.add(event.code);
    } else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (SHOOT.has(event.code)) actions |= ACTION_SHOOT;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.inside = true;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    actions |= ACTION_SHOOT;
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised steering vector from the held movement keys. */
    steering() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        if (RIGHT.has(code)) x += 1;
        if (UP.has(code)) y -= 1;
        if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    sprinting() {
      for (const code of held) if (SPRINT.has(code)) return true;
      return false;
    },
    mouse() {
      return mouse;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
