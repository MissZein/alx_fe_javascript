/**********************
 * GLOBALS
 **********************/
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";
let quotes = JSON.parse(localStorage.getItem("quotes")) || [];
let categories = [...new Set(quotes.map(q => q.category))];

/**********************
 * SERVER SYNC
 **********************/
// Low-level fetcher: Only gets quotes from server
async function fetchServerQuotes(limit = 10) {
  try {
    const res = await fetch(`${SERVER_URL}?_limit=${limit}`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const posts = await res.json();
    const now = new Date().toISOString();
    return posts.map(p => ({
      id: `server-${p.id}`,        // stable ID across fetches
      text: p.title || p.body || "Untitled",
      author: "API",
      category: "API",
      updatedAt: now,              // simulate server timestamp
      source: "server",
    }));
  } catch (err) {
    console.error("Error fetching server quotes:", err);
    return [];
  }
}

// High-level syncer: Updates local + UI
async function fetchQuotesFromServer() {
  const serverQuotes = await fetchServerQuotes();

  // Merge logic: server wins on conflicts
  const localMap = new Map(quotes.map(q => [q.id, q]));
  serverQuotes.forEach(sq => {
    const local = localMap.get(sq.id);
    if (!local || new Date(sq.updatedAt) > new Date(local.updatedAt)) {
      localMap.set(sq.id, sq); // replace or add
    }
  });

  // Update global quotes + persist
  quotes = Array.from(localMap.values());
  localStorage.setItem("quotes", JSON.stringify(quotes));

  // Update categories
  categories = [...new Set(quotes.map(q => q.category))];

  // Update UI
  populateCategories();
  displayRandomQuote();

  // Show a small notification
  showSyncNotification("Quotes synced with server ✅");
}

/**********************
 * UI HELPERS
 **********************/
function displayRandomQuote() {
  if (quotes.length === 0) return;
  const random = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("quoteText").textContent = random.text;
  document.getElementById("quoteAuthor").textContent = `– ${random.author}`;
}

function populateCategories() {
  const select = document.getElementById("categoryFilter");
  select.innerHTML = `<option value="">All</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function showSyncNotification(msg) {
  const notif = document.createElement("div");
  notif.textContent = msg;
  notif.className = "sync-notif";
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

/**********************
 * INIT
 **********************/
window.addEventListener("DOMContentLoaded", () => {
  populateCategories();
  displayRandomQuote();

  // Initial sync on load
  fetchQuotesFromServer();

  // Periodic sync every 60s
  setInterval(fetchQuotesFromServer, 60000);
});
