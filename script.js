// ================================================================
// Логика данных PENSIEVE
// ================================================================

let memories = [];
let activeTag = null;
let searchQuery = "";
const STORAGE_KEY = "pensieve_memories";

// ---------------- DOM ----------------
const form = document.getElementById("memoryForm");
const toggleForm = document.getElementById("toggleForm");
const titleInput = document.getElementById("title");
const textInput = document.getElementById("text");
const dateInput = document.getElementById("date");
const tagInput = document.getElementById("tag");
const tagFilters = document.getElementById("tagFilters");
const searchInput = document.getElementById("search");

const modal = document.getElementById("modal");
const modalId = document.getElementById("modalId");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalText = document.getElementById("modalText");
const modalTag = document.getElementById("modalTag");
const closeModalBtn = document.getElementById("closeModal");

// ---------------- LocalStorage ----------------
function loadMemories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memories = raw ? JSON.parse(raw) : [];
  } catch (e) {
    memories = [];
  }
}

function saveMemories() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

// ---------------- Утилиты ----------------
function formatDate(iso) {
  if (!iso) return "";
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

// ---------------- Форма ----------------
toggleForm.addEventListener("click", () => {
  form.classList.toggle("hidden");
  if (typeof log === "function") log("FORM.TOGGLE", "info");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const m = {
    id: Date.now().toString(),
    title: titleInput.value.trim(),
    text: textInput.value.trim(),
    date: dateInput.value,
    tag: tagInput.value.trim(),
    createdAt: Date.now(),
  };

  if (!m.title || !m.text || !m.date) return;

  memories.push(m);
  saveMemories();
  form.reset();
  dateInput.valueAsDate = new Date();
  form.classList.add("hidden");

  if (typeof log === "function") log(`CREATE node_${m.id.slice(-4)}`, "ok");
  if (typeof playBeep === "function") playBeep(1000, 0.1, 0.06);

  render();
});

// ---------------- Модалка ----------------
function openModal(id) {
  const m = memories.find((x) => x.id === id);
  if (!m) return;

  modalId.textContent = m.id.slice(-6);
  modalTitle.textContent = m.title;
  modalDate.textContent = formatDate(m.date);
  modalText.textContent = m.text;
  modalTag.textContent = m.tag ? "#" + m.tag : "";
  modalTag.style.display = m.tag ? "inline-block" : "none";

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ---------------- Теги ----------------
function renderTagFilters() {
  const tags = [...new Set(memories.map((m) => m.tag).filter(Boolean))];
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

// ---------------- Рендер ----------------
function render() {
  renderTagFilters();
  const filtered = getFiltered();

  if (typeof updateNodes === "function") {
    updateNodes(filtered, openModal, () => {});
  }
}

// ---------------- Поиск ----------------
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  if (typeof log === "function" && searchQuery) {
    log(`SEARCH "${searchQuery}"`, "info");
  }
  render();
});

// ---------------- Старт ----------------
loadMemories();
dateInput.valueAsDate = new Date();
render();
