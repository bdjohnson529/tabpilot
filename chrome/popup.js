console.log("This is a popup!")


document.getElementById("classify").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  /*
  // Inject a content script to get page text
  const [{ result: tabText }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body?.innerText?.slice(0, 2000) || ""
  });
  */

  const tabs = await chrome.tabs.query({});
  const tabData = tabs.map(tab => ({
    title: tab.title,
    url: tab.url
  }));

  console.log("Tab data:", tabData);

  let tabText = "amazon"

  try{
    // Call your local Flask server
    const response = await fetch("http://localhost:5001/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3",
        prompt: `Classify this tab content into one of: Work, Social, News, Docs, Shopping. Return the result as json with the url and the label.\n\n${tabData}`,
        stream: false
      })
    });

    const data = await response.json();

    console.log(data);

    document.getElementById("output").innerText = `Label: ${data.response || data.error}`;

  } catch (error) {

    console.error("Error:", error);
    document.getElementById("output").innerText = `Error: ${error.message}`;

  }
});