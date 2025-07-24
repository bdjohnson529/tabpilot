chrome.runtime.onStartup.addListener(() => sendTabsToPython());
chrome.runtime.onInstalled.addListener(() => sendTabsToPython());

chrome.action.onClicked.addListener((tab) => {
  try {
    console.log("Extension clicked, opening side panel...");
    chrome.sidePanel.open({ windowId: tab.windowId });
    console.log("Side panel opened successfully");
  } catch (error) {
    console.error("Failed to open side panel:", error);
  }
});

function sendTabsToPython() {

    /*
    fetch("http://localhost:5000/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: tabData })
    });
    */
};