const state = {
  running: false,
  power: 100,
  hour: 0, // 0 = 12AM
  viewYaw: 0,
  inCams: false,
  doors: { left: false, right: false },
  lights: { left: false, right: false },
  animatronics: {
    freddy: { room: "stage", aggression: 0.20, route: ["stage","hall","closet","office"] },
    bonnie: { room: "stage", aggression: 0.35, route: ["stage","hall","office_left"] },
    chica:  { room: "stage", aggression: 0.30, route: ["stage","kitchen","office_right"] },
  }
};

const el = {
  menu: document.getElementById("menu"),
  btnPlay: document.getElementById("btnPlay"),
  btnContinue: document.getElementById("btnContinue"),
  btnMute: document.getElementById("btnMute"),
  hud: document.getElementById("hud"),
  btnCam: document.getElementById("btnCam"),
  cams: document.getElementById("cams"),
  closeCams: document.getElementById("closeCams"),
  camLabel: document.getElementById("camLabel"),
  camView: document.getElementById("camView"),
  office: document.getElementById("office"),
  doorLeft: document.getElementById("doorLeft"),
  doorRight: document.getElementById("doorRight"),
  lightLeft: document.getElementById("lightLeft"),
  lightRight: document.getElementById("lightRight"),
  beamLeft: document.getElementById("beamLeft"),
  beamRight: document.getElementById("beamRight"),
  botFreddy: document.getElementById("botFreddy"),
  botBonnie: document.getElementById("botBonnie"),
  botChica: document.getElementById("botChica"),
  powerVal: document.getElementById("powerVal"),
  time: document.getElementById("time"),
  jumpscare: document.getElementById("jumpscare"),
};

el.btnPlay.addEventListener("click", () => startGame(true));
el.btnContinue.addEventListener("click", () => startGame(false));

function startGame(reset) {
  if (reset) {
    state.power = 100;
    state.hour = 0;
    for (const k in state.animatronics) state.animatronics[k].room = "stage";
  }
  state.running = true;
  el.menu.classList.add("hidden");
  el.hud.classList.remove("hidden");
  lastT = performance.now();
  lastClock = Date.now();
  requestAnimationFrame(tick);
}

/* Paneo con mouse */
window.addEventListener("mousemove", (e) => {
  if (!state.running || state.inCams) return;
  const x = e.clientX / window.innerWidth;
  const dead = 0.10;
  let yaw = (x - 0.5) * 2;
  if (Math.abs(yaw) < dead) yaw = 0;
  yaw = Math.max(-1, Math.min(1, yaw));
  state.viewYaw = yaw;
  applyView();
});

function applyView() {
  const maxRot = 12;
  const maxShift = 42;
  const r = state.viewYaw * maxRot;
  const s = state.viewYaw * maxShift;
  el.office.style.transform = `translateX(${s}px) rotateY(${r}deg)`;
}

/* Cámaras */
el.btnCam.addEventListener("click", () => { openCams(); });
el.closeCams.addEventListener("click", () => { closeCams(); });

document.querySelectorAll(".map button").forEach(btn => {
  btn.addEventListener("click", () => {
    const cam = btn.dataset.cam;
    renderCam(cam);
  });
});

function openCams() {
  state.inCams = true;
  el.cams.classList.remove("hidden");
  renderCam("stage");
}
function closeCams() {
  state.inCams = false;
  el.cams.classList.add("hidden");
}

function renderCam(cam) {
  el.camLabel.textContent = `CAM: ${cam}`;
  el.camView.innerHTML = "";
  const feed = document.createElement("div");
  feed.className = "vhs";
  feed.textContent = `Vista de ${cam}`;
  el.camView.appendChild(feed);
}

/* Puertas y luces */
el.doorLeft.addEventListener("click", () => {
  state.doors.left = !state.doors.left;
  el.doorLeft.classList.toggle("active-door", state.doors.left);
});
el.doorRight.addEventListener("click", () => {
  state.doors.right = !state.doors.right;
  el.doorRight.classList.toggle("active-door", state.doors.right);
});
el.lightLeft.addEventListener("click", () => toggleLight("left"));
el.lightRight.addEventListener("click", () => toggleLight("right"));

function toggleLight(side) {
  state.lights[side] = !state.lights[side];
  const beam = side === "left" ? el.beamLeft : el.beamRight;
  beam.style.opacity = state.lights[side] ? "1" : "0";
  // Revelar animatrónicos si están en esa puerta
  for (const name in state.animatronics) {
    const a = state.animatronics[name];
    if ((side==="left" && a.room==="office_left") ||
        (side==="right" && a.room==="office_right")) {
      triggerOfficePresence(name);
    }
  }
}

/* Tiempo y energía */
let lastT = 0;
let lastClock = 0;

function updateClockPower(dt) {
  const use =
    (state.doors.left ? 0.08 : 0) +
    (state.doors.right ? 0.08 : 0) +
    (state.lights.left ? 0.05 : 0) +
    (state.lights.right ? 0.05 : 0) +
    (state.inCams ? 0.06 : 0) + 0.02;
  state.power = Math.max(0, state.power - use * dt);

  // Avanza hora cada 60 segundos reales
  const now = Date.now();
  if (now - lastClock >= 60000) {
    lastClock = now;
    state.hour = Math.min(6, state.hour + 1);
    const labels = ["12:00 AM","1:00 AM","2:00 AM","3:00 AM","4:00 AM","5:00 AM","6:00 AM"];
    el.time.textContent = labels[state.hour];
    if (state.hour === 6) winNight();
  }
  el.powerVal.textContent = `${Math.round(state.power)}%`;
}

/* IA animatrónicos */
function aiStep(dt) {
  const camDebuff = state.inCams ? 0.7 : 1.0;
  for (const name in state.animatronics) {
    const a = state.animatronics[name];
    const route = a.route;
    const idx = route.indexOf(a.room);
    if (idx < route.length - 1) {
      const p = a.aggression * camDebuff * dt;
      if (Math.random() < p) {
        a.room = route[idx + 1];
      }
    } else {
      let caught = false;
      if (a.room === "office_left" && !state.doors.left) caught = true;
      if (a.room === "office_right" && !state.doors.right) caught = true;
      if (a.room === "office") caught = true;
      if (caught) {
        triggerOfficePresence(name);
        setTimeout(() => triggerJumpscare(name), 650);
      } else {
        a.room = route[0];
      }
    }
  }
}

/* Aparición en oficina */
function triggerOfficePresence(name) {
  if (name==="freddy") el.botFreddy.classList.add("show");
  if (name==="bonnie") el.botBonnie.classList.add("show");
  if (name==="chica") el.botChica.classList.add("show");
  setTimeout(() => {
    el.botFreddy.classList.remove("show");
    el.botBonnie.classList.remove("show");
    el.botChica.classList.remove("show");
  }, 600);
}

/* Jumpscare */
function triggerJumpscare(name) {
  state.running = false;
  el.jumpscare.classList.remove("hidden");
  setTimeout(() => {
    el.jumpscare.classList.add("hidden");
    el.menu.classList.remove("hidden");
    el.hud.classList.add("hidden");
    resetGame();
  }, 1600);
}

function winNight() {
  state.running = false;
  alert("¡Has sobrevivido a la noche!");
  el.menu.classList.remove("hidden");
  el.hud.classList.add("hidden");
  resetGame();
}

function resetGame() {
  state.viewYaw = 0; 
  applyView();
  for (const k in state.animatronics) state.animatronics[k].room = "stage";
  state.inCams = false;
  state.doors.left = state.doors.right = false;
  state.lights.left = state.lights.right = false;
  el.beamLeft.style.opacity = "0";
  el.beamRight.style.opacity = "0";
  el.doorLeft.classList.remove("active-door");
  el.doorRight.classList.remove("active-door");
  el.lightLeft.classList.remove("active-light");
  el.lightRight.classList.remove("active-light");
}

/* Bucle principal */
function tick(t = performance.now()) {
  if (!state.running) return;
  const dt = (t - lastT) / 1000 || 0.016;
  lastT = t;

  updateClockPower(dt);
  aiStep(dt);

  // Apagón acelera IA
  if (state.power <= 0) {
    for (const k in state.animatronics) {
      state.animatronics[k].aggression = Math.min(1, state.animatronics[k].aggression + 0.12);
    }
  }
  requestAnimationFrame(tick);
}
