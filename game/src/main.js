// GTA-Style Open World Crime Game
// Canvas2D top-down open world
// Controls: WASD/Arrows to move, SPACE to enter/exit vehicles, F to attack, E for missions
// Features: City exploration, vehicles, traffic, wanted level, police, missions, HUD, save

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- Constants ---
const TILE = 40;
const MAP_W = 100;
const MAP_H = 100;
const VIEWPORT_W = Math.min(960, window.innerWidth - 20);
const VIEWPORT_H = Math.min(600, window.innerHeight - 20);
canvas.width = VIEWPORT_W;
canvas.height = VIEWPORT_H;

// --- Color Palette ---
const COLORS = {
  road: '#333333',
  roadLine: '#FFFF00',
  sidewalk: '#888888',
  grass: '#2d5a1e',
  water: '#1a3a5c',
  building: ['#556677','#667788','#778899','#8899aa','#445566','#665544','#554433','#444455','#887766','#554455'],
  buildingRoof: ['#667788','#778899','#8899aa','#556677','#776655','#665544','#555566','#998877'],
  player: '#00cc00',
  playerCar: '#ff0000',
  ped: ['#cc6600','#6666cc','#cc0066','#00cc66','#66cc00','#cc9933','#3399cc'],
  police: '#0033cc',
  bullet: '#ffff00',
  hud: '#000000',
  hudText: '#ffffff',
  hudMoney: '#00ff00',
  hudWanted: '#ff0000',
  mission: '#ffff00',
  missionComplete: '#00ff00',
  damage: '#ff0000'
};

// --- Map Generation ---
// 0=grass, 1=road, 2=sidewalk, 3=building, 4=water, 5=park
let map = [];
function generateMap() {
  // Initialize with grass
  for (let y = 0; y < MAP_H; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_W; x++) {
      map[y][x] = 0;
    }
  }
  
  // Generate road grid
  const roadSpacing = 12;
  for (let y = roadSpacing; y < MAP_H; y += roadSpacing) {
    for (let x = 0; x < MAP_W; x++) {
      map[y][x] = 1;
      if (y+1 < MAP_H) map[y+1][x] = 1;
    }
  }
  for (let x = roadSpacing; x < MAP_W; x += roadSpacing) {
    for (let y = 0; y < MAP_H; y++) {
      map[y][x] = 1;
      if (x+1 < MAP_W) map[y][x+1] = 1;
    }
  }
  
  // Place buildings in city blocks
  for (let by = 1; by < MAP_H; by += roadSpacing) {
    for (let bx = 1; bx < MAP_W; bx += roadSpacing) {
      let blocksX = roadSpacing - 3;
      let blocksY = roadSpacing - 3;
      // Skip some blocks for parks/water
      if (Math.random() < 0.15) {
        // Water feature
        for (let y = by; y < by + blocksY && y < MAP_H; y++) {
          for (let x = bx; x < bx + blocksX && x < MAP_W; x++) {
            map[y][x] = 4;
          }
        }
        continue;
      }
      if (Math.random() < 0.1) {
        // Park
        for (let y = by; y < by + blocksY && y < MAP_H; y++) {
          for (let x = bx; x < bx + blocksX && x < MAP_W; x++) {
            map[y][x] = 5;
          }
        }
        continue;
      }
      // Buildings with height
      for (let y = by; y < by + blocksY && y < MAP_H; y++) {
        for (let x = bx; x < bx + blocksX && x < MAP_W; x++) {
          if (Math.random() < 0.75) {
            map[y][x] = 3;
          } else {
            map[y][x] = 5; // Courtyard
          }
        }
      }
    }
  }
  
  // Sidewalks around buildings
  for (let y = 1; y < MAP_H-1; y++) {
    for (let x = 1; x < MAP_W-1; x++) {
      if (map[y][x] === 0 || map[y][x] === 5) {
        let hasRoad = false;
        let hasBuilding = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (map[y+dy][x+dx] === 1) hasRoad = true;
            if (map[y+dy][x+dx] === 3) hasBuilding = true;
          }
        }
        if (hasRoad && !hasBuilding) map[y][x] = 2;
      }
    }
  }
}

generateMap();

// --- Player ---
const player = {
  x: 13 * TILE + TILE/2,
  y: 13 * TILE + TILE/2,
  angle: 0,
  speed: 0,
  maxSpeed: 3,
  health: 100,
  maxHealth: 100,
  money: 500,
  wantedLevel: 0, // 0-5
  wantedTimer: 0,
  inVehicle: null,
  ammo: 20,
  currentMission: null,
  missionProgress: 0,
  isAttacking: false,
  attackTimer: 0,
  kills: 0
};

// --- Vehicles ---
const vehicles = [];
function spawnVehicles() {
  const types = [
    { name: 'sedan', w: 20, h: 40, maxSpeed: 6, color: '#cc0000' },
    { name: 'suv', w: 24, h: 48, maxSpeed: 5, color: '#333333' },
    { name: 'truck', w: 28, h: 56, maxSpeed: 4, color: '#884400' },
    { name: 'sports', w: 18, h: 36, maxSpeed: 8, color: '#ffcc00' },
    { name: 'police', w: 20, h: 42, maxSpeed: 7, color: '#000066' },
    { name: 'taxi', w: 20, h: 42, maxSpeed: 5, color: '#ffcc00' },
    { name: 'ambulance', w: 22, h: 48, maxSpeed: 6, color: '#ffffff' }
  ];
  
  for (let i = 0; i < 150; i++) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 50) {
      let vx = Math.floor(Math.random() * MAP_W);
      let vy = Math.floor(Math.random() * MAP_H);
      if (map[vy][vx] === 1) {
        let type = types[Math.floor(Math.random() * types.length)];
        vehicles.push({
          x: vx * TILE + TILE/2,
          y: vy * TILE + TILE/2,
          angle: Math.floor(Math.random() * 4) * Math.PI/2,
          speed: 0,
          maxSpeed: type.maxSpeed,
          color: type.color,
          w: type.w,
          h: type.h,
          type: type.name,
          ai: true,
          aiTarget: null,
          aiTimer: 0,
          occupied: false
        });
        placed = true;
      }
      attempts++;
    }
  }
}

spawnVehicles();

// --- Pedestrians ---
const pedestrians = [];
function spawnPedestrians() {
  for (let i = 0; i < 200; i++) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 20) {
      let px = Math.floor(Math.random() * MAP_W);
      let py = Math.floor(Math.random() * MAP_H);
      if (map[py][px] === 1 || map[py][px] === 2) {
        pedestrians.push({
          x: px * TILE + TILE/2,
          y: py * TILE + TILE/2,
          angle: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.5,
          color: COLORS.ped[Math.floor(Math.random() * COLORS.ped.length)],
          state: 'walking', // walking, fleeing, dead
          fleeTimer: 0,
          health: 30,
          targetX: null,
          targetY: null
        });
        placed = true;
      }
      attempts++;
    }
  }
}

spawnPedestrians();

// --- Police ---
const police = [];
function spawnPolice() {
  for (let i = 0; i < 30; i++) {
    let px = Math.floor(Math.random() * MAP_W);
    let py = Math.floor(Math.random() * MAP_H);
    police.push({
      x: px * TILE + TILE/2,
      y: py * TILE + TILE/2,
      angle: 0,
      speed: 0,
      health: 80,
      state: 'patrol', // patrol, chase, attack, dead
      targetX: 0,
      targetY: 0,
      shootTimer: 0,
      patrolTimer: 0
    });
  }
}

spawnPolice();

// --- Bullets ---
const bullets = [];

// --- Missions ---
const missions = [
  {
    id: 'robbery',
    title: ' convenience Store Robbery',
    desc: 'Steal a vehicle and deliver it to the mission zone',
    type: 'stealCar',
    targetVehicle: null,
    zone: { x: 40, y: 40, w: 8, h: 8 },
    reward: 1000
  },
  {
    id: 'racing',
    title: 'Street Race',
    desc: 'Drive through all checkpoints within time limit',
    type: 'race',
    checkpoints: [],
    currentCheckpoint: 0,
    zone: { x: 50, y: 50, w: 10, h: 10 },
    reward: 2000
  },
  {
    id: 'hit',
    title: 'Contract Kill',
    desc: 'Eliminate the target pedestrian',
    type: 'hit',
    targetPed: null,
    zone: { x: 60, y: 30, w: 8, h: 8 },
    reward: 5000
  },
  {
    id: 'escape',
    title: 'Heist Escape',
    desc: 'Evade police and reach the extraction zone',
    type: 'escape',
    zone: { x: 80, y: 80, w: 10, h: 10 },
    reward: 3000
  },
  {
    id: 'tour',
    title: 'City Tour',
    desc: 'Explore the city and visit all districts',
    type: 'tour',
    visitedDistricts: new Set(),
    zone: null,
    reward: 500
  }
];

// Generate race checkpoints
missions[1].checkpoints = [];
for (let i = 0; i < 6; i++) {
  missions[1].checkpoints.push({
    x: (20 + i * 12) * TILE,
    y: (30 + (i % 2) * 20) * TILE
  });
}

// Target pedestrian for hit mission
missions[2].targetPed = { x: 64 * TILE, y: 34 * TILE, alive: true };

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// --- Camera ---
const camera = { x: 0, y: 0 };

// --- Game State ---
let gameState = 'title'; // title, playing, paused, missionComplete, gameOver
let gameTime = 0;
let dayNightCycle = 0;
let shakeTimer = 0;
let shakeIntensity = 0;
let lastTime = 0;
let fps = 60;
let frameCount = 0;
let fpsTimer = 0;

// --- Save/Load ---
function saveGame() {
  const data = {
    player: { x: player.x, y: player.y, health: player.health, money: player.money, wantedLevel: player.wantedLevel, ammo: player.ammo },
    missions: missions.map(m => ({ id: m.id, complete: m.complete, progress: m.missionProgress })),
    gameTime: gameTime
  };
  localStorage.setItem('gta6save', JSON.stringify(data));
  showNotification('Game saved!');
}

function loadGame() {
  const raw = localStorage.getItem('gta6save');
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    player.x = data.player.x;
    player.y = data.player.y;
    player.health = data.player.health;
    player.money = data.player.money;
    player.wantedLevel = data.player.wantedLevel;
    player.ammo = data.player.ammo;
    gameTime = data.gameTime || 0;
    return true;
  } catch (e) { return false; }
}

let notifications = [];
function showNotification(text) {
  notifications.push({ text, timer: 180 });
  if (notifications.length > 3) notifications.shift();
}

// --- Collision ---
function isSolid(x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true;
  return map[ty][tx] === 3 || map[ty][tx] === 4;
}

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// --- Update ---
function update(dt) {
  gameTime += dt;
  dayNightCycle = (Math.sin(gameTime * 0.0001) + 1) / 2; // 0=night, 1=day
  
  if (gameState !== 'playing') return;
  
  let moveSpeed = player.maxSpeed;
  
  // Movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy = -1;
  if (keys['s'] || keys['arrowdown']) dy = 1;
  if (keys['a'] || keys['arrowleft']) dx = -1;
  if (keys['d'] || keys['arrowright']) dx = 1;
  
  if (dx !== 0 || dy !== 0) {
    let len = Math.sqrt(dx*dx + dy*dy);
    dx /= len; dy /= len;
    
    if (player.inVehicle) {
      // Vehicle controls
      const v = player.inVehicle;
      if (keys['w'] || keys['arrowup']) v.speed = Math.min(v.speed + 0.2, v.maxSpeed);
      else if (keys['s'] || keys['arrowdown']) v.speed = Math.max(v.speed - 0.3, -v.maxSpeed/2);
      else v.speed *= 0.95;
      
      if (Math.abs(v.speed) > 0.5) {
        let turnRate = 0.04 * Math.sign(v.speed);
        if (keys['a'] || keys['arrowleft']) v.angle -= turnRate;
        if (keys['d'] || keys['arrowright']) v.angle += turnRate;
      }
      
      v.x += Math.cos(v.angle) * v.speed;
      v.y += Math.sin(v.angle) * v.speed;
      player.x = v.x;
      player.y = v.y;
      
      // Hit pedestrians with vehicle
      if (Math.abs(v.speed) > 2) {
        for (let p of pedestrians) {
          if (p.state !== 'dead' && dist(p, v) < 30) {
            p.health -= 50 * Math.abs(v.speed) / 3;
            if (p.health <= 0) {
              p.state = 'dead';
              player.wantedLevel = Math.min(5, player.wantedLevel + 1);
              player.kills++;
            }
            v.speed *= 0.8;
          }
        }
      }
    } else {
      // On foot
      moveSpeed = 2.5;
      let nx = player.x + dx * moveSpeed;
      let ny = player.y + dy * moveSpeed;
      if (!isSolid(nx, player.y)) player.x = nx;
      if (!isSolid(player.x, ny)) player.y = ny;
      player.angle = Math.atan2(dy, dx);
    }
  }
  
  // Clamp to map
  player.x = Math.max(TILE, Math.min(player.x, (MAP_W-1) * TILE));
  player.y = Math.max(TILE, Math.min(player.y, (MAP_H-1) * TILE));
  
  // Vehicle enter/exit
  if (keys[' '] && !player._spaceUsed) {
    player._spaceUsed = true;
    if (player.inVehicle) {
      player.inVehicle.occupied = false;
      player.inVehicle = null;
      player.x += 30;
    } else {
      let closest = null, closestDist = 50;
      for (let v of vehicles) {
        let d = dist(v, player);
        if (d < closestDist) { closestDist = d; closest = v; }
      }
      if (closest) {
        closest.occupied = true;
        player.inVehicle = closest;
      }
    }
  }
  if (!keys[' ']) player._spaceUsed = false;
  
  // Attack
  if (keys['f'] && !player.inVehicle && player.ammo > 0 && !player._fUsed) {
    player._fUsed = true;
    player.ammo--;
    bullets.push({
      x: player.x + Math.cos(player.angle) * 15,
      y: player.y + Math.sin(player.angle) * 15,
      vx: Math.cos(player.angle) * 10,
      vy: Math.sin(player.angle) * 10,
      life: 60
    });
    shakeTimer = 5;
    shakeIntensity = 3;
  }
  if (!keys['f']) player._fUsed = false;
  
  // Update bullets
  for (let i = bullets.length-1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    
    // Hit pedestrian
    for (let p of pedestrians) {
      if (p.state !== 'dead' && dist(b, p) < 10) {
        p.health -= 50;
        if (p.health <= 0) {
          p.state = 'dead';
          player.wantedLevel = Math.min(5, player.wantedLevel + 1);
          player.kills++;
        } else {
          p.state = 'fleeing';
        }
        bullets.splice(i, 1);
        break;
      }
    }
    
    if (b.life <= 0 || isSolid(b.x, b.y)) {
      bullets.splice(i, 1);
    }
  }
  
  // Wanted timer
  if (player.wantedLevel > 0) {
    player.wantedTimer++;
    if (player.wantedTimer > 3600) { // ~1 minute at 60fps
      player.wantedLevel = Math.max(0, player.wantedLevel - 1);
      player.wantedTimer = 0;
    }
  }
  
  // Update vehicles AI
  for (let v of vehicles) {
    if (v === player.inVehicle || v.occupied) continue;
    
    // Follow road
    v.aiTimer--;
    if (v.aiTimer <= 0) {
      // Find nearest road direction
      let tx = Math.floor(v.x / TILE);
      let ty = Math.floor(v.y / TILE);
      let dirs = [];
      if (ty > 0 && map[ty-1][tx] === 1) dirs.push(-Math.PI/2);
      if (ty < MAP_H-1 && map[ty+1][tx] === 1) dirs.push(Math.PI/2);
      if (tx > 0 && map[ty][tx-1] === 1) dirs.push(Math.PI);
      if (tx < MAP_W-1 && map[ty][tx+1] === 1) dirs.push(0);
      
      if (dirs.length > 0) {
        v.angle = dirs[Math.floor(Math.random() * dirs.length)];
        // Add some randomness
        v.angle += (Math.random() - 0.5) * 0.5;
      }
      v.aiTimer = 60 + Math.random() * 120;
    }
    
    v.speed = Math.min(v.speed + 0.1, v.maxSpeed * 0.7);
    let nvx = v.x + Math.cos(v.angle) * v.speed;
    let nvy = v.y + Math.sin(v.angle) * v.speed;
    
    if (!isSolid(nvx, nvy)) {
      v.x = nvx;
      v.y = nvy;
    } else {
      v.speed = 0;
      v.aiTimer = 0;
    }
    
    v.x = Math.max(TILE, Math.min(v.x, (MAP_W-1) * TILE));
    v.y = Math.max(TILE, Math.min(v.y, (MAP_H-1) * TILE));
  }
  
  // Update pedestrians
  for (let p of pedestrians) {
    if (p.state === 'dead') continue;
    
    if (p.state === 'fleeing') {
      p.fleeTimer--;
      if (p.fleeTimer <= 0) { p.state = 'walking'; p.fleeTimer = 0; }
      
      // Flee from player or bullets
      let fleeTarget = null;
      for (let b of bullets) {
        if (dist(b, p) < 200) { fleeTarget = b; break; }
      }
      if (!fleeTarget && dist(player, p) < 100) fleeTarget = player;
      
      if (fleeTarget) {
        let a = angleTo(p, fleeTarget) + Math.PI;
        p.x += Math.cos(a) * p.speed * 2;
        p.y += Math.sin(a) * p.speed * 2;
        p.angle = a;
      }
    } else {
      // Random walking
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.angle += (Math.random() - 0.5) * 0.3;
      
      // Avoid solids
      if (isSolid(p.x, p.y)) {
        p.angle += Math.PI;
        p.x += Math.cos(p.angle) * 5;
        p.y += Math.sin(p.angle) * 5;
      }
    }
    
    p.x = Math.max(TILE, Math.min(p.x, (MAP_W-1) * TILE));
    p.y = Math.max(TILE, Math.min(p.y, (MAP_H-1) * TILE));
  }
  
  // Update police
  for (let cop of police) {
    if (cop.health <= 0) continue;
    
    let dToPlayer = dist(cop, player);
    
    if (player.wantedLevel > 0 && dToPlayer < 500 * player.wantedLevel) {
      cop.state = 'chase';
      let a = angleTo(cop, player);
      
      if (dToPlayer > 80) {
        cop.x += Math.cos(a) * 3;
        cop.y += Math.sin(a) * 3;
        cop.angle = a;
      }
      
      // Shoot at player
      if (dToPlayer < 300) {
        cop.shootTimer--;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = 30 + Math.random() * 30;
          bullets.push({
            x: cop.x,
            y: cop.y,
            vx: Math.cos(a) * 8,
            vy: Math.sin(a) * 8,
            life: 40,
            fromPolice: true
          });
        }
      }
    } else {
      cop.state = 'patrol';
      cop.patrolTimer--;
      if (cop.patrolTimer <= 0) {
        cop.patrolTimer = 100 + Math.random() * 200;
        cop.targetX = cop.x + (Math.random() - 0.5) * 400;
        cop.targetY = cop.y + (Math.random() - 0.5) * 400;
      }
      
      if (cop.targetX && cop.targetY) {
        let a = angleTo(cop, {x: cop.targetX, y: cop.targetY});
        cop.x += Math.cos(a) * 1;
        cop.y += Math.sin(a) * 1;
        cop.angle = a;
      }
    }
    
    cop.x = Math.max(TILE, Math.min(cop.x, (MAP_W-1) * TILE));
    cop.y = Math.max(TILE, Math.min(cop.y, (MAP_H-1) * TILE));
  }
  
  // Police bullets hit player
  for (let i = bullets.length-1; i >= 0; i--) {
    let b = bullets[i];
    if (b.fromPolice && dist(b, player) < 12) {
      player.health -= 10;
      bullets.splice(i, 1);
      shakeTimer = 10;
      shakeIntensity = 5;
    }
  }
  
  // Mission logic
  if (player.currentMission !== null) {
    let m = missions[player.currentMission];
    switch (m.type) {
      case 'stealCar':
        if (player.inVehicle && !player.inVehicle.type.startsWith('police')) {
          m.missionProgress++;
          if (m.missionProgress > 120) { // 2 seconds in vehicle
            completeMission(player.currentMission);
          }
        } else {
          m.missionProgress = Math.max(0, m.missionProgress - 2);
        }
        break;
      case 'race':
        let cp = m.checkpoints[m.currentCheckpoint];
        if (cp && dist(player, cp) < 60) {
          m.currentCheckpoint++;
          if (m.currentCheckpoint >= m.checkpoints.length) {
            completeMission(player.currentMission);
          }
        }
        break;
      case 'hit':
        let tp = missions[2].targetPed;
        if (tp && tp.alive && dist(player, tp) < 30) {
          tp.alive = false;
          completeMission(player.currentMission);
        }
        break;
      case 'escape':
        if (dist(player, m.zone) < 100) {
          // Stay in zone for 3 seconds
          m.missionProgress++;
          if (m.missionProgress > 180) {
            completeMission(player.currentMission);
          }
        } else {
          m.missionProgress = Math.max(0, m.missionProgress - 1);
        }
        break;
    }
  }
  
  // Start mission with E
  if (keys['e'] && !player._eUsed) {
    player._eUsed = true;
    for (let i = 0; i < missions.length; i++) {
      let m = missions[i];
      if (m.complete) continue;
      if (m.zone && dist(player, m.zone) < 150) {
        player.currentMission = i;
        m.missionProgress = 0;
        showNotification('Mission started: ' + m.title);
        break;
      }
    }
  }
  if (!keys['e']) player._eUsed = false;
  
  // Health regen (slow)
  if (player.health < player.maxHealth && player.wantedLevel === 0) {
    player.health = Math.min(player.maxHealth, player.health + 0.02);
  }
  
  // Game over check
  if (player.health <= 0) {
    gameState = 'gameOver';
  }
  
  // Shake
  if (shakeTimer > 0) shakeTimer--;
  
  // Camera follows player
  camera.x += (player.x - camera.x - VIEWPORT_W/2) * 0.1;
  camera.y += (player.y - camera.y - VIEWPORT_H/2) * 0.1;
  
  // Notifications
  for (let i = notifications.length-1; i >= 0; i--) {
    notifications[i].timer--;
    if (notifications[i].timer <= 0) notifications.splice(i, 1);
  }
  
  // FPS
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1000) {
    fps = Math.round(frameCount * 1000 / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
}

function completeMission(idx) {
  let m = missions[idx];
  m.complete = true;
  player.money += m.reward;
  showNotification('Mission complete: ' + m.title + ' +$' + m.reward);
  player.currentMission = null;
}

// --- Render ---
function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (gameState === 'title') {
    renderTitle();
    return;
  }
  if (gameState === 'gameOver') {
    renderGameOver();
    return;
  }
  
  // Apply camera and shake
  let shakeX = shakeTimer > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
  let shakeY = shakeTimer > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
  
  ctx.save();
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);
  
  // Draw map
  let startTX = Math.max(0, Math.floor(camera.x / TILE) - 1);
  let startTY = Math.max(0, Math.floor(camera.y / TILE) - 1);
  let endTX = Math.min(MAP_W, Math.ceil((camera.x + VIEWPORT_W) / TILE) + 1);
  let endTY = Math.min(MAP_H, Math.ceil((camera.y + VIEWPORT_H) / TILE) + 1);
  
  for (let y = startTY; y < endTY; y++) {
    for (let x = startTX; x < endTX; x++) {
      let tile = map[y][x];
      let px = x * TILE, py = y * TILE;
      
      switch (tile) {
        case 0: // Grass
          ctx.fillStyle = COLORS.grass;
          ctx.fillRect(px, py, TILE, TILE);
          break;
        case 1: // Road
          ctx.fillStyle = COLORS.road;
          ctx.fillRect(px, py, TILE, TILE);
          // Road markings
          if (x % 2 === 0) {
            ctx.fillStyle = COLORS.roadLine;
            ctx.fillRect(px + TILE/2 - 1, py, 2, TILE);
          }
          if (y % 2 === 0) {
            ctx.fillStyle = COLORS.roadLine;
            ctx.fillRect(px, py + TILE/2 - 1, TILE, 2);
          }
          break;
        case 2: // Sidewalk
          ctx.fillStyle = COLORS.sidewalk;
          ctx.fillRect(px, py, TILE, TILE);
          break;
        case 3: // Building
          ctx.fillStyle = COLORS.building[Math.floor((x*7+y*13) % COLORS.building.length)];
          ctx.fillRect(px, py, TILE, TILE);
          // Roof effect
          ctx.fillStyle = COLORS.buildingRoof[Math.floor((x*11+y*7) % COLORS.buildingRoof.length)];
          ctx.fillRect(px+2, py+2, TILE-4, TILE-4);
          break;
        case 4: // Water
          ctx.fillStyle = COLORS.water;
          ctx.fillRect(px, py, TILE, TILE);
          // Water shimmer
          ctx.fillStyle = 'rgba(100,180,255,0.3)';
          ctx.fillRect(px + 5 + Math.sin(gameTime*0.01+x)*5, py + 5, 10, 3);
          break;
        case 5: // Park
          ctx.fillStyle = '#1a4a10';
          ctx.fillRect(px, py, TILE, TILE);
          // Trees
          ctx.fillStyle = '#0a3a05';
          ctx.beginPath();
          ctx.arc(px + TILE/2, py + TILE/2, 8, 0, Math.PI*2);
          ctx.fill();
          break;
      }
    }
  }
  
  // Draw mission zones
  for (let i = 0; i < missions.length; i++) {
    let m = missions[i];
    if (!m.zone) continue;
    ctx.strokeStyle = m.complete ? '#00ff00' : '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      m.zone.x * TILE, m.zone.y * TILE,
      m.zone.w * TILE, m.zone.h * TILE
    );
    ctx.setLineDash([]);
    // Mission label
    ctx.fillStyle = m.complete ? '#00ff00' : '#ffff00';
    ctx.font = '12px monospace';
    ctx.fillText(m.title, m.zone.x * TILE, m.zone.y * TILE - 5);
  }
  
  // Draw race checkpoints
  let raceM = missions.find(m => m.type === 'race');
  if (raceM) {
    for (let i = 0; i < raceM.checkpoints.length; i++) {
      let cp = raceM.checkpoints[i];
      ctx.fillStyle = i < raceM.currentCheckpoint ? '#00ff00' : '#ff8800';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 15, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i+1, cp.x, cp.y+4);
      ctx.textAlign = 'left';
    }
  }
  
  // Draw bullets
  ctx.fillStyle = COLORS.bullet;
  for (let b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI*2);
    ctx.fill();
  }
  
  // Draw vehicles
  for (let v of vehicles) {
    if (v === player.inVehicle) continue;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    
    // Car body
    ctx.fillStyle = v.color;
    ctx.fillRect(-v.h/2, -v.w/2, v.h, v.w);
    
    // Windows
    ctx.fillStyle = 'rgba(150,200,255,0.6)';
    ctx.fillRect(-v.h/4, -v.w/2+2, v.h/4, v.w-4);
    
    // Headlights
    ctx.fillStyle = '#ffffcc';
    ctx.fillRect(-v.h/2-1, -v.w/2+2, 3, 5);
    ctx.fillRect(-v.h/2-1, v.w/2-7, 3, 5);
    
    // Taillights
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(v.h/2-2, -v.w/2+2, 3, 5);
    ctx.fillRect(v.h/2-2, v.w/2-7, 3, 5);
    
    ctx.restore();
  }
  
  // Draw police car if wanted
  if (player.wantedLevel > 0) {
    let nearestCop = police.find(c => c.health > 0);
    if (nearestCop) {
      ctx.save();
      ctx.translate(nearestCop.x, nearestCop.y);
      ctx.rotate(nearestCop.angle);
      ctx.fillStyle = '#000033';
      ctx.fillRect(-21, -9, 42, 18);
      // Police lights
      let flash = Math.floor(gameTime / 10) % 2;
      ctx.fillStyle = flash ? '#ff0000' : '#0000ff';
      ctx.fillRect(-5, -8, 10, 5);
      ctx.fillStyle = !flash ? '#ff0000' : '#0000ff';
      ctx.fillRect(-5, 3, 10, 5);
      ctx.restore();
    }
  }
  
  // Draw pedestrians
  for (let p of pedestrians) {
    if (p.state === 'dead') {
      ctx.fillStyle = '#880000';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
    ctx.fill();
    // Direction indicator
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle)*8, p.y + Math.sin(p.angle)*8);
    ctx.stroke();
  }
  
  // Draw police
  for (let cop of police) {
    if (cop.health <= 0) continue;
    if (cop.state !== 'chase' && dist(cop, player) > 200) continue;
    
    ctx.fillStyle = COLORS.police;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 6, 0, Math.PI*2);
    ctx.fill();
    // Badge
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 3, 0, Math.PI*2);
    ctx.fill();
  }
  
  // Draw player
  if (player.inVehicle) {
    let v = player.inVehicle;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.fillStyle = v.color;
    ctx.fillRect(-v.h/2, -v.w/2, v.h, v.w);
    ctx.fillStyle = 'rgba(150,200,255,0.8)';
    ctx.fillRect(-v.h/4, -v.w/2+2, v.h/4, v.w-4);
    // Siren
    if (player.wantedLevel > 0) {
      let flash = Math.floor(gameTime / 8) % 2;
      ctx.fillStyle = flash ? '#ff0000' : '#0000ff';
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
  } else {
    // On foot player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    // Body
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-6, -4, 12, 8);
    // Head
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI*2);
    ctx.fill();
    // Gun direction
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw mission target
  let hitM = missions.find(m => m.type === 'hit');
  if (hitM && hitM.targetPed && hitM.targetPed.alive) {
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(hitM.targetPed.x, hitM.targetPed.y, 8, 0, Math.PI*2);
    ctx.fill();
    // Target symbol
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hitM.targetPed.x, hitM.targetPed.y, 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hitM.targetPed.x - 15, hitM.targetPed.y);
    ctx.lineTo(hitM.targetPed.x + 15, hitM.targetPed.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hitM.targetPed.x, hitM.targetPed.y - 15);
    ctx.lineTo(hitM.targetPed.x, hitM.targetPed.y + 15);
    ctx.stroke();
  }
  
  // Day/night overlay
  let darkness = 1 - dayNightCycle;
  if (darkness > 0.3) {
    ctx.fillStyle = `rgba(0,0,30,${(darkness - 0.3) * 0.5})`;
    ctx.fillRect(camera.x, camera.y, VIEWPORT_W, VIEWPORT_H);
    
    // Street lights
    for (let y = startTY; y < endTY; y += 6) {
      for (let x = startTX; x < endTX; x += 6) {
        if (map[y][x] === 1) {
          let lightIntensity = Math.sin(gameTime * 0.02 + x + y) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(255,200,100,${darkness * 0.15 * lightIntensity})`;
          ctx.beginPath();
          ctx.arc(x * TILE + TILE/2, y * TILE + TILE/2, 40, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
  }
  
  ctx.restore();
  
  // --- HUD ---
  renderHUD();
  
  // Notifications
  for (let i = 0; i < notifications.length; i++) {
    let n = notifications[i];
    let alpha = Math.min(1, n.timer / 30);
    ctx.fillStyle = `rgba(0,0,0,${0.7 * alpha})`;
    ctx.fillRect(VIEWPORT_W/2 - 150, 80 + i * 35, 300, 28);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(n.text, VIEWPORT_W/2, 98 + i * 35);
    ctx.textAlign = 'left';
  }
  
  // Mission progress
  if (player.currentMission !== null) {
    let m = missions[player.currentMission];
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 280, 50);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('MISSION: ' + m.title, 20, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(m.desc, 20, 48);
    if (m.type === 'stealCar') ctx.fillText('Progress: ' + Math.min(m.missionProgress, 120) + '/120', 20, 62);
    if (m.type === 'escape') ctx.fillText('Hold position: ' + Math.min(m.missionProgress, 180) + '/180', 20, 62);
  }
  
  // Controls help
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(VIEWPORT_W - 200, VIEWPORT_H - 80, 190, 70);
  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.fillText('WASD:Move  SPACE:Car', VIEWPORT_W - 190, VIEWPORT_H - 65);
  ctx.fillText('F:Shoot  E:Mission  S:Save', VIEWPORT_W - 190, VIEWPORT_H - 50);
  ctx.fillText('R:Restart', VIEWPORT_W - 190, VIEWPORT_H - 35);
}

function renderHUD() {
  // Health bar
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(10, 10, 200, 25);
  ctx.fillStyle = player.health > 50 ? '#00cc00' : player.health > 25 ? '#cccc00' : '#cc0000';
  ctx.fillRect(12, 12, (player.health / player.maxHealth) * 196, 21);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px monospace';
  ctx.fillText('HP: ' + Math.ceil(player.health), 15, 27);
  
  // Money
  ctx.fillStyle = '#00ff00';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('$' + player.money, 10, 55);
  
  // Wanted stars
  if (player.wantedLevel > 0) {
    ctx.fillStyle = '#ffff00';
    ctx.font = '16px monospace';
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < player.wantedLevel ? '★ ' : '☆ ';
    }
    ctx.fillText(stars, 10, 75);
  }
  
  // Ammo
  ctx.fillStyle = '#cccccc';
  ctx.font = '12px monospace';
  ctx.fillText('AMMO: ' + player.ammo, 10, 95);
  
  // Minimap
  renderMinimap();
}

function renderMinimap() {
  let mmW = 150, mmH = 150;
  let mmX = VIEWPORT_W - mmW - 10, mmY = 10;
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX, mmY, mmW, mmH);
  
  let scale = mmW / (MAP_W * TILE) * 4;
  let ox = mmX + (mmW - MAP_W * TILE * scale) / 2;
  let oy = mmY + (mmH - MAP_H * TILE * scale) / 2;
  
  // Draw minimap tiles
  let step = Math.max(1, Math.floor(2 / TILE));
  for (let y = 0; y < MAP_H; y += step) {
    for (let x = 0; x < MAP_W; x += step) {
      let tile = map[y][x];
      if (tile === 1) {
        ctx.fillStyle = '#555';
      } else if (tile === 3) {
        ctx.fillStyle = '#888';
      } else if (tile === 4) {
        ctx.fillStyle = '#336';
      } else if (tile === 5) {
        ctx.fillStyle = '#262';
      } else {
        ctx.fillStyle = '#363';
      }
      ctx.fillRect(ox + x * TILE * scale, oy + y * TILE * scale, Math.max(1, TILE * scale * step), Math.max(1, TILE * scale * step));
    }
  }
  
  // Player on minimap
  ctx.fillStyle = '#0f0';
  ctx.beginPath();
  ctx.arc(ox + player.x * scale, oy + player.y * scale, 2, 0, Math.PI*2);
  ctx.fill();
  
  // Mission zones on minimap
  for (let m of missions) {
    if (!m.zone || m.complete) continue;
    ctx.fillStyle = m.type === player.currentMission ? '#ff0' : '#880';
    ctx.fillRect(ox + m.zone.x * TILE * scale, oy + m.zone.y * TILE * scale,
      m.zone.w * TILE * scale, m.zone.h * TILE * scale);
  }
}

function renderTitle() {
  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Title
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CITY CRIME', canvas.width/2, canvas.height/2 - 100);
  
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('OPEN WORLD', canvas.width/2, canvas.height/2 - 50);
  
  // Subtitle
  ctx.fillStyle = '#888888';
  ctx.font = '16px monospace';
  ctx.fillText('A GTA-Style Open World Crime Game', canvas.width/2, canvas.height/2);
  
  // Instructions
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px monospace';
  let instructions = [
    'Press ENTER to Start',
    '',
    'WASD - Move / Drive',
    'SPACE - Enter/Exit Vehicles',
    'F - Shoot',
    'E - Start Mission',
    'S - Save Game',
    'R - Restart',
    '',
    'Explore the city, steal cars, take missions,',
    'build your criminal empire!'
  ];
  
  for (let i = 0; i < instructions.length; i++) {
    ctx.fillText(instructions[i], canvas.width/2, canvas.height/2 + 50 + i * 22);
  }
  
  // Version
  ctx.fillStyle = '#444444';
  ctx.font = '12px monospace';
  ctx.fillText('v1.0 | Canvas2D | Static HTML5', canvas.width/2, canvas.height - 20);
  ctx.textAlign = 'left';
  
  if (keys['enter']) {
    if (loadGame()) {
      showNotification('Game loaded!');
    } else {
      showNotification('New game started!');
    }
    gameState = 'playing';
  }
}

function renderGameOver() {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', canvas.width/2, canvas.height/2 - 50);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px monospace';
  ctx.fillText('Money earned: $' + player.money, canvas.width/2, canvas.height/2 + 10);
  ctx.fillText('People killed: ' + player.kills, canvas.width/2, canvas.height/2 + 40);
  ctx.fillText('Wanted level reached: ' + player.wantedLevel + '/5', canvas.width/2, canvas.height/2 + 70);
  
  ctx.fillStyle = '#cccccc';
  ctx.font = '18px monospace';
  ctx.fillText('Press R to Restart', canvas.width/2, canvas.height/2 + 120);
  ctx.textAlign = 'left';
  
  if (keys['r']) {
    // Reset
    player.x = 13 * TILE + TILE/2;
    player.y = 13 * TILE + TILE/2;
    player.health = 100;
    player.money = 500;
    player.wantedLevel = 0;
    player.ammo = 20;
    player.kills = 0;
    player.currentMission = null;
    player.inVehicle = null;
    gameState = 'playing';
    bullets.length = 0;
    for (let p of pedestrians) {
      if (p.state === 'dead') {
        p.state = 'walking';
        p.health = 30;
      }
    }
  }
}

// --- Game Loop ---
function gameLoop(timestamp) {
  let dt = timestamp - lastTime;
  lastTime = timestamp;
  if (dt > 100) dt = 16; // Cap at ~10fps minimum
  
  update(dt);
  render();
  
  requestAnimationFrame(gameLoop);
}

// --- Keyboard shortcuts ---
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 's' && gameState === 'playing') saveGame();
  if (e.key.toLowerCase() === 'r') {
    if (gameState === 'gameOver') {
      player.x = 13 * TILE + TILE/2;
      player.y = 13 * TILE + TILE/2;
      player.health = 100;
      player.money = 500;
      player.wantedLevel = 0;
      player.ammo = 20;
      player.kills = 0;
      player.currentMission = null;
      player.inVehicle = null;
      gameState = 'playing';
      bullets.length = 0;
      for (let p of pedestrians) {
        if (p.state === 'dead') { p.state = 'walking'; p.health = 30; }
      }
    }
  }
});

// Start
requestAnimationFrame(gameLoop);
