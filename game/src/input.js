// Keyboard, mouse and pointer lock. The simulation only reads edges from
// pressed() and the accumulated mouse delta, so one browser event cannot leak
// into several fixed steps.
export function createInput(state, canvas, onLockLost) {
  const keys = Object.create(null);
  const pressed = new Set();
  let dx = 0;
  let dy = 0;
  let locked = false;
  let mouseDown = false;
  let firePressed = false;

  const block = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyB', 'KeyR', 'KeyG', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'ShiftLeft', 'ControlLeft']);

  function onKeyDown(event) {
    if (block.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    // Closing the buy menu is a user gesture, so ask for pointer lock here
    // rather than from the fixed step that handles KeyB.
    if (event.code === 'KeyB' && state.mode === 'buy' && state.buyOpen) lock();
    keys[event.code] = true;
    pressed.add(event.code);
  }
  function onKeyUp(event) {
    keys[event.code] = false;
  }
  function onBlur() {
    for (const code of Object.keys(keys)) keys[code] = false;
    pressed.clear();
  }
  function onMouseMove(event) {
    if (!locked) return;
    dx += event.movementX || 0;
    dy += event.movementY || 0;
  }
  function lock() {
    if (state.shot) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (error) {
      // Keyboard still plays when pointer lock is refused.
    }
  }
  function unlock() {
    if (document.pointerLockElement === canvas) {
      try { document.exitPointerLock(); } catch (error) { /* already released */ }
    }
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
    const playable = state.mode === 'live' || state.mode === 'planted';
    if (!locked && state.started && !state.paused && !state.shot && playable) {
      state.paused = true;
      onLockLost();
    }
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    if (!locked) {
      if (state.overlay) return;
      lock();
      return;
    }
    mouseDown = true;
    firePressed = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    pressed,
    lock,
    unlock,
    get locked() { return locked; },
    get mouseDown() { return mouseDown; },
    get firePressed() { return firePressed; },
    get mouseX() { return dx; },
    get mouseY() { return dy; },
    consumeMouse() { dx = 0; dy = 0; },
    flushMouse() { dx = 0; dy = 0; firePressed = false; },
    endStep() { pressed.clear(); firePressed = false; },
    onGesture() { if (!state.shot) lock(); },
  };
}
