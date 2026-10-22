// ====== 1. Состояние ======
let memories = [];
let activeTag = null;
let searchQuery = "";

const STORAGE_KEY = "pensieve_memories";

// ====== 2. DOM ======
const form = document.getElementById("memoryForm");
const formPanel = document.getElementById("formPanel");
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

// ====== 3. LocalStorage ======
function loadMemories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memories = raw ? JSON.parse(raw) : [];
 
