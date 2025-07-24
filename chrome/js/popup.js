console.log("TabPilot sidepanel loaded!")

// DOM elements
const elements = {
  provider: document.getElementById("provider"),
  apiKeySection: document.getElementById("apiKeySection"),
  apiKeyStatus: document.getElementById("apiKeyStatus"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  apiKey: document.getElementById("apiKey"),
  changeApiKey: document.getElementById("changeApiKey"),
  listOldTabs: document.getElementById("listOldTabs"),
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

// List old tabs function
elements.listOldTabs.addEventListener("click", async () => {
  const startTime = Date.now();
  const timer = createTimer(startTime);
  
  elements.output.innerText = "Finding old tabs...";
  elements.output.className = "loading";
  timer.start();
  
  try {
    const tabs = await chrome.tabs.query({});
    const currentTime = Date.now();
    const oldTabs = tabs.filter(tab => 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') && 
      (currentTime - tab.lastAccessed) > 600000 // 10 minutes in ms
    ).map(tab => ({ title: tab.title, url: tab.url }));
    
    if (!oldTabs.length) {
      timer.clear();
      elements.output.className = "";
      elements.output.innerHTML = '<p>No tabs have been open for more than 10 minutes.</p>';
      return;
    }
    
    elements.output.innerText = `Grouping ${oldTabs.length} old tabs...`;
    
    const provider = elements.provider.value;
    const prompt = `Group these browser tabs that have been open for more than 10 minutes into coherent thematic groups. Return the result as markdown with headers for each group and bullet points for the tabs.

Format like this:
## Work Projects
- Tab Title 1 - URL1
- Tab Title 2 - URL2

## Research
- Tab Title 3 - URL3

Tabs to group:
${oldTabs.map(tab => `- ${tab.title}: ${tab.url}`).join('\n')}`;
    
    let data;
    if (provider === "claude") {
      const apiKey = savedApiKey || elements.apiKey.value;
      if (!apiKey) throw new Error("Please enter your Claude API key");
      data = await callClaude(oldTabs, apiKey, prompt);
    } else {
      data = await callOllama(oldTabs, prompt);
    }
    
    elements.output.className = "";
    timer.stop(provider);
    elements.output.innerHTML = data.response ? marked.parse(data.response) : `<p style="color: red;">Error: ${data.error}</p>`;
    
  } catch (error) {
    timer.clear();
    elements.output.className = "";
    elements.output.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
});

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