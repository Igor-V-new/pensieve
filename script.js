// ================================================================
// PENSIEVE v4.1 — данные, CRUD, экспорт/импорт, таймлайн
// ================================================================
"use strict";

let memories = [];
let activeTag = null;
let searchQuery = "";
const STORAGE_KEY = "pensieve_memories_v3";

// ---------------- DOM ----------------
const form = document.getElementById("memoryForm");
const toggleForm = document.getElementById("toggleForm");
const editId = document.getElementById("editId");
const titleInput = document.getElementById("title");
const textInput = document.getElementById("text");
const dateInput = document.getElementById("date");
const tagInput = document.getElementById("tag");
const linksInput = document.getElementById("links");
const tagSuggest = document.getElementById("tagSuggest");
const submitBtn = document.getElementById("submitBtn");
const cancelEdit = document.getElementById("cancelEdit");

const tagFilters = document.getElementById("tagFilters");
const searchInput = document.getElementById("search");
const timeline = document.getElementById("timeline");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const scrambleBtn = document.getElementById("scrambleBtn");
const resetCamBtn = document.getElementById("resetCamBtn");

const helpHint = document.getElementById("helpHint");
const helpClose = document.getElementById("helpClose");

const modal = document.getElementById("modal");
const modalId = document.getElementById("modalId");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalText = document.getElementById("modalText");
const modalTag = document.getElementById("modalTag");
const modalLinks = document.getElementById("modalLinks");
const closeModalBtn = document.getElementById("closeModal");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");

let currentModalId = null;

// ---------------- Safe storage ----------------
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); return true; }
  catch (e) {
    console.warn("localStorage set failed:", e);
    if (typeof log === "function") log("STORAGE FULL!", "warn");
    return false;
  }
}

// ---------------- Storage ----------------
function loadMemories() {
  try {
    const raw = safeGet(STORAGE_KEY);
    if (raw) {
      memories = JSON.parse(raw);
    } else {
      const old = safeGet("pensieve_memories");
      memories = old ? JSON.parse(old) : [];
      memories = memories.map(m => ({ links: "", ...m }));
    }
  } catch (e) {
    console.error("load failed:", e);
    memories = [];
  }
}

function saveMemories() {
  return safeSet(STORAGE_KEY, JSON.stringify(memories));
}

// ---------------- Утилиты ----------------
function formatDate(iso) {
  if (!iso) return "";
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${Number(d)} ${months[Number(m) - 1] || ""} ${y}`;
}

function shortId(id) {
  return id.slice(-4);
}

// ---------------- Форма ----------------
toggleForm.addEventListener("click", () => {
  form.classList.toggle("hidden");
  log("FORM.TOGGLE", "info");
});

cancelEdit.addEventListener("click", resetForm);

function resetForm() {
  editId.value = "";
  form.reset();
  dateInput.valueAsDate = new Date();
  submitBtn.textContent = "СОЗДАТЬ УЗЕЛ";
  cancelEdit.classList.add("hidden");
  form.classList.add("hidden");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    title: titleInput.value.trim(),
    text: textInput.value.trim(),
    date: dateInput.value,
    tag: tagInput.value.trim(),
    links: linksInput.value.trim(),
  };

  if (!data.title || !data.text || !data.date) return;

  if (editId.value) {
    const idx = memories.findIndex(m => m.id === editId.value);
    if (idx !== -1) {
      memories[idx] = { ...memories[idx], ...data };
      log(`EDIT node_${shortId(editId.value)}`, "ok");
    }
  } else {
    const m = {
      id: Date.now().toString(),
      ...data,
      createdAt: Date.now(),
    };
    memories.push(m);
    log(`CREATE node_${shortId(m.id)}`, "ok");
    playBeep(1000, 0.1, 0.06);
  }

  saveMemories();
  resetForm();
  render();
});

// ---------------- Модалка ----------------
function openModal(id) {
  const m = memories.find((x) => x.id === id);
  if (!m) return;
  currentModalId = id;

  modalId.textContent = shortId(m.id);
  modalTitle.textContent = m.title;
  modalDate.textContent = formatDate(m.date);
  modalText.textContent = m.text;
  modalTag.textContent = m.tag ? "#" + m.tag : "";
  modalTag.style.display = m.tag ? "inline-block" : "none";

  modalLinks.innerHTML = "";
  const linkIds = (m.links || "").split(",").map(s => s.trim()).filter(Boolean);
  if (linkIds.length > 0) {
    const label = document.createElement("span");
    label.style.color = "rgba(0, 229, 255, 0.5)";
    label.style.fontSize = "0.72rem";
    label.style.marginRight = "6px";
    label.textContent = "СВЯЗИ:";
    modalLinks.appendChild(label);

    linkIds.forEach(lid => {
      const target = memories.find(x => x.id !== m.id && x.id.endsWith(lid));
      const chip = document.createElement("span");
      chip.className = "link-chip";
      chip.textContent = target
        ? `${shortId(target.id)} · ${target.title.slice(0, 20)}`
        : `${lid} (не найдено)`;
      if (target) {
        chip.onclick = () => {
          closeModal();
          setTimeout(() => openModal(target.id), 100);
        };
      }
      modalLinks.appendChild(chip);
    });
  }

  modal.classList.remove("hidden");
  log(`VIEW node_${shortId(id)}`, "info");
}

function closeModal() {
  modal.classList.add("hidden");
  currentModalId = null;
}

closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

editBtn.addEventListener("click", () => {
  const m = memories.find(x => x.id === currentModalId);
  if (!m) return;

  editId.value = m.id;
  titleInput.value = m.title;
  textInput.value = m.text;
  dateInput.value = m.date;
  tagInput.value = m.tag || "";
  linksInput.value = m.links || "";
  submitBtn.textContent = "СОХРАНИТЬ";
  cancelEdit.classList.remove("hidden");

  form.classList.remove("hidden");
  closeModal();
  log(`EDIT MODE node_${shortId(m.id)}`, "warn");
});

deleteBtn.addEventListener("click", () => {
  if (!currentModalId) return;
  if (!confirm("Удалить это воспоминание?")) return;
  memories = memories.filter(m => m.id !== currentModalId);
  saveMemories();
  closeModal();
  log(`DELETE node`, "warn");
  playBeep(300, 0.15, 0.05, "sawtooth");
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    resetForm();
    return;
  }
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") {
    if (e.key === "Escape") document.activeElement.blur();
    return;
  }
  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    form.classList.remove("hidden");
    titleInput.focus();
    log("HOTKEY: NEW", "info");
  }
  if (e.key === "/") {
    e.preventDefault();
    searchInput.focus();
    log("HOTKEY: SEARCH", "info");
  }
});

// ---------------- Теги ----------------
function renderTagFilters() {
  const tags = [...new Set(memories.map((m) => m.tag).filter(Boolean))];

  tagSuggest.innerHTML = "";
  tags.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    tagSuggest.appendChild(opt);
  });

  tagFilters.innerHTML = "";
  if (tags.length === 0) return;

  const allBtn = document.createElement("button");
  allBtn.className = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "ВСЕ";
  allBtn.onclick = () => { activeTag = null; render(); };
  tagFilters.appendChild(allBtn);

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = "#" + tag.toUpperCase();
    btn.onclick = () => { activeTag = tag; render(); };
    tagFilters.appendChild(btn);
  });
}

// ---------------- Фильтрация ----------------
function getFiltered() {
  return memories.filter((m) => {
    if (activeTag && m.tag !== activeTag) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = (m.title + " " + m.text + " " + m.tag).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------------- Таймлайн ----------------
function renderTimeline() {
  timeline.innerHTML = "";
  const sorted = [...memories].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  sorted.forEach(m => {
    const dot = document.createElement("div");
    dot.className = "tl-dot";
    dot.dataset.title = `${formatDate(m.date)} · ${m.title.slice(0, 18)}`;
    dot.onclick = () => openModal(m.id);
    timeline.appendChild(dot);
  });
}

// ---------------- Рендер ----------------
function render() {
  renderTagFilters();
  renderTimeline();
  const filtered = getFiltered();

  updateNodes(
    filtered,
    openModal,
    () => {},
    () => {
      activeTag = null;
      searchQuery = "";
      searchInput.value = "";
      scrambleNodes();
      render();
    }
  );
}

// ---------------- Поиск ----------------
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  if (searchQuery) log(`SEARCH "${searchQuery}"`, "info");
  render();
});

// ---------------- Экспорт / Импорт ----------------
exportBtn.addEventListener("click", () => {
  const data = JSON.stringify(memories, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pensieve-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  log("EXPORT OK", "ok");
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error("Bad format");
      if (!confirm(`Импортировать ${data.length} воспоминаний? Текущие данные будут заменены.`)) return;
      memories = data.map(m => ({ links: "", ...m }));
      saveMemories();
      render();
      log(`IMPORT ${data.length} nodes`, "ok");
    } catch (err) {
      alert("Ошибка импорта: " + err.message);
      log("IMPORT FAIL", "warn");
    }
  };
  reader.readAsText(file);
  importFile.value = "";
});

// ---------------- Scramble ----------------
scrambleBtn.addEventListener("click", scrambleNodes);

// ---------------- Camera reset ----------------
resetCamBtn.addEventListener("click", () => {
  if (typeof window.resetPensieveCamera === "function") {
    window.resetPensieveCamera();
  }
});

// ---------------- Help hint ----------------
helpClose.addEventListener("click", () => {
  helpHint.classList.add("hidden");
  safeSet("pensieve_help_hidden", "1");
});
if (safeGet("pensieve_help_hidden") === "1") {
  helpHint.classList.add("hidden");
}

// ---------------- Старт ----------------
loadMemories();
dateInput.valueAsDate = new Date();
render();
