// Estado base
const state = {
  running: false,
  muted: false,
  power: 100,
  hour: 0, // 0 = 12AM, 5 = 5AM
  viewYaw: 0, // -1 izquierda, 0 centro, +1 derecha
  inCams: false,
  doors: { left: false, right: false },
  lights: { left: false, right: false },
  animatronics: {
    freddy: { room: "stage", aggression: 0.2 },
    bonnie: { room: "stage", aggression: 0.35 },
    chica:  { room: "stage", aggression: 0.30 },
  }
};

// Referencias UI
const el = {
  menu: document.getElementById("menu"),
  btnPlay: document.getElementById("btnPlay"),
  btnContinue: document.getElementById("btnContinue"),
  btnMute: document.getElementById("btnMute"),
  hud: document.getElementById("hud"),
  scene: document.getElementById("scene"),
  office: document.getElementById("office"),
  btnCam: document.getElementById("btnCam"),
  cams: document.getElementById("cams"),
  camFeed: document.getElementById("camFeed"),
  closeCams: document.getElementById("closeCams"),
  doorLeft: document.getElementById("doorLeft"),
  doorRight: document.getElementById("doorRight"),
  lightLeft: document.getElementById("lightLeft"),
  lightRight: document.getElementById("lightRight"),
  jumpscare: document.getElementById("jumpscare"),
  jumpscareImg: document.getElementById("jumpscareImg"),
  power: document.getElementById("powerVal"),
  time: document.getElementById("time"),
};

// Iniciar juego
el.btnPlay.addEventListener("click", () => startGame(true));
el.btnContinue.addEventListener("click", () => startGame(false));
el.btnMute.addEventListener("click", () => { state.muted = !state.muted; el.btnMute.textContent = state.muted ? "Unmute" : "Mute"; });

function startGame(reset) {
  if (reset) {
    state.power = 100;
    state.hour = 0;
    for (const k in state.animatronics) state.animatronics[k].room = "stage";
  }
  state.running = true;
  el.menu.classList.add("hidden");
  el.hud.classList.remove("hidden");
  tick();
}

// Paneo por mouse (izq/der)
window.addEventListener("mousemove", (e) => {
  if (!state.running || state.inCams) return;
  const x = e.clientX / window.innerWidth; // 0..1
  // Mapear a yaw: izquierda -1, centro 0, derecha +1 con zona muerta
  const dead = 0.12;
  let yaw = (x - 0.5) * 2; // -1..1
  if (Math.abs(yaw) < dead) yaw = 0;
  yaw = Math.max(-1, Math.min(1, yaw));
  state.viewYaw = yaw;
  applyView();
});

function applyView() {
  // rotación leve y desplazamiento para dar sensación 3D
  const maxRot = 10;   // grados
  const maxShift = 40; // px
  const r = state.viewYaw * maxRot;
  const s = state.viewYaw * maxShift;
  el.office.style.transform = `translateX(${s}px) rotateY(${r}deg)`;
}

// Botones cámaras
el.btnCam.addEventListener("click", () => {
  state.inCams = true;
  el.cams.classList.remove("hidden");
});
el.closeCams.addEventListener("click", closeCams);

document.querySelectorAll(".map button").forEach(btn => {
  btn.addEventListener("click", () => {
    const cam = btn.dataset.cam;
    el.camFeed.src = `assets/cams/${cam}.png`;
  });
});

function closeCams() {
  state.inCams = false;
  el.cams.classList.add("hidden");
}

// Puertas y luces
el.doorLeft.addEventListener("click", () => {
  state.doors.left = !state.doors.left;
  el.doorLeft.style.borderColor = state.doors.left ? "#5ee1ff" : "#2a313c";
});
el.doorRight.addEventListener("click", () => {
  state.doors.right = !state.doors.right;
  el.doorRight.style.borderColor = state.doors.right ? "#5ee1ff" : "#2a313c";
});
el.lightLeft.addEventListener("click", () => {
  state.lights.left = !state.lights.left;
  el.lightLeft.style.borderColor = state.lights.left ? "#ffd966" : "#2a313c";
});
el.lightRight.addEventListener("click", () => {
  state.lights.right = !state.lights.right;
  el.lightRight.style.borderColor = state.lights.right ? "#ffd966" : "#2a313c";
});

// Reloj y consumo de energía
function updateClockPower(dt) {
  // Avanza tiempo cada ~60s por hora de juego (ajustable)
  // Consumo por puertas/luces/cámaras
  const use =
    (state.doors.left ? 0.08 : 0) +
    (state.doors.right ? 0.08 : 0) +
    (state.lights.left ? 0.05 : 0) +
    (state.lights.right ? 0.05 : 0) +
    (state.inCams ? 0.06 : 0) + 0.02; // base

  state.power = Math.max(0, state.power - use * dt);

  // Hora cambia cada 60 "segundos" simulados
  hourAccumulator += dt;
  if (hourAccumulator >= 60) {
    hourAccumulator = 0;
    state.hour = Math.min(5, state.hour + 1);
  }

  const hourLabels = ["12:00 AM","1:00 AM","2:00 AM","3:00 AM","4:00 AM","5:00 AM"];
  el.time.textContent = hourLabels[state.hour];
  el.power.textContent = `${Math.round(state.power)}%`;
}

let lastT = 0;
let hourAccumulator = 0;

function tick(t=performance.now()) {
  if (!state.running) return;
  const dt = (t - lastT) / 1000 || 0.016; // segundos
  lastT = t;

  updateClockPower(dt);
  aiStep(dt);

  // Condiciones de victoria/derrota
  if (state.power <= 0) {
    // Apagón: animatrónicos avanzan más
    for (const k in state.animatronics) state.animatronics[k].aggression = Math.min(1, state.animatronics[k].aggression + 0.15);
  }
  requestAnimationFrame(tick);
}

// IA simple: animatrónicos avanzan por rutas hacia la oficina
const routes = {
  freddy: ["stage","hall","closet","office"],
  bonnie: ["stage","hall","office_left"],
  chica:  ["stage","kitchen","office_right"],
};

// Probabilidad de avanzar depende de agresión y si estás en cámaras
function aiStep(dt) {
  const camDebuff = state.inCams ? 0.7 : 1.0;
  for (const name in state.animatronics) {
    const a = state.animatronics[name];
    const route = routes[name];
    const idx = route.indexOf(a.room);
    if (idx < route.length - 1) {
      const p = a.aggression * camDebuff * dt; // probabilidad por segundo
      if (Math.random() < p) {
        a.room = route[idx + 1];
        // actualiza feed si estás mirando la room actual
        // opcional: overlays de estática
      }
    } else {
      // En oficina: chequear puertas correspondientes
      let caught = false;
      if (a.room === "office_left" && !state.doors.left) caught = true;
      if (a.room === "office_right" && !state.doors.right) caught = true;
      if (a.room === "office") caught = true; // Freddy frontal

      if (caught) {
        triggerJumpscare(name);
      } else {
        // Reaparece al inicio tras intentar
        a.room = route[0];
      }
    }
  }
}

function triggerJumpscare(name) {
  state.running = false;
  el.jumpscare.classList.remove("hidden");
  el.jumpscareImg.src = `assets/animatronics/${name}_jumpscare.png`;
  setTimeout(() => {
    // Volver al menú
    el.jumpscare.classList.add("hidden");
    el.menu.classList.remove("hidden");
    el.hud.classList.add("hidden");
    resetView();
  }, 1800);
}

function resetView() {
  state.viewYaw = 0;
  applyView();
}
