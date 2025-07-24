chrome.runtime.onStartup.addListener(() => sendTabsToPython());
chrome.runtime.onInstalled.addListener(() => sendTabsToPython());

function sendTabsToPython() {
  chrome.tabs.query({}, function(tabs) {
    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url
    }));

    console.log(tabData);
    /*
    fetch("http://localhost:5000/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: tabData })
    });
    */
  });
}