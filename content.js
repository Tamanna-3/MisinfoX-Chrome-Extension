let analysisCompleted = false;
let analysisInProgress = false;
let askButton = null;
let floatingCard = null;
let currentSelectedText = "";

/* ---------- Spinner ---------- */
const style = document.createElement("style");
style.textContent = `
@keyframes misinfox-spin {
  to { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

/* ---------- Selection ---------- */
document.addEventListener("mouseup", handleTextSelection);
document.addEventListener("keyup", handleTextSelection);

function handleTextSelection() {
  if (analysisInProgress || analysisCompleted || floatingCard) return;

  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      removeAskButton();
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 10) {
      currentSelectedText = text;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      showAskButton(rect);
    } else {
      removeAskButton();
    }
  }, 80);
}

/* ---------- Ask Button ---------- */
function showAskButton(rect) {
  removeAskButton();

  askButton = document.createElement("button");
  askButton.textContent = "🛡️ Ask MisinfoX";

  askButton.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.bottom + 10}px;
    transform: translateX(-50%);
    z-index: 999999;
    padding: 10px 18px;
    border-radius: 20px;
    border: none;
    background: linear-gradient(135deg,#8b5cf6,#a78bfa);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  `;

  askButton.onclick = e => {
    e.stopPropagation();
    analyzeText();
  };

  document.body.appendChild(askButton);
}

/* ---------- Backend Call ---------- */
function analyzeWithBackend(text) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: "ANALYZE_TEXT", text },
      res => resolve(res)
    );
  });
}

/* ---------- Analyze ---------- */
async function analyzeText() {
  if (analysisInProgress) return;

  const cleaned = currentSelectedText.replace(/\s+/g, " ").trim();
  if (cleaned.length < 10) return;

  analysisInProgress = true;
  removeAskButton();
  showCard("loading");

  try {
    const res = await analyzeWithBackend(cleaned);

    if (!res || res.verdict === "ERROR") {
      showCard("result", {
        verdict: "ERROR",
        confidence: 0,
        summary: "Analysis service unavailable",
        reasoning: [],
        sources: []
      });
      return;
    }

    showCard("result", res);
    analysisCompleted = true;
  } catch {
    showCard("result", {
      verdict: "ERROR",
      confidence: 0,
      summary: "Failed to analyze text",
      reasoning: [],
      sources: []
    });
  }
}

/* ---------- Card ---------- */
function showCard(type, result = {}) {
  removeCard();

  const backdrop = document.createElement("div");
  backdrop.id = "misinfox-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 999998;
  `;
  backdrop.onclick = removeCard;
  document.body.appendChild(backdrop);

  floatingCard = document.createElement("div");
  floatingCard.style.cssText = `
    position: fixed;
    left: 50%;
    top: 45%;
    transform: translate(-50%, -50%);
    z-index: 999999;
    width: 380px;
    background: #0b0b14;
    color: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,.8);
    font-family: system-ui;
  `;

  if (type === "loading") {
    floatingCard.innerHTML = `
      <div style="padding:32px;text-align:center">
        <div style="
          width:36px;height:36px;margin:0 auto 14px;
          border:3px solid rgba(139,92,246,.3);
          border-top-color:#8b5cf6;
          border-radius:50%;
          animation:misinfox-spin .8s linear infinite;
        "></div>
        <div style="font-size:14px;color:#d1d5db">
          Analyzing selected text...
        </div>
      </div>
    `;
    document.body.appendChild(floatingCard);
    return;
  }

  const meta = {
    TRUE: { label: "True", color: "#22c55e", icon: "✔️" },
    FALSE: { label: "False", color: "#ef4444", icon: "❌" },
    MISLEADING: { label: "Misleading", color: "#facc15", icon: "⚠️" },
    OPINION: { label: "Opinion", color: "#38bdf8", icon: "💬" },
    SAFE: { label: "Safe", color: "#22c55e", icon: "✔️" },
    SUSPICIOUS: { label: "Suspicious", color: "#facc15", icon: "⚠️" },
    SCAM: { label: "Scam", color: "#ef4444", icon: "🚨" },
    ERROR: { label: "Error", color: "#ef4444", icon: "✖️" }
  };

  const v = meta[result.verdict] || meta.ERROR;

  floatingCard.innerHTML = `
    <div style="padding:14px 18px;border-bottom:1px solid #1f1f2e;display:flex;justify-content:space-between">
      <strong>MisinfoX Analysis</strong>
      <button id="closeX" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer">×</button>
    </div>

    <div style="padding:22px;text-align:center">
      <div style="
        display:inline-flex;gap:8px;
        padding:8px 14px;border-radius:999px;
        background:${v.color}22;color:${v.color};
        font-weight:700;margin-bottom:14px">
        ${v.icon} ${v.label}
      </div>

      <p style="color:#d1d5db;font-size:14px">${result.summary}</p>

      <div style="font-size:13px;color:#9ca3af;margin-top:8px">
        Confidence: <strong>${result.confidence}%</strong>
      </div>

      ${
        result.reasoning?.length
          ? `<ul style="text-align:left;margin-top:12px;font-size:13px">
              ${result.reasoning.map(r => `<li>${r}</li>`).join("")}
            </ul>`
          : ""
      }

      ${
        result.sources?.length
          ? `<ul style="text-align:left;margin-top:10px;font-size:13px">
              ${result.sources
                .map(s => `<li><a href="${s.url}" target="_blank">${s.label}</a></li>`)
                .join("")}
            </ul>`
          : ""
      }

      <div style="margin-top:14px;font-size:11px;color:#9ca3af">
        AI-assisted analysis. Always verify independently.
      </div>
    </div>
  `;

  document.body.appendChild(floatingCard);
  document.getElementById("closeX").onclick = removeCard;
}

/* ---------- Cleanup ---------- */
function removeAskButton() {
  if (askButton) askButton.remove();
  askButton = null;
}

function removeCard() {
  analysisInProgress = false;
  analysisCompleted = false;

  const backdrop = document.getElementById("misinfox-backdrop");
  if (backdrop) backdrop.remove();
  if (floatingCard) floatingCard.remove();
  floatingCard = null;
}
