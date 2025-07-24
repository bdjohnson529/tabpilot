console.log("TabPilot sidepanel loaded!")

document.getElementById("classify").addEventListener("click", async () => {
  const outputElement = document.getElementById("output");
  
  // Show loading state
  outputElement.innerText = "Analyzing all tabs...";
  outputElement.className = "loading";
  
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

    // Call your local Flask server
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
${regularTabs.map(tab => `- ${tab.title}: ${tab.url}`).join('\n')}`,
        stream: false
      })
    });

    const data = await response.json();
    console.log("Classification result:", data);

    // Remove loading state and show results
    outputElement.className = "";
    
    // Render as markdown
    if (data.response) {
      outputElement.innerHTML = marked.parse(data.response);
    } else {
      outputElement.innerHTML = `<p style="color: red;">Error: ${data.error}</p>`;
    }

  } catch (error) {
    console.error("Error:", error);
    outputElement.className = "";
    outputElement.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
});