console.log("TabPilot sidepanel loaded!")

let savedApiKey = null;

// Handle provider selection
document.getElementById("provider").addEventListener("change", (e) => {
  const apiKeySection = document.getElementById("apiKeySection");
  if (e.target.value === "claude") {
    apiKeySection.style.display = "block";
    updateApiKeyDisplay();
  } else {
    apiKeySection.style.display = "none";
  }
});

// Update API key display based on whether one is saved
function updateApiKeyDisplay() {
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const apiKeyInput = document.getElementById("apiKeyInput");
  
  if (savedApiKey) {
    apiKeyStatus.style.display = "flex";
    apiKeyInput.style.display = "none";
  } else {
    apiKeyStatus.style.display = "none";
    apiKeyInput.style.display = "block";
  }
}

// Load saved API key
chrome.storage.local.get(['claudeApiKey'], (result) => {
  if (result.claudeApiKey) {
    savedApiKey = result.claudeApiKey;
    document.getElementById("apiKey").value = result.claudeApiKey;
  }
  updateApiKeyDisplay();
});

// Save API key when changed
document.getElementById("apiKey").addEventListener("input", (e) => {
  const newKey = e.target.value;
  if (newKey) {
    chrome.storage.local.set({ claudeApiKey: newKey });
    savedApiKey = newKey;
    updateApiKeyDisplay();
  }
});

// Handle change API key button
document.getElementById("changeApiKey").addEventListener("click", () => {
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const apiKeyInput = document.getElementById("apiKeyInput");
  
  apiKeyStatus.style.display = "none";
  apiKeyInput.style.display = "block";
  document.getElementById("apiKey").focus();
});

async function callOllama(tabData) {
  const response = await fetch("http://localhost:5001/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma3",
      prompt: `Classify these browser tabs into categories (Work, Social, News, Docs, Shopping, Entertainment). 
Return the result as markdown with headers for each category and bullet points for the tabs.

Format like this:
## Work
- Tab Title 1 - URL1
- Tab Title 2 - URL2

## Social  
- Tab Title 3 - URL3

Tabs to classify:
${tabData.map(tab => `- ${tab.title}: ${tab.url}`).join('\n')}`,
      stream: false
    })
  });
  return await response.json();
}

async function callClaude(tabData, apiKey) {
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
      messages: [{
        role: "user",
        content: `Classify these browser tabs into categories (Work, Social, News, Docs, Shopping, Entertainment). 
Return the result as markdown with headers for each category and bullet points for the tabs.

Format like this:
## Work
- Tab Title 1 - URL1
- Tab Title 2 - URL2

## Social  
- Tab Title 3 - URL3

Tabs to classify:
${tabData.map(tab => `- ${tab.title}: ${tab.url}`).join('\n')}`
      }]
    })
  });
  
  const data = await response.json();
  if (data.content && data.content[0]) {
    return { response: data.content[0].text };
  } else {
    throw new Error(data.error?.message || "Unknown error from Claude API");
  }
}

document.getElementById("classify").addEventListener("click", async () => {
  const outputElement = document.getElementById("output");
  const timerElement = document.getElementById("timer");
  const startTime = Date.now();
  let timerInterval;
  
  // Show loading state
  outputElement.innerText = "Analyzing all tabs...";
  outputElement.className = "loading";
  timerElement.style.display = "block";
  
  // Start continuous timer
  timerInterval = setInterval(() => {
    const currentTime = Date.now();
    const elapsedTime = ((currentTime - startTime) / 1000).toFixed(1);
    timerElement.innerHTML = `<span class="timer-text">${elapsedTime}s elapsed...</span>`;
  }, 100); // Update every 100ms
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url
    }));

    // Filter out chrome:// URLs
    const regularTabs = tabData.filter(tab => 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://')
    );

    console.log("Tab data:", regularTabs);
    
    outputElement.innerText = `Found ${regularTabs.length} tabs to analyze...`;

    // Get selected provider
    const provider = document.getElementById("provider").value;
    let data;

    if (provider === "claude") {
      const apiKey = savedApiKey || document.getElementById("apiKey").value;
      if (!apiKey) {
        throw new Error("Please enter your Claude API key");
      }
      data = await callClaude(regularTabs, apiKey);
    } else {
      data = await callOllama(regularTabs);
    }
    
    // Stop continuous timer
    clearInterval(timerInterval);
    
    // Calculate elapsed time
    const endTime = Date.now();
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log("Classification result:", data);

    // Remove loading state and show results
    outputElement.className = "";
    
    // Show final timer
    timerElement.innerHTML = `<span class="timer-text">Completed in ${elapsedTime}s using ${provider === "claude" ? "Claude API" : "Ollama"}</span>`;
    timerElement.style.display = "block";
    
    // Render as markdown
    if (data.response) {
      outputElement.innerHTML = marked.parse(data.response);
    } else {
      outputElement.innerHTML = `<p style="color: red;">Error: ${data.error}</p>`;
    }

  } catch (error) {
    // Stop continuous timer
    clearInterval(timerInterval);
    
    console.error("Error:", error);
    outputElement.className = "";
    timerElement.style.display = "none";
    outputElement.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
});