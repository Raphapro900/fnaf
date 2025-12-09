/* Prototipo FNAF 3D
   - Oficina + habitaciones con rutas
   - Animatrónicos patrullando
   - Hora avanza cada 60s (12 AM -> 6 AM)
   - Menú estilo FNAF, HUD, cámaras
   - Persistencia básica por cookies/localStorage
*/

const state = {
  started: false,
  hour: 0, // 0=12 AM, 1=1 AM ... 5=5 AM
  night: 1,
  power: 100,
  currentRoom: 'office',
  cameraOpen: false,
  animatronics: [],
  rooms: {},
};

const ui = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  time: document.querySelector('.hud-time'),
  night: document.querySelector('.hud-night'),
  power: document.querySelector('.hud-power'),
  room: document.querySelector('.hud-room'),
  camOverlay: document.getElementById('camera-overlay'),
  camBtns: null,
  sfxClick: document.getElementById('sfx-click'),
  sfxCam: document.getElementById('sfx-cam'),
  sfxStep: document.getElementById('sfx-step'),
  ambience: document.getElementById('sfx-ambience'),
};

const HOUR_LABELS = ['12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM'];

// Simple persistencia
function saveProgress(){
  localStorage.setItem('fnaf3d', JSON.stringify({night: state.night}));
}
function loadProgress(){
  try{
    const d = JSON.parse(localStorage.getItem('fnaf3d'));
    if(d && d.night) state.night = d.night;
  }catch(e){}
}

// Init UI
function initMenu(){
  loadProgress();
  document.getElementById('btn-newgame').addEventListener('click', () => {
    play(ui.sfxClick);
    startNight(1);
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    play(ui.sfxClick);
    startNight(state.night);
  });
  document.getElementById('btn-options').addEventListener('click', () => {
    play(ui.sfxClick);
    alert('Opciones próximamente: sensibilidad cámara, audio, brillo.');
  });
}

function startNight(n){
  state.night = n;
  state.hour = 0;
  state.power = 100;
  state.started = true;
  ui.menu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  updateHUD();

  // Ambiente
  play(ui.ambience, true);

  // Reloj: 1 hora cada 60s
  startClock();
}

function updateHUD(){
  ui.time.textContent = HOUR_LABELS[state.hour];
  ui.night.textContent = `Noche ${state.night}`;
  ui.power.textContent = `Poder ${Math.max(0, Math.floor(state.power))}%`;
  ui.room.textContent = roomLabel(state.currentRoom);
}

function roomLabel(id){
  const map = {
    office: 'Oficina',
    stage: 'Escenario',
    leftHall: 'Pasillo Izq.',
    rightHall: 'Pasillo Der.',
    dining: 'Comedor',
    backroom: 'Cuarto Trasero',
  };
  return map[id] || id;
}

function startClock(){
  if(state.clockInterval) clearInterval(state.clockInterval);
  state.clockInterval = setInterval(()=>{
    state.hour++;
    if(state.hour >= 6){
      clearInterval(state.clockInterval);
      victory();
    }
    updateHUD();
  }, 60_000); // 60s por hora
}

// Ganaste la noche
function victory(){
  stop(ui.ambience);
  play(ui.sfxClick);
  alert('6 AM – ¡Sobreviviste la noche!');
  state.night++;
  saveProgress();
  state.started = false;
  ui.hud.classList.add('hidden');
  ui.menu.classList.remove('hidden');
}

/* ----------- THREE.js ------------- */

let renderer, scene, camera;
let controls; // opcional (no pointer lock en prototipo)
const canvas = document.getElementById('game');

function initThree(){
  renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  resize();
  window.addEventListener('resize', resize);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 4); // altura ojos en oficina
  camera.lookAt(0, 1.6, 0);

  // Luz ambiente tenue + direccional
  scene.add(new THREE.AmbientLight(0x404040, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 5, 2);
  scene.add(dir);

  // Piso
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({color:0x111111, metalness:.1, roughness:.9})
  );
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // Habitaciones (cajas simples con posiciones)
  createRooms();

  // Animatrónicos
  createAnimatronics();

  // Input simple para cámaras
  initCameraOverlay();

  animate();
}

function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer && renderer.setSize(w, h, false);
  camera && (camera.aspect = w/h, camera.updateProjectionMatrix());
}

/* ----- Habitaciones ----- */
function roomBox({id, w, h, d, x, z, color=0x222222}){
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({color, metalness:.1, roughness:.9})
  );
  mesh.position.set(x, h/2, z);
  scene.add(mesh);
  state.rooms[id] = {id, mesh, pos: new THREE.Vector3(x, h/2, z)};
}

function createRooms(){
  // Oficina al centro frontal
  roomBox({id:'office', w:8, h:3, d:6, x:0, z:0, color:0x1a1a1a});

  // Escenario (stage)
  roomBox({id:'stage', w:10, h:4, d:6, x:0, z:-12, color:0x2a1a1a});

  // Pasillos
  roomBox({id:'leftHall', w:4, h:3, d:10, x:-8, z:-6, color:0x1a2a1a});
  roomBox({id:'rightHall', w:4, h:3, d:10, x:8, z:-6, color:0x1a1a2a});

  // Comedor
  roomBox({id:'dining', w:10, h:3, d:6, x:-12, z:-12, color:0x2a2a1a});

  // Cuarto trasero
  roomBox({id:'backroom', w:6, h:3, d:6, x:12, z:-12, color:0x2a1a2a});

  // Puertas de oficina (placeholder)
  addOfficeDoors();
}

function addOfficeDoors(){
  const geo = new THREE.BoxGeometry(1, 2.5, .2);
  const mat = new THREE.MeshStandardMaterial({color:0x555555});
  const leftDoor = new THREE.Mesh(geo, mat);
  const rightDoor = new THREE.Mesh(geo, mat);
  leftDoor.position.set(-3.5, 1.25, -2.8);
  rightDoor.position.set(3.5, 1.25, -2.8);
  scene.add(leftDoor, rightDoor);
}

/* ----- Animatrónicos ----- */
function createAnimatronics(){
  // Tres animatrónicos simples
  state.animatronics = [
    createBot({name:'Red', color:0xc0392b, route:['stage','dining','leftHall','office']}),
    createBot({name:'Green', color:0x27ae60, route:['stage','rightHall','backroom','office']}),
    createBot({name:'Blue', color:0x2980b9, route:['stage','dining','rightHall','office']}),
  ];
}

function createBot({name, color, route}){
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.8, 0.6),
    new THREE.MeshStandardMaterial({color})
  );
  scene.add(body);

  // Start at stage
  const startPos = state.rooms[route[0]].pos.clone();
  body.position.copy(startPos).add(new THREE.Vector3(0, .9, 0)); // altura

  return {
    name, route, currentIndex:0, mesh:body,
    speed: 0.02 + Math.random()*0.02,
    waitTimer: 0,
  };
}

function updateBots(delta){
  for(const bot of state.animatronics){
    // Espera aleatoria al llegar a habitación
    if(bot.waitTimer > 0){
      bot.waitTimer -= delta;
      continue;
    }
    const targetRoomId = bot.route[bot.currentIndex];
    const targetPos = state.rooms[targetRoomId].pos.clone().add(new THREE.Vector3(0, .9, 0));

    const dir = targetPos.clone().sub(bot.mesh.position);
    const dist = dir.length();
    if(dist > 0.01){
      dir.normalize();
      bot.mesh.position.add(dir.multiplyScalar(bot.speed));
      // Pasos esporádicos
      if(Math.random() < 0.01) play(ui.sfxStep);
    }else{
      // Llegó: esperar 2–5 segundos y avanzar al siguiente
      bot.waitTimer = 2 + Math.random()*3;
      bot.currentIndex = (bot.currentIndex + 1) % bot.route.length;

      // Si llega a oficina, aplicar presión al poder
      if(targetRoomId === 'office'){
        state.power -= 2 + Math.random()*3;
        state.power = Math.max(0, state.power);
        updateHUD();
      }
    }
  }
}

/* ----- Cámaras y overlay ----- */
function initCameraOverlay(){
  ui.camBtns = document.querySelectorAll('.cam-btn');
  ui.camBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.cam;
      goToRoom(id);
      ui.camOverlay.querySelector('.camera-title').textContent = `CAM – ${id.toUpperCase()}`;
      play(ui.sfxCam);
    });
  });
  // Toggle overlay con tecla C
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 'c'){
      state.cameraOpen = !state.cameraOpen;
      ui.camOverlay.classList.toggle('hidden', !state.cameraOpen);
      play(ui.sfxCam);
    }
    // Mover entre cámaras numéricas
    const camMap = ['office','stage','leftHall','rightHall','dining','backroom'];
    if(/^[1-6]$/.test(e.key)){
      const idx = Number(e.key) - 1;
      goToRoom(camMap[idx]);
      ui.camOverlay.classList.remove('hidden');
      state.cameraOpen = true;
      play(ui.sfxCam);
    }
  });
}

function goToRoom(id){
  const r = state.rooms[id];
  if(!r) return;
  state.currentRoom = id;
  // Colocar cámara dentro de la habitación mirando al centro
  camera.position.set(r.pos.x, 1.6, r.pos.z + 4);
  camera.lookAt(r.pos.x, 1.6, r.pos.z);
  updateHUD();
}

/* ----- Loop ----- */
let last = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = (now - last)/1000;
  last = now;

  // Simulada caída de poder con cámaras abiertas
  if(state.started && state.cameraOpen){
    state.power -= delta * 0.5;
    state.power = Math.max(0, state.power);
    // Si poder en 0: fin de juego (placeholder)
    if(state.power === 0){
      gameOver();
    }
    updateHUD();
  }

  updateBots(delta);

  renderer.render(scene, camera);
}

function gameOver(){
  stop(ui.ambience);
  alert('Poder 0% – GAME OVER');
  // Reset rápido
  state.started = false;
  ui.hud.classList.add('hidden');
  ui.menu.classList.remove('hidden');
}

/* ----- Audio helpers ----- */
function play(el, force=false){
  if(!el) return;
  if(force){ el.currentTime = 0; }
  el.play().catch(()=>{});
}
function stop(el){
  if(!el) return;
  el.pause();
  el.currentTime = 0;
}

/* ----- Boot ----- */
initMenu();
initThree();
