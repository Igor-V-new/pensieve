// ================================================================
// PENSIEVE NEURAL NETWORK v4 — ПОЛНОЕ 3D-ПРОСТРАНСТВО
// ================================================================

const canvas = document.getElementById("neuralCanvas");
const ctx = canvas.getContext("2d");
const bloomCanvas = document.getElementById("bloomCanvas");
const bctx = bloomCanvas.getContext("2d");
const sparksLayer = document.getElementById("sparksLayer");

let W, H;
let nodes = [];
let ambientNodes = [];
let pulses = [];
let links = [];
let mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 };
let time = 0;
let lastFrame = performance.now();
let fpsAccum = 0, fpsFrames = 0;
let systemPulse = 0;

const CFG = {
  ambientCount: 120,
  linkDistance: 180,        // 3D-расстояние
  ambientLinkDist: 180,
  mouseInfluence: 280,
  nodeBaseRadius: 24,
  sparkInterval: 28,
  worldRadius: 380,          // радиус сферы, где живут узлы
  autoRotate: 0.0012,        // скорость автовращения
  autoRotateResumeDelay: 3000, // мс бездействия до возврата авто
};

// ---------------- Камера ----------------
const camera = {
  rotX: -0.25,          // наклон вверх/вниз
  rotY: 0.4,            // поворот влево/вправо
  rotZ: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  targetRotX: -0.25,
  targetRotY: 0.4,
  targetZoom: 1,
  targetPanX: 0,
  targetPanY: 0,
  distance: 900,
  lastInteraction: 0,
};

// Восстановление камеры
const CAM_KEY = "pensieve_camera_v4";
function loadCamera() {
  try {
    const raw = localStorage.getItem(CAM_KEY);
    if (!raw) return;
    const c = JSON.parse(raw);
    Object.assign(camera, {
      rotX: c.rotX, rotY: c.rotY, rotZ: c.rotZ ?? 0,
      zoom: c.zoom, panX: c.panX ?? 0, panY: c.panY ?? 0,
    });
    camera.targetRotX = camera.rotX;
    camera.targetRotY = camera.rotY;
    camera.targetZoom = camera.zoom;
    camera.targetPanX = camera.panX;
    camera.targetPanY = camera.panY;
  } catch (e) {}
}
function saveCamera() {
  localStorage.setItem(CAM_KEY, JSON.stringify({
    rotX: camera.rotX, rotY: camera.rotY, rotZ: camera.rotZ,
    zoom: camera.zoom, panX: camera.panX, panY: camera.panY,
  }));
}
loadCamera();

function resetCamera() {
  camera.targetRotX = -0.25;
  camera.targetRotY = 0.4;
  camera.targetZoom = 1;
  camera.targetPanX = 0;
  camera.targetPanY = 0;
  camera.lastInteraction = performance.now();
  saveCamera();
  if (typeof log === "function") log("CAMERA RESET", "ok");
}

// ---------------- 3D-проекция ----------------
// Вращаем точку через матрицы поворота по X, Y, Z
function rotatePoint(p, rx, ry, rz) {
  // Поворот по X
  let cy = Math.cos(rx), sy = Math.sin(rx);
  let y1 = p.y * cy - p.z * sy;
  let z1 = p.y * sy + p.z * cy;
  // Поворот по Y
  let cx = Math.cos(ry), sx = Math.sin(ry);
  let x2 = p.x * cx + z1 * sx;
  let z2 = -p.x * sx + z1 * cx;
  // Поворот по Z
  let cz = Math.cos(rz), sz = Math.sin(rz);
  let x3 = x2 * cz - y1 * sz;
  let y3 = x2 * sz + y1 * cz;
  return { x: x3, y: y3, z: z2 };
}

// Проекция 3D → 2D экран
function project(p) {
  const rotated = rotatePoint(p, camera.rotX, camera.rotY, camera.rotZ);
  const camZ = rotated.z + camera.distance;
  if (camZ <= 10) return null; // за камерой

  const fov = 800;
  const scale = (fov / camZ) * camera.zoom;

  const screenX = W / 2 + rotated.x * scale + camera.panX;
  const screenY = H / 2 + rotated.y * scale + camera.panY;

  return {
    x: screenX,
    y: screenY,
    scale,
    depth: camZ,        // чем больше — тем дальше
    visible: camZ > 20,
  };
}

// ---------------- Звук ----------------
let audioCtx = null;
function initAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
}
window.addEventListener("pointerdown", () => initAudio(), { once: true });

function playBeep(freq = 880, duration = 0.06, vol = 0.05, type = "sine") {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// ---------------- Терминал ----------------
const terminalBody = document.getElementById("terminalBody");
const MAX_LOG = 6;

function log(msg, cls = "info") {
  if (!terminalBody) return;
  const line = document.createElement("div");
  line.className = "terminal-line";
  const t = new Date().toTimeString().slice(0, 8);
  line.innerHTML = `<span class="info">[${t}]</span> <span class="${cls}">${msg}</span>`;
  terminalBody.appendChild(line);
  while (terminalBody.children.length > MAX_LOG) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
}

// ---------------- Цвета по тегам ----------------
const TAG_HUES = [180, 200, 280, 320, 140, 40, 0];
const tagColorCache = new Map();
function getTagHue(tag) {
  if (!tag) return 190;
  if (tagColorCache.has(tag)) return tagColorCache.get(tag);
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  const hue = TAG_HUES[Math.abs(hash) % TAG_HUES.length];
  tagColorCache.set(tag, hue);
  return hue;
}
function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ---------------- Размеры ----------------
function resize() {
  W = canvas.width = bloomCanvas.width = window.innerWidth;
  H = canvas.height = bloomCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// ---------------- Фоновые частицы (в 3D) ----------------
function createAmbient() {
  ambientNodes = [];
  for (let i = 0; i < CFG.ambientCount; i++) {
    // случайная точка в сфере
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = CFG.worldRadius * (1.2 + Math.random() * 0.6);
    ambientNodes.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      vz: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.4 + 0.4,
    });
  }
}
createAmbient();

// ---------------- Искры ----------------
function spawnSpark(x, y) {
  const s = document.createElement("div");
  s.className = "spark";
  s.style.left = x + "px";
  s.style.top = y + "px";
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * 40;
  s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
  s.style.setProperty("--dy", Math.sin(angle) * dist + "px");
  sparksLayer.appendChild(s);
  setTimeout(() => s.remove(), 900);
}

// ---------------- Внешний API ----------------
function updateNodes(memories, onClick, onHover, onDoubleBg) {
  const oldById = new Map(nodes.map(n => [n.id, n]));

  nodes = memories.map((m) => {
    const existing = oldById.get(m.id);
    if (existing) {
      existing.title = m.title;
      existing.tag = m.tag;
      existing.hue = getTagHue(m.tag);
      return existing;
    }
    // случайная точка в сфере
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = CFG.worldRadius * (0.4 + Math.random() * 0.6);
    return {
      id: m.id,
      title: m.title,
      tag: m.tag,
      hue: getTagHue(m.tag),
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      vz: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      radius: CFG.nodeBaseRadius,
      hovered: false,
      flash: 0,
      dying: false,
    };
  });

  // явные связи
  links = [];
  for (const m of memories) {
    const linkIds = (m.links || "").split(",").map(s => s.trim()).filter(Boolean);
    for (const lid of linkIds) {
      for (const n of nodes) {
        if (n.id.endsWith(lid) && n.id !== m.id) {
          links.push({ a: m.id, b: n.id });
          break;
        }
      }
    }
  }

  document.getElementById("nodeCount").textContent = nodes.length;
  const hudNodes = document.getElementById("hudNodes");
  if (hudNodes) hudNodes.textContent = nodes.length;
  const hudLinks = document.getElementById("hudLinks");
  if (hudLinks) hudLinks.textContent = links.length;

  // Плавное исчезновение удалённых
  for (const [id, oldN] of oldById) {
    if (!nodes.find(n => n.id === id)) {
      oldN.dying = true;
      nodes.push(oldN);
      setTimeout(() => {
        const idx = nodes.indexOf(oldN);
        if (idx !== -1) nodes.splice(idx, 1);
      }, 600);
    }
  }

  // Сохраняем колбэки для использования в обработчиках мыши
  window._pensieveOnClick = onClick;
  window._pensieveOnHover = onHover;
  window._pensieveOnDoubleBg = onDoubleBg;
}

function scrambleNodes() {
  for (const n of nodes) {
    n.vx = (Math.random() - 0.5) * 14;
    n.vy = (Math.random() - 0.5) * 14;
    n.vz = (Math.random() - 0.5) * 14;
  }
  if (typeof log === "function") log("SCRAMBLE 3D", "warn");
  if (typeof playBeep === "function") playBeep(400, 0.15, 0.06, "sawtooth");
}

// ---------------- Обработка мыши / touch ----------------
let isDragging = false;
let isPanning = false;
let dragStart = { x: 0, y: 0 };
let dragStartCam = { rotX: 0, rotY: 0, panX: 0, panY: 0 };
let lastHoveredId = null;

// Хелпер: найти узел под курсором (по проекции)
function findNodeUnderCursor(mx, my) {
  let best = null;
  let bestDepth = Infinity;

  for (const n of nodes) {
    if (n.dying) continue;
    const p = project(n);
    if (!p || !p.visible) continue;
    const dx = p.x - mx;
    const dy = p.y - my;
    const hitR = Math.max(8, n.radius * p.scale * 0.85 + 8);
    if (dx * dx + dy * dy < hitR * hitR) {
      // выбираем ближайший к камере
      if (p.depth < bestDepth) {
        bestDepth = p.depth;
        best = n;
      }
    }
  }
  return best;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// === ЛКМ: вращение ИЛИ клик по узлу ===
canvas.addEventListener("mousedown", (e) => {
  const pos = getMousePos(e);
  const hit = findNodeUnderCursor(pos.x, pos.y);

  if (e.button === 0 && !hit && !e.shiftKey) {
    // ЛКМ по пустому — вращение
    isDragging = true;
    canvas.classList.add("dragging");
    dragStart.x = pos.x;
    dragStart.y = pos.y;
    dragStartCam.rotX = camera.targetRotX;
    dragStartCam.rotY = camera.targetRotY;
    camera.lastInteraction = performance.now();
  } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
    // ПКМ или Shift+ЛКМ — панорамирование
    isPanning = true;
    canvas.classList.add("dragging");
    dragStart.x = pos.x;
    dragStart.y = pos.y;
    dragStartCam.panX = camera.targetPanX;
    dragStartCam.panY = camera.targetPanY;
    camera.lastInteraction = performance.now();
  }
});

// === Движение мыши ===
canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = pos.x;
  mouse.y = pos.y;

  if (isDragging) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    camera.targetRotY = dragStartCam.rotY + dx * 0.006;
    camera.targetRotX = dragStartCam.rotX - dy * 0.006;
    camera.lastInteraction = performance.now();
    return;
  }
  if (isPanning) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    camera.targetPanX = dragStartCam.panX + dx;
    camera.targetPanY = dragStartCam.panY + dy;
    camera.lastInteraction = performance.now();
    return;
  }

  // hover
  const hit = findNodeUnderCursor(pos.x, pos.y);
  const hoveredId = hit ? hit.id : null;
  canvas.classList.toggle("hovering-node", !!hit);

  for (const n of nodes) n.hovered = (n === hit);

  if (hoveredId !== lastHoveredId) {
    lastHoveredId = hoveredId;
    if (hoveredId && typeof playBeep === "function") {
      playBeep(1500, 0.04, 0.03);
      if (typeof log === "function") log(`HOVER node_${hoveredId.slice(-4)}`, "info");
    }
    if (window._pensieveOnHover) window._pensieveOnHover(hoveredId);
  }
});

// === Отпускание кнопки ===
window.addEventListener("mouseup", (e) => {
  if (isDragging || isPanning) {
    isDragging = false;
    isPanning = false;
    canvas.classList.remove("dragging");
    saveCamera();
  }
});

// === Клик (быстрый без движения) ===
let clickStartTime = 0;
let clickStartPos = { x: 0, y: 0 };
canvas.addEventListener("mousedown", (e) => {
  clickStartTime = performance.now();
  clickStartPos = getMousePos(e);
});

canvas.addEventListener("click", (e) => {
  const dt = performance.now() - clickStartTime;
  const pos = getMousePos(e);
  const moved = Math.hypot(pos.x - clickStartPos.x, pos.y - clickStartPos.y);

  // игнорируем клики после перетаскивания
  if (moved > 5 || dt > 400) return;

  const hit = findNodeUnderCursor(pos.x, pos.y);
  if (hit) {
    if (typeof playBeep === "function") playBeep(1200, 0.08, 0.06);
    if (typeof log === "function") log(`OPEN node_${hit.id.slice(-4)}`, "ok");
    pulses.push({ x: hit.x, y: hit.y, z: hit.z, r: 0, max: 100, hue: hit.hue });
    if (window._pensieveOnClick) window._pensieveOnClick(hit.id);
  } else {
    pulses.push({ x: 0, y: 0, z: 0, r: 0, max: 200, hue: 190 });
    if (typeof playBeep === "function") playBeep(600, 0.1, 0.04);
  }
});

// === Двойной клик по фону — сброс ===
canvas.addEventListener("dblclick", (e) => {
  const pos = getMousePos(e);
  const hit = findNodeUnderCursor(pos.x, pos.y);
  if (!hit && window._pensieveOnDoubleBg) {
    if (typeof log === "function") log("RESET FILTERS + SHUFFLE", "warn");
    window._pensieveOnDoubleBg();
  }
});

// === Контекстное меню отключаем (ПКМ = панорамирование) ===
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// === Колесо: зум ===
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  camera.targetZoom = Math.max(0.2, Math.min(4, camera.targetZoom * factor));
  camera.lastInteraction = performance.now();
  saveCamera();
}, { passive: false });

// === Mouse leave ===
canvas.addEventListener("mouseleave", () => {
  mouse.x = -1000; mouse.y = -1000;
  nodes.forEach(n => (n.hovered = false));
  if (window._pensieveOnHover) window._pensieveOnHover(null);
});

// === Touch (базовая поддержка) ===
let touchStartDist = 0;
let touchStartZoom = 1;
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    isDragging = true;
    dragStart.x = t.clientX;
    dragStart.y = t.clientY;
    dragStartCam.rotX = camera.targetRotX;
    dragStartCam.rotY = camera.targetRotY;
    camera.lastInteraction = performance.now();
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchStartDist = Math.hypot(dx, dy);
    touchStartZoom = camera.targetZoom;
  }
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 1 && isDragging) {
    const t = e.touches[0];
    const dx = t.clientX - dragStart.x;
    const dy = t.clientY - dragStart.y;
    camera.targetRotY = dragStartCam.rotY + dx * 0.006;
    camera.targetRotX = dragStartCam.rotX - dy * 0.006;
    camera.lastInteraction = performance.now();
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (touchStartDist > 0) {
      camera.targetZoom = Math.max(0.2, Math.min(4, touchStartZoom * (dist / touchStartDist)));
    }
  }
}, { passive: true });

canvas.addEventListener("touchend", () => {
  isDragging = false;
  touchStartDist = 0;
  saveCamera();
}, { passive: true });

// ---------------- Физика 3D ----------------
function updatePhysics() {
  // кластерное притяжение по тегам
  const byTag = new Map();
  for (const n of nodes) {
    if (!n.tag) continue;
    if (!byTag.has(n.tag)) byTag.set(n.tag, []);
    byTag.get(n.tag).push(n);
  }

  for (const n of nodes) {
    if (n.dying) { n.radius *= 0.94; continue; }

    // дрейф
    n.x += n.vx;
    n.y += n.vy;
    n.z += n.vz;

    // отталкивание в 3D
    for (const o of nodes) {
      if (o === n || o.dying) continue;
      const dx = n.x - o.x, dy = n.y - o.y, dz = n.z - o.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const minDist = n.radius + o.radius + 50;
      if (d < minDist) {
        const f = (minDist - d) / minDist;
        n.vx += (dx / d) * f * 0.2;
        n.vy += (dy / d) * f * 0.2;
        n.vz += (dz / d) * f * 0.2;
      }
    }

    // притяжение к центру мира
    const dc = Math.hypot(n.x, n.y, n.z) || 1;
    n.vx -= (n.x / dc) * 0.0006;
    n.vy -= (n.y / dc) * 0.0006;
    n.vz -= (n.z / dc) * 0.0006;

    // кластер по тегу
    if (n.tag && byTag.get(n.tag).length > 1) {
      const cluster = byTag.get(n.tag);
      let cx = 0, cy = 0, cz = 0;
      for (const c of cluster) { cx += c.x; cy += c.y; cz += c.z; }
      cx /= cluster.length; cy /= cluster.length; cz /= cluster.length;
      n.vx += (cx - n.x) * 0.0005;
      n.vy += (cy - n.y) * 0.0005;
      n.vz += (cz - n.z) * 0.0005;
    }

    // ограничение в сфере
    const dist = Math.hypot(n.x, n.y, n.z);
    const maxR = CFG.worldRadius * 1.4;
    if (dist > maxR) {
      const k = maxR / dist;
      n.x *= k; n.y *= k; n.z *= k;
      n.vx *= -0.5; n.vy *= -0.5; n.vz *= -0.5;
    }

    // трение
    n.vx *= 0.965;
    n.vy *= 0.965;
    n.vz *= 0.965;

    n.phase += 0.02;
    const pulse = Math.sin(n.phase) * 2;
    const targetR = CFG.nodeBaseRadius + pulse + (n.hovered ? 10 : 0);
    n.radius += (targetR - n.radius) * 0.15;
  }

  // фоновые частицы дрейфуют
  for (const a of ambientNodes) {
    a.x += a.vx;
    a.y += a.vy;
    a.z += a.vz;
    const d = Math.hypot(a.x, a.y, a.z);
    if (d > CFG.worldRadius * 2) {
      a.vx *= -1; a.vy *= -1; a.vz *= -1;
    }
  }
}

// ---------------- Камера: плавная интерполяция + автовращение ----------------
function updateCamera() {
  // автовращение, если давно не трогали
  const idle = performance.now() - camera.lastInteraction;
  if (idle > CFG.autoRotateResumeDelay && !isDragging && !isPanning) {
    camera.targetRotY += CFG.autoRotate;
  }

  // плавная интерполяция
  const lerp = 0.12;
  camera.rotX += (camera.targetRotX - camera.rotX) * lerp;
  camera.rotY += (camera.targetRotY - camera.rotY) * lerp;
  camera.rotZ += (camera.targetRotZ - camera.rotZ) * lerp;
  camera.zoom += (camera.targetZoom - camera.zoom) * lerp;
  camera.panX += (camera.targetPanX - camera.panX) * lerp;
  camera.panY += (camera.targetPanY - camera.panY) * lerp;
}

// ---------------- Отрисовка ----------------
function drawScene(c) {
  // ====== Осевые линии (X, Y, Z) ======
  const axisLen = CFG.worldRadius * 1.4;
  const axes = [
    { p1: { x: -axisLen, y: 0, z: 0 }, p2: { x: axisLen, y: 0, z: 0 }, color: "rgba(255, 80, 80, 0.12)" },
    { p1: { x: 0, y: -axisLen, z: 0 }, p2: { x: 0, y: axisLen, z: 0 }, color: "rgba(80, 255, 80, 0.12)" },
    { p1: { x: 0, y: 0, z: -axisLen }, p2: { x: 0, y: 0, z: axisLen }, color: "rgba(80, 80, 255, 0.12)" },
  ];
  for (const ax of axes) {
    const p1 = project(ax.p1);
    const p2 = project(ax.p2);
    if (!p1 || !p2) continue;
    c.strokeStyle = ax.color;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.stroke();
  }

  // ====== Фоновые частицы ======
  const ambientProjected = [];
  for (const a of ambientNodes) {
    const p = project(a);
    if (!p || !p.visible) continue;
    const aScale = Math.min(2, p.scale);
    if (aScale < 0.05) continue;
    const aDepth = Math.min(1, 400 / p.depth);
    ambientProjected.push({ p, aScale, aDepth, node: a });
  }
  // связи фоновых
  c.lineWidth = 0.5;
  for (let i = 0; i < ambientProjected.length; i++) {
    const A = ambientProjected[i];
    for (let j = i + 1; j < ambientProjected.length; j++) {
      const B = ambientProjected[j];
      const d3 = Math.hypot(
        A.node.x - B.node.x,
        A.node.y - B.node.y,
        A.node.z - B.node.z
      );
      if (d3 < CFG.ambientLinkDist) {
        const alpha = (1 - d3 / CFG.ambientLinkDist) * 0.1 * Math.min(A.aDepth, B.aDepth);
        c.strokeStyle = `rgba(0, 180, 220, ${alpha})`;
        c.beginPath();
        c.moveTo(A.p.x, A.p.y);
        c.lineTo(B.p.x, B.p.y);
        c.stroke();
      }
    }
  }
  for (const A of ambientProjected) {
    c.fillStyle = `rgba(0, 200, 240, ${0.4 * A.aDepth})`;
    c.beginPath();
    c.arc(A.p.x, A.p.y, A.node.size * A.aScale * 0.9, 0, Math.PI * 2);
    c.fill();
  }

  // ====== Проекции всех узлов ======
  const projected = [];
  for (const n of nodes) {
    const p = project(n);
    if (!p || !p.visible) continue;
    projected.push({ node: n, proj: p });
  }

  // сортируем по глубине: дальние — раньше
  projected.sort((a, b) => b.proj.depth - a.proj.depth);

  // ====== Триангуляция (нити между близкими узлами) ======
  for (let i = 0; i < projected.length; i++) {
    const A = projected[i];
    if (A.node.dying) continue;
    for (let j = i + 1; j < projected.length; j++) {
      const B = projected[j];
      if (B.node.dying) continue;
      const a = A.node, b = B.node;
      const d3 = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d3 >= CFG.linkDistance) continue;

      const avgDepth = Math.min(1, 400 / ((A.proj.depth + B.proj.depth) / 2));
      const alpha = (1 - d3 / CFG.linkDistance) * 0.7 * avgDepth * (0.7 + systemPulse * 0.3);
      const hue = (a.hue + b.hue) / 2;

      c.save();
      c.shadowBlur = 8 * avgDepth;
      c.shadowColor = hsl(hue, 100, 60, alpha);
      c.strokeStyle = hsl(hue, 90, 55, alpha);
      c.lineWidth = 1.2 * avgDepth;
      c.beginPath();
      c.moveTo(A.proj.x, A.proj.y);
      // лёгкая кривизна
      const mx = (A.proj.x + B.proj.x) / 2 + Math.sin(time * 0.02 + i + j) * 6;
      const my = (A.proj.y + B.proj.y) / 2 + Math.cos(time * 0.02 + i + j) * 6;
      c.quadraticCurveTo(mx, my, B.proj.x, B.proj.y);
      c.stroke();
      c.restore();

      // импульс по нити
      const t = ((time * 0.01 + i * 0.3 + j * 0.7) % 1);
      const px = A.proj.x + (B.proj.x - A.proj.x) * t;
      const py = A.proj.y + (B.proj.y - A.proj.y) * t;
      c.fillStyle = hsl(hue, 100, 85, alpha * 1.4);
      c.beginPath();
      c.arc(px, py, 1.8 * avgDepth, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ====== Явные связи ======
  for (const link of links) {
    const A = projected.find(p => p.node.id === link.a);
    const B = projected.find(p => p.node.id === link.b);
    if (!A || !B) continue;
    const avgDepth = Math.min(1, 400 / ((A.proj.depth + B.proj.depth) / 2));
    c.save();
    c.shadowBlur = 16 * avgDepth;
    c.shadowColor = hsl(190, 100, 65, 0.9);
    c.strokeStyle = hsl(190, 100, 70, (0.7 + systemPulse * 0.3) * avgDepth);
    c.lineWidth = 2.5 * avgDepth;
    c.setLineDash([4, 4]);
    c.lineDashOffset = -time * 0.4;
    c.beginPath();
    c.moveTo(A.proj.x, A.proj.y);
    c.lineTo(B.proj.x, B.proj.y);
    c.stroke();
    c.restore();
  }

  // ====== Нити от курсора ======
  if (mouse.x > 0 && mouse.y > 0 && !isDragging && !isPanning) {
    for (const P of projected) {
      const n = P.node;
      if (n.dying) continue;
      const dx = P.proj.x - mouse.x;
      const dy = P.proj.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < CFG.mouseInfluence) {
        const alpha = (1 - d / CFG.mouseInfluence) * 0.8;
        c.save();
        c.shadowBlur = 10;
        c.shadowColor = hsl(n.hue, 100, 60, alpha);
        c.strokeStyle = hsl(n.hue, 100, 70, alpha);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(mouse.x, mouse.y);
        c.lineTo(P.proj.x, P.proj.y);
        c.stroke();
        c.restore();
      }
    }
  }

  // ====== Волны от кликов (в 3D) ======
  for (const pulse of pulses) {
    pulse.r += 8;
    const p = project({ x: pulse.x, y: pulse.y, z: pulse.z });
    if (!p) continue;
    const alpha = Math.max(0, 1 - pulse.r / pulse.max);
    c.strokeStyle = hsl(pulse.hue, 100, 70, alpha);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, pulse.r * p.scale, 0, Math.PI * 2);
    c.stroke();
  }
  pulses = pulses.filter(p => p.r < p.max);

  // ====== Узлы (в порядке дальности) ======
  for (const P of projected) {
    const n = P.node;
    const p = P.proj;
    const depthFactor = Math.min(1, 500 / p.depth); // 0..1
    const r = n.radius * p.scale;
    if (r < 0.5) continue;

    const hue = n.hue;
    const alphaZ = depthFactor + n.flash * 0.4;

    // свечение
    const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
    glow.addColorStop(0, hsl(hue, 100, 65, 0.6 * alphaZ));
    glow.addColorStop(0.5, hsl(hue, 100, 50, 0.15 * alphaZ));
    glow.addColorStop(1, hsl(hue, 100, 50, 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    c.fill();

    // вращающееся кольцо
    c.save();
    c.translate(p.x, p.y);
    c.rotate(time * 0.01 + n.phase);
    c.strokeStyle = hsl(hue, 100, 70, (n.hovered ? 0.95 : 0.55) * alphaZ);
    c.lineWidth = 1.5 * depthFactor;
    c.beginPath();
    c.arc(0, 0, r + 6 * depthFactor, 0, Math.PI * 1.4);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r + 6 * depthFactor, Math.PI * 1.5, Math.PI * 1.85);
    c.stroke();
    c.restore();

    // пунктирное внешнее кольцо
    c.strokeStyle = hsl(hue, 100, 70, 0.25 * alphaZ);
    c.lineWidth = 1;
    c.setLineDash([2, 4]);
    c.beginPath();
    c.arc(p.x, p.y, r + 16 * depthFactor, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    // ядро
    const core = c.createRadialGradient(
      p.x - r * 0.3, p.y - r * 0.3, 0,
      p.x, p.y, r
    );
    core.addColorStop(0, hsl(hue, 100, 90, alphaZ));
    core.addColorStop(0.5, hsl(hue, 100, 60, 0.95 * alphaZ));
    core.addColorStop(1, hsl(hue, 100, 35, 0.7 * alphaZ));
    c.fillStyle = core;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fill();

    // блик
    c.fillStyle = `rgba(255, 255, 255, ${0.7 * alphaZ})`;
    c.beginPath();
    c.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.2, 0, Math.PI * 2);
    c.fill();

    // название (только если достаточно близко)
    if (depthFactor > 0.4) {
      c.font = `${Math.max(9, 11 * depthFactor)}px Consolas, monospace`;
      c.fillStyle = n.hovered
        ? hsl(hue, 100, 90, alphaZ)
        : hsl(hue, 100, 75, 0.85 * alphaZ);
      c.textAlign = "center";
      c.shadowBlur = 6;
      c.shadowColor = hsl(hue, 100, 60, 0.8);
      const label = n.title.length > 18 ? n.title.slice(0, 16) + "…" : n.title;
      c.fillText(label.toUpperCase(), p.x, p.y + r + 22 * depthFactor);
      c.shadowBlur = 0;
    }
  }
}

// ---------------- Bloom ----------------
function applyBloom() {
  bctx.clearRect(0, 0, W, H);
  bctx.drawImage(canvas, 0, 0);
  bctx.globalCompositeOperation = "source-over";
}

// ---------------- HUD ----------------
const hudCursor = document.getElementById("hudCursor");
const hudFps = document.getElementById("hudFps");
const hudRot = document.getElementById("hudRot");
const hudZoom = document.getElementById("hudZoom");

function updateHud(dt) {
  if (hudCursor) hudCursor.textContent = `${Math.round(mouse.x)}, ${Math.round(mouse.y)}`;
  if (hudRot) {
    const degX = ((camera.rotX * 180 / Math.PI) % 360).toFixed(0);
    const degY = ((camera.rotY * 180 / Math.PI) % 360).toFixed(0);
    hudRot.textContent = `${degX}°, ${degY}°`;
  }
  if (hudZoom) hudZoom.textContent = camera.zoom.toFixed(2);
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 500) {
    const fps = Math.round(1000 / (fpsAccum / fpsFrames));
    if (hudFps) hudFps.textContent = fps;
    fpsAccum = 0;
    fpsFrames = 0;
  }
}

// ---------------- Главный цикл ----------------
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  time++;
  systemPulse = (Math.sin(time * 0.02) + 1) / 2;

  ctx.fillStyle = "rgba(0, 2, 8, 0.32)";
  ctx.fillRect(0, 0, W, H);

  updateCamera();
  updatePhysics();
  drawScene(ctx);
  applyBloom();

  if (time % CFG.sparkInterval === 0 && mouse.x > 0 && mouse.y > 0 && !isDragging && !isPanning) {
    if (Math.abs(mouse.x - mouse.prevX) + Math.abs(mouse.y - mouse.prevY) > 3) {
      spawnSpark(mouse.x, mouse.y);
    }
  }

  updateHud(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------- Публичный API сброса ----------------
window.resetPensieveCamera = resetCamera;

// ---------------- Приветствие ----------------
log("SYS.INIT v4 · 3D", "ok");
log("CAMERA ONLINE", "ok");
log("NEURAL NET ONLINE", "ok");
log("DRAG TO ROTATE", "info");
