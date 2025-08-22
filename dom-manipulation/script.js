/**********************
 * GLOBALS
 **********************/
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";
let quotes = JSON.parse(localStorage.getItem("quotes")) || [];
let categories = [...new Set(quotes.map(q => q.category))];
let syncInterval;

/**********************
 * UI HELPERS
 **********************/
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.innerText = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.padding = "10px 15px";
  notification.style.borderRadius = "8px";
  notification.style.zIndex = "1000";
  notification.style.color = "#fff";
  notification.style.fontWeight = "bold";
  notification.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";

  if (type === "success") notification.style.background = "#28a745";
  else if (type === "error") notification.style.background = "#dc3545";
  else notification.style.background = "#007bff";

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

/**********************
 * SERVER SYNC
 **********************/
async function fetchQuotesFromServer(limit = 5) {
  try {
    const response = await fetch(`${SERVER_URL}?_limit=${limit}`);
    const data = await response.json();

    // Convert mock API posts into quote objects
    const serverQuotes = data.map(item => ({
      text: item.title,
      category: "Server"
    }));

    // Conflict resolution → Server wins
    quotes = mergeQuotes(serverQuotes, quotes);
    localStorage.setItem("quotes", JSON.stringify(quotes));
    updateCategories();
    showNotification("Synced with server", "success");
  } catch (error) {
    console.error("Error fetching from server:", error);
    showNotification("Failed to sync with server", "error");
  }
}

function mergeQuotes(serverQuotes, localQuotes) {
  const merged = [...localQuotes];
  serverQuotes.forEach(sq => {
    if (!merged.some(lq => lq.text === sq.text)) {
      merged.push(sq);
    }
  });
  return merged;
}

async function pushQuoteToServer(quote) {
  try {
    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote)
    });
    showNotification("Quote uploaded to server", "success");
  } catch (error) {
    console.error("Error pushing to server:", error);
    showNotification("Failed to upload quote", "error");
  }
}

function startSyncing() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    fetchQuotesFromServer(5);
  }, 10000); // every 10 sec
}

/**********************
 * QUOTE FUNCTIONS
 **********************/
function displayRandomQuote() {
  if (quotes.length === 0) {
    document.getElementById("quoteDisplay").innerText = "No quotes available!";
    return;
  }
  const random = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById("quoteDisplay").innerHTML = `
    <p><em>"${random.text}"</em></p>
    <p><strong>Category:</strong> ${random.category}</p>
  `;
}

function filterQuotes() {
  const filter = document.getElementById("categoryFilter").value;
  let filteredQuotes = quotes;

  if (filter !== "all") {
    filteredQuotes = quotes.filter(q => q.category === filter);
  }

  if (filteredQuotes.length === 0) {
    document.getElementById("quoteDisplay").innerText = "No quotes in this category!";
    return;
  }

  const random = filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
  document.getElementById("quoteDisplay").innerHTML = `
    <p><em>"${random.text}"</em></p>
    <p><strong>Category:</strong> ${random.category}</p>
  `;
}

function addQuote(event) {
  event.preventDefault();
  const text = document.getElementById("newQuoteText").value;
  const category = document.getElementById("newQuoteCategory").value;

  const newQuote = { text, category };
  quotes.push(newQuote);
  localStorage.setItem("quotes", JSON.stringify(quotes));
  updateCategories();
  pushQuoteToServer(newQuote);
  showNotification("New quote added", "success");

  document.getElementById("addQuoteForm").reset();
}

function updateCategories() {
  const categoryFilter = document.getElementById("categoryFilter");
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  const uniqueCategories = [...new Set(quotes.map(q => q.category))];
  uniqueCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
}

function exportToJsonFile() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();
  showNotification("Exported quotes to JSON", "success");
}

function importFromJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      quotes = mergeQuotes(importedQuotes, quotes);
      localStorage.setItem("quotes", JSON.stringify(quotes));
      updateCategories();
      showNotification("Imported quotes from file", "success");
    } catch (err) {
      showNotification("Error importing file", "error");
    }
  };
  reader.readAsText(file);
}
/**********************
 * DATA SYNCING
 **********************/
async function syncQuotes() {
  try {
    const serverQuotes = await fetchServerQuotes(10); // fetch from server
    let localQuotes = JSON.parse(localStorage.getItem("quotes")) || [];

    // Map local quotes by id for quick lookup
    const localMap = new Map(localQuotes.map(q => [q.id, q]));
    let conflictsResolved = 0;

    // Resolve conflicts & merge
    serverQuotes.forEach(serverQ => {
      if (localMap.has(serverQ.id)) {
        const localQ = localMap.get(serverQ.id);
        // Conflict resolution: pick the newer one (server wins on tie)
        if (new Date(serverQ.updatedAt) >= new Date(localQ.updatedAt)) {
          localMap.set(serverQ.id, serverQ);
          conflictsResolved++;
        }
      } else {
        localMap.set(serverQ.id, serverQ);
      }
    });

    // Save merged data back
    localQuotes = Array.from(localMap.values());
    localStorage.setItem("quotes", JSON.stringify(localQuotes));

    // Refresh UI (categories + displayed quote)
    updateCategories();
    displayRandomQuote();

    // ✅ Notify user
    if (conflictsResolved > 0) {
      alert(`Quotes synced with server! ${conflictsResolved} conflicts resolved.`);
    } else {
      alert("Quotes synced with server!");
    }

  } catch (err) {
    console.error("❌ Sync failed:", err);
    alert("Failed to sync with server. Please try again later.");
  }
}


// Sync every 30 seconds
setInterval(syncQuotes, 30000);

// Also sync once when the app loads
syncQuotes();


/**********************
 * INIT
 **********************/
window.onload = function() {
  updateCategories();
  startSyncing();
};
