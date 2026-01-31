// MisinfoX Background Service Worker
console.log('MisinfoX background service worker loaded');

let extensionEnabled = true;

// Toggle extension
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ANALYZE_TEXT") {
    fetch("http://localhost:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.text })
    })
      .then(r => r.json())
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          verdict: "ERROR",
          confidence: 0,
          summary: "AI service unavailable",
          riskLevel: "low"
        })
      );
    return true;
  }
});
