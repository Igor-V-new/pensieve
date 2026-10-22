// ================================================================
// PENSIEVE NEURAL NETWORK — визуализация нитей памяти
// ================================================================

const canvas = document.getElementById("neuralCanvas");
const ctx = canvas.getContext("2d");

let W, H;
let nodes = [];          // узлы-воспоминания (позиции + связь с memory)
let ambientNodes = [];   // фоновые частицы
let mouse = { x: -1000, y: -1000 };
let time = 0;

// Настройки
const CFG = {
  ambientCount: 60,          // фоновых частиц
  linkDistance: 180,         // макс. расстояние для нити между узлами
  ambientLinkDist: 140,      // для фоновых частиц
  mouseInfluence: 220,       // радиус влияния курсора
  nodeBaseRadius: 28,        // базовый радиус узла-воспоминания
  nodePulse: 4,              // амплитуда пульсации
};

// ---------- Инициализация размеров ----------
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", () => {
  resize();
  layoutNodes();
});
resize();

// ---------- Фоновые частицы ----------
function createAmbient() {
  ambientNodes = [];
  for (let i = 0; i < CFG.ambientCount; i++) {
    ambientNodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    });
  }
}
createAmbient();

// ---------- Внешний API (вызывается из script.js) ----------
/**
 * Обновить узлы при изменении воспоминаний.
 * @param {Array} memories — массив {id, title, tag}
 * @param {Function} onClick — коллбэк клика
 * @param {Function} onHover — коллбэк наведения (id | null)
 */
function updateNodes(memories, onClick, onHover) {
  const oldById = new Map(nodes.map(n => [n.id, n]));

  nodes = memories.map((m, i) => {
    const existing = oldById.get(m.id);
    if (existing) {
      // сохраняем позицию существующего узла
      existing.title = m.title;
      existing.tag = m.tag;
      return existing;
    }
    // новый узел — случайная позиция в центральной области
    return {
      id: m.id,
      title: m.title,
      tag: m.tag,
      x: W * 0.2 + Math.random() * W * 0.6,
      y: H * 0.2 + Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2, // для пульсации
      radius: CFG.nodeBaseRadius,
      hovered: false,
    };
  });

  // назначаем обработчики
  canvas.onclick = (e) => {
    const pos = getMousePos(e);
    for (const n of nodes) {
      const d = Math.hypot(n.x - pos.x, n.y - pos.y);
      if (d < n.radius + 8) {
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
      n.hovered = d < n.radius + 12;
      if (n.hovered) hoveredNode = n.id;
    }
    canvas.style.cursor = hoveredNode ? "pointer" : "crosshair";
    if (hoveredNode !== lastHovered) {
      lastHovered = hoveredNode;
      onHover(hoveredNode);
    }
  };

  canvas.onmouseleave = () => {
    mouse = { x: -1000, y: -1000 };
    nodes.forEach(n => (n.hovered = false));
    onHover(null);
  };

  document.getElementById("nodeCount").textContent = nodes.length;
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// ---------- Физика узлов ----------
function updateNodesPhysics() {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    // дрейф
    n.x += n.vx;
    n.y += n.vy;

    // отталкивание от других узлов
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

    // притяжение к центру (мягкое)
    const cx = W / 2;
    const cy = H / 2;
    n.vx += (cx - n.x) * 0.00008;
    n.vy += (cy - n.y) * 0.00008;

    // реакция на курсор — лёгкое отталкивание
    const mdx = n.x - mouse.x;
    const mdy = n.y - mouse.y;
    const md = Math.hypot(mdx, mdy);
    if (md < CFG.mouseInfluence && md > 0) {
      const f = (CFG.mouseInfluence - md) / CFG.mouseInfluence;
      n.vx += (mdx / md) * f * 0.4;
      n.vy += (mdy / md) * f * 0.4;
    }

    // трение
    n.vx *= 0.96;
    n.vy *= 0.96;

    // границы
    const margin = n.radius + 20;
    if (n.x < margin) { n.x = margin; n.vx *= -0.6; }
    if (n.x > W - margin) { n.x = W - margin; n.vx *= -0.6; }
    if (n.y < margin) { n.y = margin; n.vy *= -0.6; }
    if (n.y > H - margin) { n.y = H - margin; n.vy *= -0.6; }

    // пульсация
    n.phase += 0.02;
    const pulse = Math.sin(n.phase) * 2;
    const targetR = CFG.nodeBaseRadius + pulse + (n.hovered ? 10 : 0);
    n.radius += (targetR - n.radius) * 0.15;
  }
}

// ---------- Фон: сетка HUD ----------
function drawGrid() {
  const step = 60;
  ctx.strokeStyle = "rgba(0, 229, 255, 0.04)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = 0; x < W; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y < H; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

// ---------- Фоновые частицы ----------
function drawAmbient() {
  // связи между частицами
  ctx.lineWidth = 0.5;
  for (let i = 0; i < ambientNodes.length; i++) {
    const a = ambientNodes[i];
    a.x += a.vx;
    a.y += a.vy;
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

    // точка
    ctx.fillStyle = "rgba(0, 200, 240, 0.4)";
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Нити между узлами памяти ----------
function drawNodeLinks() {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);

      if (d < CFG.linkDistance) {
        const alpha = (1 - d / CFG.linkDistance) * 0.7;

        // свечение нити
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(0, 229, 255, ${alpha})`;

        ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.9})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // лёгкая кривизна — «нервная» нить
        const mx = (a.x + b.x) / 2 + Math.sin(time * 0.02 + i + j) * 8;
        const my = (a.y + b.y) / 2 + Math.cos(time * 0.02 + i + j) * 8;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();
        ctx.restore();

        // бегущий импульс по нити
        const t = ((time * 0.01 + i * 0.3 + j * 0.7) % 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        ctx.fillStyle = `rgba(180, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------- Нити от курсора к узлам ----------
function drawMouseLinks() {
  for (const n of nodes) {
    const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
    if (d < CFG.mouseInfluence) {
      const alpha = (1 - d / CFG.mouseInfluence) * 0.8;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(0, 229, 255, ${alpha})`;
      ctx.strokeStyle = `rgba(100, 240, 255, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------- Узлы-воспоминания ----------
function drawNodes() {
  for (const n of nodes) {
    // внешнее свечение
    const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 2.5);
    glow.addColorStop(0, "rgba(0, 229, 255, 0.5)");
    glow.addColorStop(0.5, "rgba(0, 229, 255, 0.1)");
    glow.addColorStop(1, "rgba(0, 229, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // вращающееся кольцо
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(time * 0.01 + n.phase);
    ctx.strokeStyle = `rgba(0, 229, 255, ${n.hovered ? 0.9 : 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, n.radius + 6, 0, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, n.radius + 6, Math.PI * 1.5, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();

    // внешнее кольцо-«орбита»
    ctx.strokeStyle = "rgba(0, 180, 220, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius + 14, 0, Math.PI * 2);
    ctx.stroke();

    // ядро
    const core = ctx.createRadialGradient(
      n.x - n.radius * 0.3, n.y - n.radius * 0.3, 0,
      n.x, n.y, n.radius
    );
    core.addColorStop(0, "rgba(180, 255, 255, 1)");
    core.addColorStop(0.5, "rgba(0, 200, 240, 0.9)");
    core.addColorStop(1, "rgba(0, 100, 150, 0.6)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fill();

    // блик
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(n.x - n.radius * 0.3, n.y - n.radius * 0.3, n.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // подпись — название
    ctx.font = "11px Consolas, monospace";
    ctx.fillStyle = n.hovered ? "rgba(180, 255, 255, 1)" : "rgba(0, 229, 255, 0.75)";
    ctx.textAlign = "center";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
    const label = n.title.length > 18 ? n.title.slice(0, 16) + "…" : n.title;
    ctx.fillText(label.toUpperCase(), n.x, n.y + n.radius + 28);
    ctx.shadowBlur = 0;
  }
}

// ---------- Главный цикл ----------
function loop() {
  time++;

  // очистка с лёгким шлейфом
  ctx.fillStyle = "rgba(0, 2, 8, 0.35)";
  ctx.fillRect(0, 0, W, H);

  drawGrid();
  drawAmbient();
  drawNodeLinks();
  drawMouseLinks();

  updateNodesPhysics();
  drawNodes();

  requestAnimationFrame(loop);
}
loop();
