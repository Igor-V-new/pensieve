// ====== 1. Состояние приложения ======
let memories = [];      // массив объектов-воспоминаний
let activeTag = null;    // выбранный фильтр по тегу
let searchQuery = "";    // строка поиска

const STORAGE_KEY = "pensieve_memories";

// ====== 2. Ссылки на DOM ======
const form = document.getElementById("memoryForm");
const titleInput = document.getElementById("title");
const textInput = document.getElementById("text");
const dateInput = document.getElementById("date");
const tagInput = document.getElementById("tag");

const grid = document.getElementById("memoriesGrid");
const emptyState = document.getElementById("emptyState");
const tagFilters = document.getElementById("tagFilters");
const searchInput = document.getElementById("search");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalText = document.getElementById("modalText");
const modalTag = document.getElementById("modalTag");
const closeModalBtn = document.getElementById("closeModal");

// ====== 3. Работа с LocalStorage ======
function loadMemories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memories = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Ошибка загрузки:", e);
    memories = [];
  }
}

function saveMemories() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

// ====== 4. Утилиты ======
// Форматируем дату из "2024-05-15" в "15 мая 2024"
function formatDate(isoDate) {
  if (!isoDate) return "";
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

// Экранируем HTML, чтобы избежать XSS и поломки вёрстки
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ====== 5. Добавление воспоминания ======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const newMemory = {
    id: Date.now().toString(), // уникальный id
    title: titleInput.value.trim(),
    text: textInput.value.trim(),
    date: dateInput.value,
    tag: tagInput.value.trim(),
    createdAt: Date.now(),
  };

  if (!newMemory.title || !newMemory.text || !newMemory.date) {
    alert("Заполни название, текст и дату");
    return;
  }

  memories.push(newMemory);
  saveMemories();
  form.reset();
  render();
});

// ====== 6. Удаление ======
function deleteMemory(id) {
  if (!confirm("Удалить это воспоминание из Омута?")) return;
  memories = memories.filter((m) => m.id !== id);
  saveMemories();
  render();
}

// ====== 7. Рендер тегов-фильтров ======
function renderTagFilters() {
  // Собираем уникальные теги
  const tags = [...new Set(
    memories
      .map((m) => m.tag)
      .filter((t) => t && t.length > 0)
  )];

  tagFilters.innerHTML = "";

  if (tags.length === 0) return;

  // Кнопка "Все"
  const allBtn = document.createElement("button");
  allBtn.className = "tag-btn" + (activeTag === null ? " active" : "");
  allBtn.textContent = "Все";
  allBtn.addEventListener("click", () => {
    activeTag = null;
    render();
  });
  tagFilters.appendChild(allBtn);

  // Остальные теги
  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn" + (activeTag === tag ? " active" : "");
    btn.textContent = "#" + tag;
    btn.addEventListener("click", () => {
      activeTag = tag;
      render();
    });
    tagFilters.appendChild(btn);
  });
}

// ====== 8. Фильтрация ======
function getFilteredMemories() {
  return memories
    .filter((m) => {
      // фильтр по тегу
      if (activeTag && m.tag !== activeTag) return false;
      // поиск по названию и тексту
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = (m.title + " " + m.text + " " + m.tag).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    // сортировка: сначала новые (по дате воспоминания, потом по createdAt)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    });
}

// ====== 9. Рендер сетки ======
function render() {
  renderTagFilters();

  const filtered = getFilteredMemories();
  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    emptyState.textContent =
      memories.length === 0
        ? "Омут пуст... Добавь первое воспоминание ✨"
        : "Ничего не найдено по твоему запросу 🌀";
    return;
  }
  emptyState.style.display = "none";

  filtered.forEach((m) => {
    const card = document.createElement("div");
    card.className = "memory-card";

    card.innerHTML = `
      <button class="delete-btn" title="Удалить">✕</button>
      <h3>${escapeHtml(m.title)}</h3>
      <p class="memory-date">${formatDate(m.date)}</p>
      <p class="memory-preview">${escapeHtml(m.text)}</p>
      ${m.tag ? `<span class="tag">#${escapeHtml(m.tag)}</span>` : ""}
    `;

    // клик по карточке — открыть модалку
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;
      openModal(m);
    });

    // удаление
    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteMemory(m.id);
    });

    grid.appendChild(card);
  });
}

// ====== 10. Модальное окно ======
function openModal(m) {
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
  if (e.target === modal) closeModal(); // клик по фону
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ====== 11. Поиск ======
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  render();
});

// ====== 12. Инициализация ======
loadMemories();
render();

// Ставим сегодняшнюю дату по умолчанию в форму
dateInput.valueAsDate = new Date();
