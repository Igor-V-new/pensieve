// ================================================================
// PENSIEVE NEURAL NETWORK v2 — 3D + звук + HUD + логи
// ================================================================

const canvas = document.getElementById("neuralCanvas");
const ctx = canvas.getContext("2d");

let W, H;
let nodes = [];
let ambientNodes = [];
let mouse = { x: -1000, y: -1000 };
let time = 0;
let lastFrame = performance.now();
let fpsAccum = 0, fpsFrames = 0;

const CFG = {
  ambientCount: 70,
  linkDistance: 180,
  ambientLinkDist: 140,
  mouseInfluence: 240,
  nodeBaseRadius: 28,
  depthRange: 0.6,
};

// ---------------- Звук ----------------
let audioCtx = null;
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { /* нет поддержки */ }
}
window.addEventListener("pointerdown", () => initAudio(), { once: true });

function playBeep(freq = 880, duration = 0.06, vol = 0.05) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
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

// ---------------- Размеры ----------------
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", () => { resize(); });
resize();

// ---------------- Фоновые частицы ----------------
function createAmbient() {
  ambientNodes = [];
  for (let i = 0; i < CFG.ambientCount; i++) {
    ambientNodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      z: Math.random() * 0.8 + 0.6,
    });
  }
}
createAmbient();

// ---------------- Внешний API ----------------
function updateNodes(memories, onClick, onHover) {
  const oldById = new Map(nodes.map(n => [n.id, n]));

  nodes = memories.map((m) => {
    const existing = oldById.get(m.id);
    if (existing) {
      existing.title = m.title;
      existing.tag = m.tag;
      return existing;
    }
    return {
      id: m.id,
      title: m.title,
      tag: m.tag,
      x: W * 0.2 + Math.random() * W * 0.6,
      y: H * 0.2 + Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      z: Math.random() * CFG.depthRange + 0.7,
      phase: Math.random() * Math.PI * 2,
      radius: CFG.nodeBaseRadius,
      hovered: false,
    };
  });

  document.getElementById("nodeCount").textContent = nodes.length;
  const hudNodes = document.getElementById("hudNodes");
  if (hudNodes) hudNodes.textContent = nodes.length;

  canvas.onclick = (e) => {
    const pos = getMousePos(e);
    for (const n of nodes) {
      const d = Math.hypot(n.x - pos.x, n.y - pos.y);
      const hitR = n.radius + 10;
      if (d < hitR) {
        playBeep(1200, 0.08, 0.06);
        log(`OPEN node_${n.id.slice(-4)}`, "ok");
        onClick(n.id);
        return;
      }
    }
  };

  let lastHovered = null;
  canvas.onmousemove = (e) => {
    mouse = getMousePos(e);
    let hoveredNode = null;
    for (const n of nodes) {
      const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
      n.hovered = d < n.radius + 14;
      if (n.hovered) hoveredNode = n.id;
    }
    canvas.style.cursor = hoveredNode ? "pointer" : "crosshair";
    if (hoveredNode !== lastHovered) {
      lastHovered = hoveredNode;
      if (hoveredNode) {
        playBeep(1500, 0.04, 0.03);
        log(`HOVER node_${hoveredNode.slice(-4)}`, "info");
      }
      onHover(hoveredNode);
    }
  };

  canvas.onmouseleave = () => {
    mouse = { x: -1000, y: -1000 };
    nodes.forEach(n => (n.hovered = false));
    onHover(null);
  };
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ---------------- Физика ----------------
function updateNodesPhysics() {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    n.x += n.vx;
    n.y += n.vy;

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const o = nodes[j];
      const dx = n.x - o.x;
      const dy = n.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const minDist = n.radius + o.radius + 40;
      if (d < minDist) {
        const force = (minDist - d) / minDist;
        n.vx += (dx / d) * force * 0.15;
        n.vy += (dy / d) * force * 0.15;
      }
    }

    n.vx += (W / 2 - n.x) * 0.00008;
    n.vy += (H / 2 - n.y) * 0.00008;

    const mdx = n.x - mouse.x;
    const mdy = n.y - mouse.y;
    const md = Math.hypot(mdx, mdy);
    if (md < CFG.mouseInfluence && md > 0) {
      const f = (CFG.mouseInfluence - md) / CFG.mouseInfluence;
      n.vx += (mdx / md) * f * 0.4;
      n.vy += (mdy / md) * f * 0.4;
    }

    n.vx *= 0.96;
    n.vy *= 0.96;

    const margin = n.radius * n.z + 20;
    if (n.x < margin) { n.x = margin; n.vx *= -0.6; }
    if (n.x > W - margin) { n.x = W - margin; n.vx *= -0.6; }
    if (n.y < margin) { n.y = margin; n.vy *= -0.6; }
    if (n.y > H - margin) { n.y = H - margin; n.vy *= -0.6; }

    n.phase += 0.02;
    const pulse = Math.sin(n.phase) * 2;
    const baseR = CFG.nodeBaseRadius * n.z;
    const targetR = baseR + pulse + (n.hovered ? 10 : 0);
    n.radius += (targetR - n.radius) * 0.15;
  }
}

// ---------------- Отрисовка ----------------
function drawGrid() {
  const step = 60;
  ctx.strokeStyle = "rgba(0, 229, 255, 0.04)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function drawAmbient() {
  ctx.lineWidth = 0.5;
  for (let i = 0; i < ambientNodes.length; i++) {
    const a = ambientNodes[i];
    a.x += a.vx * a.z;
    a.y += a.vy * a.z;
    if (a.x < 0 || a.x > W) a.vx *= -1;
    if (a.y < 0 || a.y > H) a.vy *= -1;

    for (let j = i + 1; j < ambientNodes.length; j++) {
      const b = ambientNodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < CFG.ambientLinkDist) {
        const alpha = (1 - d / CFG.ambientLinkDist) * 0.12;
        ctx.strokeStyle = `rgba(0, 180, 220, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = `rgba(0, 200, 240, ${0.4 * a.z})`;
    ctx.beginPath();
    ctx.arc
