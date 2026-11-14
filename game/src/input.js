// Keyboard, mouse and pointer lock. Edge-triggered presses are consumed by the simulation so a
// fixed-step catch-up cannot fire the same key or click twice.
export function createInput(canvas, onLockChange = null) {
  const keys = Object.create(null);
  const pressed = new Set();
  const mouse = [false, false, false];
  const mousePressed = new Set();
  const state = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    locked: false,
    takeLookX: 0,
    takeLookY: 0,
  };

  const movementKeys = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyE', 'KeyR', 'KeyG', 'KeyB',
    'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space', 'Tab',
    'Digit1', 'Digit2', 'Digit3', 'Digit4',
  ]);

  function setLocked(locked) {
    state.locked = locked;
    if (!locked) {
      mouse[0] = false;
      mouse[1] = false;
      mouse[2] = false;
      state.mouseDX = 0;
      state.mouseDY = 0;
    }
    if (onLockChange) onLockChange(locked);
  }

  function onKeyDown(event) {
    if (event.repeat) {
      if (movementKeys.has(event.code)) event.preventDefault();
      return;
    }
    keys[event.code] = true;
    pressed.add(event.code);
    if (movementKeys.has(event.code)) event.preventDefault();
  }

  function onKeyUp(event) {
    keys[event.code] = false;
    if (movementKeys.has(event.code)) event.preventDefault();
  }

  function onMouseDown(event) {
    if (event.button < 3) {
      mouse[event.button] = true;
      mousePressed.add(event.button);
    }
  }

  function onMouseUp(event) {
    if (event.button < 3) mouse[event.button] = false;
  }

  function onMouseMove(event) {
    if (!state.locked) return;
    state.mouseDX += event.movementX || 0;
    state.mouseDY += event.movementY || 0;
  }

  function onBlur() {
    for (const code of Object.keys(keys)) keys[code] = false;
    mouse[0] = false;
    mouse[1] = false;
    mouse[2] = false;
    pressed.clear();
    mousePressed.clear();
  }

  function onLockChangeEvent() {
    setLocked(document.pointerLockElement === canvas);
  }

  function requestLock() {
    if (document.pointerLockElement === canvas) return;
    try {
      const request = canvas.requestPointerLock();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch {
      // Browsers refuse without a gesture; the next click retries.
    }
  }

  function exitLock() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function isDown(code) {
    return keys[code] === true;
  }

  function consumeKey(code) {
    if (!pressed.has(code)) return false;
    pressed.delete(code);
    return true;
  }

  function isMouseDown(button) {
    return mouse[button] === true;
  }

  function consumeMouse(button) {
    if (!mousePressed.has(button)) return false;
    mousePressed.delete(button);
    return true;
  }

  function consumeLook() {
    state.takeLookX = state.mouseDX;
    state.takeLookY = state.mouseDY;
    state.mouseDX = 0;
    state.mouseDY = 0;
  }

  function endFrame() {
    pressed.clear();
    mousePressed.clear();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChangeEvent);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  Object.assign(state, {
    requestLock,
    exitLock,
    isDown,
    consumeKey,
    isMouseDown,
    consumeMouse,
    consumeLook,
    endFrame,
  });
  return state;
}
