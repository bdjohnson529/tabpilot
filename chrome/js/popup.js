console.log("TabPilot sidepanel loaded!")

// DOM elements
const elements = {
  provider: document.getElementById("provider"),
  apiKeySection: document.getElementById("apiKeySection"),
  apiKeyStatus: document.getElementById("apiKeyStatus"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiKey: document.getElementById("apiKey"),
  changeApiKey: document.getElementById("changeApiKey"),
  manageOldTabs: document.getElementById("manageOldTabs"),
  classify: document.getElementById("classify"),
  timer: document.getElementById("timer"),
  output: document.getElementById("output")
};

let savedApiKey = null;

// Utility functions
const show = (el) => el.style.display = "block";
const hide = (el) => el.style.display = "none";
const showFlex = (el) => el.style.display = "flex";

// API key management
function updateApiKeyDisplay() {
  savedApiKey ? (showFlex(elements.apiKeyStatus), hide(elements.apiKeyInput)) 
              : (hide(elements.apiKeyStatus), show(elements.apiKeyInput));
}

// Load saved API key
chrome.storage.local.get(['claudeApiKey'], (result) => {
  if (result.claudeApiKey) {
    savedApiKey = result.claudeApiKey;
    elements.apiKey.value = result.claudeApiKey;
  }
  updateApiKeyDisplay();
});

// Event listeners
elements.provider.addEventListener("change", (e) => {
  if (e.target.value === "claude") {
    show(elements.apiKeySection);
    updateApiKeyDisplay();
  } else {
    hide(elements.apiKeySection);
  }
});

elements.apiKey.addEventListener("input", (e) => {
  if (e.target.value) {
    chrome.storage.local.set({ claudeApiKey: e.target.value });
    savedApiKey = e.target.value;
    updateApiKeyDisplay();
  }
});

elements.changeApiKey.addEventListener("click", () => {
  hide(elements.apiKeyStatus);
  show(elements.apiKeyInput);
  elements.apiKey.focus();
});

// Shared prompt template
const createPrompt = (tabData) => `Classify these browser tabs into categories (Work, Social, News, Docs, Shopping, Entertainment). 
Return the result as markdown with headers for each category and bullet points for the tabs.

Format like this:
## Work
- Tab Title 1 - URL1
- Tab Title 2 - URL2

## Social  
- Tab Title 3 - URL3

Tabs to classify:
${tabData.map(tab => `- ${tab.title}: ${tab.url}`).join('\n')}`;

// API calls
const callOllama = async (tabData, customPrompt = null) => {
  const response = await fetch("http://localhost:5001/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3",
      prompt: customPrompt || createPrompt(tabData),
      stream: false
    })
  });
  return await response.json();
};

const callClaude = async (tabData, apiKey, customPrompt = null) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{ role: "user", content: customPrompt || createPrompt(tabData) }]
    })
  });
  
  const data = await response.json();
  if (data.content?.[0]) return { response: data.content[0].text };
  throw new Error(data.error?.message || "Unknown error from Claude API");
};

// Timer management
const createTimer = (startTime) => {
  let interval;
  const start = () => {
    show(elements.timer);
    interval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      elements.timer.innerHTML = `<span class="timer-text">${elapsed}s elapsed...</span>`;
    }, 100);
  };
  
  const stop = (provider) => {
    clearInterval(interval);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    elements.timer.innerHTML = `<span class="timer-text">Completed in ${elapsed}s using ${provider === "claude" ? "Claude API" : "Ollama"}</span>`;
  };
  
  const clear = () => {
    clearInterval(interval);
    hide(elements.timer);
  };
  
  return { start, stop, clear };
};


// Tab cycling state
let currentTabIndex = 0;
let oldTabsList = [];
let currentWindowId = null;

// Manage old tabs function with cycling
elements.manageOldTabs.addEventListener("click", async () => {
  try {
    const tabs = await chrome.tabs.query({});
    const currentTime = Date.now();
    const currentWindow = await chrome.windows.getCurrent();
    currentWindowId = currentWindow.id;
    
    oldTabsList = tabs.filter(tab => 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') && 
      (currentTime - tab.lastAccessed) > 600000 // 10 minutes in ms
    ).map(tab => ({
      ...tab,
      originalWindowId: tab.windowId // Remember original window
    }));
    
    if (!oldTabsList.length) {
      elements.output.innerHTML = '<p>No tabs have been open for more than 10 minutes.</p>';
      return;
    }
    
    currentTabIndex = 0;
    await showCurrentTab();
    
  } catch (error) {
    elements.output.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
});

// Show current tab in cycle
const showCurrentTab = async () => {
  if (currentTabIndex >= oldTabsList.length) {
    elements.output.innerHTML = '<p>✅ All old tabs reviewed!</p>';
    return;
  }
  
  const tab = oldTabsList[currentTabIndex];
  
  try {
    // Move tab to current window
    if (tab.windowId !== currentWindowId) {
      await chrome.tabs.move(tab.id, { windowId: currentWindowId, index: -1 });
    }
    
    // Make tab active
    await chrome.tabs.update(tab.id, { active: true });
    
    // Capture screenshot - commented out for now
    // const screenshot = await chrome.tabs.captureVisibleTab(currentWindow.id, { format: 'png', quality: 50 });
    
    elements.output.innerHTML = `
      <div class="single-tab-view">
        <h3>Tab ${currentTabIndex + 1} of ${oldTabsList.length}</h3>
        <p>${tab.title}</p>
        <div class="tab-cycling-actions">
          <button class="tab-action-btn keep-btn" data-action="cycle-keep" data-tab-id="${tab.id}">Keep</button>
          <button class="tab-action-btn close-btn" data-action="cycle-close" data-tab-id="${tab.id}">Delete</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    elements.output.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', handleCyclingAction);
    });
    
  } catch (error) {
    console.error('Error showing tab:', error);
    elements.output.innerHTML = `<p style="color: red;">Error showing tab: ${error.message}</p>`;
  }
};

// Tab cycling action handler
const handleCyclingAction = async (event) => {
  const action = event.target.dataset.action;
  const tabId = parseInt(event.target.dataset.tabId);
  
  switch (action) {
    case 'cycle-close':
      try {
        await chrome.tabs.remove(tabId);
        // Remove from our list
        oldTabsList.splice(currentTabIndex, 1);
        // Don't increment index since we removed current item
        await showCurrentTab();
      } catch (error) {
        console.error('Error closing tab:', error);
      }
      break;
      
    case 'cycle-keep':
      try {
        const tab = oldTabsList[currentTabIndex];
        // Move tab back to original window if it's different from current
        if (tab.originalWindowId !== currentWindowId) {
          await chrome.tabs.move(tab.id, { windowId: tab.originalWindowId, index: -1 });
        }
        // Remove from our list (keeping it open)
        oldTabsList.splice(currentTabIndex, 1);
        // Don't increment index since we removed current item
        await showCurrentTab();
      } catch (error) {
        console.error('Error moving tab back:', error);
        // Still remove from list even if move fails
        oldTabsList.splice(currentTabIndex, 1);
        await showCurrentTab();
      }
      break;
      
    case 'skip':
      currentTabIndex++;
      await showCurrentTab();
      break;
      
    case 'prev':
      if (currentTabIndex > 0) {
        currentTabIndex--;
        await showCurrentTab();
      }
      break;
      
    case 'next':
      if (currentTabIndex < oldTabsList.length - 1) {
        currentTabIndex++;
        await showCurrentTab();
      }
      break;
  }
};

// Legacy tab management event handler (keeping for backward compatibility)
const handleTabAction = async (event) => {
  const action = event.target.dataset.action;
  const tabId = parseInt(event.target.dataset.tabId);
  const tabCard = event.target.closest('.tab-card');
  
  if (action === 'keep') {
    tabCard.style.opacity = '0.5';
    tabCard.innerHTML = '<div class="tab-info"><div class="tab-title">✓ Keeping this tab</div></div>';
    setTimeout(() => tabCard.remove(), 1000);
  } else if (action === 'close') {
    try {
      await chrome.tabs.remove(tabId);
      tabCard.style.opacity = '0.5';
      tabCard.innerHTML = '<div class="tab-info"><div class="tab-title">✓ Tab closed</div></div>';
      setTimeout(() => tabCard.remove(), 1000);
    } catch (error) {
      console.error('Error closing tab:', error);
      tabCard.innerHTML = '<div class="tab-info"><div class="tab-title" style="color: red;">✗ Error closing tab</div></div>';
    }
  }
};

// Main classification function
elements.classify.addEventListener("click", async () => {
  const startTime = Date.now();
  const timer = createTimer(startTime);
  
  // Set loading state
  elements.output.innerText = "Analyzing all tabs...";
  elements.output.className = "loading";
  timer.start();
  
  try {
    // Get and filter tabs
    const tabs = await chrome.tabs.query({});
    const currentTime = Date.now();
    const regularTabs = tabs
      .map(tab => ({ 
        title: tab.title, 
        url: tab.url, 
        lastAccessed: tab.lastAccessed,
        timeSinceAccessed: (currentTime - tab.lastAccessed) / 1000
      }))
      .filter(tab => !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
      .sort((a, b) => b.timeSinceAccessed - a.timeSinceAccessed);

    elements.output.innerText = `Found ${regularTabs.length} tabs to analyze...`;

    console.log(regularTabs);

    // Call appropriate API
    const provider = elements.provider.value;
    let data;
    
    if (provider === "claude") {
      const apiKey = savedApiKey || elements.apiKey.value;
      if (!apiKey) throw new Error("Please enter your Claude API key");
      data = await callClaude(regularTabs, apiKey);
    } else {
      data = await callOllama(regularTabs);
    }

    // Show results
    elements.output.className = "";
    timer.stop(provider);
    elements.output.innerHTML = data.response ? marked.parse(data.response) : `<p style="color: red;">Error: ${data.error}</p>`;

  } catch (error) {
    timer.clear();
    elements.output.className = "";
    elements.output.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
});