chrome.storage.local.get("latestReport", data => {
  if (data.latestReport) displayReport(data.latestReport);
});

function displayReport(api) {
  // Map backend verdict to UI class
  const verdictClass =
    api.verdict === "SCAM" ? "danger" :
    api.riskLevel === "high" ? "warning" : "safe";

  const icon =
    verdictClass === "safe" ? "✅" :
    verdictClass === "warning" ? "⚠️" : "🚨";

  document.getElementById("verdictIcon").textContent = icon;
  document.getElementById("verdictStatus").textContent = api.verdict;
  document.getElementById("verdictSummary").textContent = api.summary;

  document.getElementById("confidenceFill").style.width =
    api.confidence + "%";
  document.getElementById("confidenceText").textContent =
    api.confidence + "% confidence";

  const risk = document.getElementById("riskLevel");
  risk.textContent = api.riskLevel.toUpperCase() + " RISK";
  risk.className = "badge " + api.riskLevel;

  // FLAGS (static for now)
  document.getElementById("flagsSection").classList.remove("hidden");
  document.getElementById("flagsList").innerHTML =
    `<div>🚩 Suspicious link detected</div>
     <div>🚩 Urgency-based language</div>
     <div>🚩 Internship scam pattern</div>`;

  // RECOMMENDATIONS
  document.getElementById("recommendationsList").innerHTML =
    `<div>✔️ Do not click unknown links</div>
     <div>✔️ Verify sender on official website</div>
     <div>✔️ Report the message</div>`;

  document.getElementById("analyzedText").textContent =
    "User selected message";
  document.getElementById("analysisTime").textContent =
    new Date().toLocaleString();
}
