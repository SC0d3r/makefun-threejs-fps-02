// Keyboard and mouse are captured here; game logic consumes edges once per
// fixed step so input feels the same at any render rate.
export function createInput(canvas) {
  const keys = new Set();
  const tapped = new Set();
  const released = new Set();
  const mouse = { dx: 0, dy: 0, down: false, clicked: false, wheel: 0 };
  const listeners = { lock: null, unlock: null };
  let locked = false;
  let enabled = true;

  const onKeyDown = (event) => {
    if (!enabled) return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Tab', 'ShiftLeft', 'ControlLeft'].includes(event.code)) {
      event.preventDefault();
    }
    if (!keys.has(event.code)) tapped.add(event.code);
    keys.add(event.code);
  };
  const onKeyUp = (event) => {
    if (keys.delete(event.code)) released.add(event.code);
  };
  const onMouseMove = (event) => {
    if (!locked) return;
    mouse.dx += event.movementX;
    mouse.dy += event.movementY;
  };
  const onMouseDown = (event) => {
    if (!enabled) return;
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  };
  const onMouseUp = (event) => {
    if (event.button === 0) mouse.down = false;
  };
  const onWheel = (event) => {
    if (locked) mouse.wheel += Math.sign(event.deltaY);
  };
  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
    if (locked) listeners.lock?.();
    else listeners.unlock?.();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  const requestLock = () => {
    if (!locked) canvas.requestPointerLock?.();
  };
  const releaseLock = () => {
    if (document.pointerLockElement) document.exitPointerLock();
  };

  return {
    keys,
    mouse,
    get locked() {
      return locked;
    },
    setEnabled(value) {
      enabled = value;
      if (!value) {
        keys.clear();
        mouse.down = false;
      }
    },
    onLock(handler) {
      listeners.lock = handler;
    },
    onUnlock(handler) {
      listeners.unlock = handler;
    },
    requestLock,
    releaseLock,
    isDown(code) {
      return keys.has(code);
    },
    pressed(code) {
      return tapped.has(code);
    },
    released(code) {
      return released.has(code);
    },
    consumeClick() {
      const hit = mouse.clicked;
      mouse.clicked = false;
      return hit;
    },
    endStep() {
      tapped.clear();
      released.clear();
      mouse.clicked = false;
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.wheel = 0;
    },
  };
}
