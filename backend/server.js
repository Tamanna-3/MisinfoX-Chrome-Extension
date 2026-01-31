// backend/server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// SAFE FETCH FOR COMMONJS (Node 16+ / 18+ compatible)
// --------------------------------------------------
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// --------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" +
  GEMINI_API_KEY;

// --------------------------------------------------
// BRAND ↔ DOMAIN MISMATCH
// --------------------------------------------------
function brandDomainMismatch(text) {
  const brandMap = {
    "bank of india": ["bankofindia.co.in"],
    "india bank": ["bankofindia.co.in"],
    "amazon": ["amazon.in", "amazon.com"],
    "google": ["google.com"],
    "gpt": ["openai.com"],
    "whatsapp": ["whatsapp.com"]
  };

  for (const brand in brandMap) {
    if (text.includes(brand)) {
      return !brandMap[brand].some(domain => text.includes(domain));
    }
  }
  return false;
}

// --------------------------------------------------
// RULE ENGINE (PRIMARY)
// --------------------------------------------------
function ruleEngine(text) {
  const t = text.toLowerCase();
  const mismatch = brandDomainMismatch(t);

  const flags = {
    bank: /(bank|upi|account|refund|overpayment|transaction)/.test(t),
    govt: /(rbi|income tax|govt|government|irctc|uidai|aadhaar)/.test(t),
    job: /(job|internship|work from home|resume|interview|hiring|selected)/.test(t),
    payment: /(pay|₹|rs|registration|fee|cashback|reward|earn)/.test(t),
    urgency: /(urgent|action required|final warning|limited time|24 hours|6 hours|act fast|immediately)/.test(t),
    credentials: /(verify|login|password|otp|2fa|kyc|secure)/.test(t),
    sim: /(sim card|blocked|verification|service suspension)/.test(t),
    courier: /(package|courier|delivery|tracking|parcel on hold)/.test(t),
    gift: /(gift card|free gift|won|congratulations|reward)/.test(t),
    security: /(suspicious activity|unusual login|new device|security alert)/.test(t),
    crypto: /(crypto|bitcoin|investment|double your money|guaranteed profit)/.test(t),
    link: /\b[a-z0-9-]+\.(com|in|co|net|org)\b/.test(t),
    fakeDomain: /(amaz0n|inbonk|gpt12|clivk|upi-cashback|secure-check|fast-courier|sim-verification|inbank)/.test(t)
  };

  // ------------------ SCAM ------------------
  if (
    flags.fakeDomain ||
    (flags.bank && flags.link && (flags.credentials || mismatch)) ||
    (flags.job && (flags.payment || flags.link)) ||
    (flags.sim && flags.urgency && flags.link) ||
    (flags.courier && flags.link) ||
    (flags.gift && flags.urgency) ||
    (flags.security && flags.link) ||
    (flags.crypto && flags.urgency)
  ) {
    return {
      verdict: "SCAM",
      confidence: 97,
      summary:
        "This message strongly matches known scam or phishing patterns involving impersonation, urgency, or fake links.",
      riskLevel: "high",
      reasoning: [
        flags.fakeDomain && "Impersonated or suspicious domain detected",
        flags.bank && "Bank-related verification via unofficial link",
        flags.job && "Job or interview lure asking for action or money",
        flags.sim && "SIM blocking threat used to create panic",
        flags.courier && "Fake delivery problem scam",
        flags.gift && "Unrealistic reward or giveaway",
        flags.security && "Fake security alert with malicious link",
        flags.crypto && "High-risk investment scam",
        mismatch && "Brand name does not match linked domain"
      ].filter(Boolean),
      sources: [
        {
          label: "Indian Cyber Crime Portal",
          url: "https://cybercrime.gov.in"
        },
        {
          label: "CERT-In Scam Alerts",
          url: "https://www.cert-in.org.in"
        },
        {
          label: "RBI – Digital Payment Frauds",
          url: "https://www.rbi.org.in/Scripts/FAQView.aspx?Id=164"
        }
      ]
    };
  }

  // ------------------ SUSPICIOUS ------------------
  if (flags.link || flags.urgency || flags.credentials || flags.security) {
    return {
      verdict: "SUSPICIOUS",
      confidence: 72,
      summary:
        "This message contains elements commonly used in phishing attempts. Verify carefully before taking action.",
      riskLevel: "medium",
      reasoning: [
        flags.link && "Contains external link",
        flags.urgency && "Uses urgency or threats",
        flags.credentials && "Requests sensitive account action",
        flags.security && "Mentions security issues"
      ].filter(Boolean),
      sources: [
        {
          label: "Google Safe Browsing",
          url: "https://safebrowsing.google.com"
        },
        {
          label: "Cyber Crime India",
          url: "https://cybercrime.gov.in"
        }
      ]
    };
  }

  return null;
}

// --------------------------------------------------
// GEMINI AI (OPTIONAL)
// --------------------------------------------------
async function aiAnalyze(text) {
  if (!GEMINI_API_KEY) return null;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
You are a cybersecurity expert.
Respond ONLY in JSON.

{
  "verdict": "SAFE | SCAM | SUSPICIOUS",
  "confidence": number,
  "summary": string,
  "riskLevel": "low | medium | high",
  "reasoning": string[],
  "sources": [{ "label": string, "url": string }]
}

Text:
${text}
`
              }
            ]
          }
        ]
      })
    });

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// --------------------------------------------------
// API
// --------------------------------------------------
app.post("/analyze", async (req, res) => {
  const text = (req.body.text || "").trim();

  if (text.length < 10) {
    return res.json({
      verdict: "UNKNOWN",
      confidence: 0,
      summary: "Text too short to analyze.",
      riskLevel: "low",
      reasoning: [],
      sources: []
    });
  }

  // 1️⃣ RULE ENGINE FIRST (ALWAYS)
  const ruleResult = ruleEngine(text);
  if (ruleResult) return res.json(ruleResult);

  // 2️⃣ AI OPTIONAL
  const ai = await aiAnalyze(text);
  if (ai) return res.json(ai);

  // 3️⃣ SAFE DEFAULT
  res.json({
    verdict: "SAFE",
    confidence: 55,
    summary: "No strong scam or phishing indicators detected.",
    riskLevel: "low",
    reasoning: ["No high-risk patterns detected"],
    sources: []
  });
});

app.listen(5000, () =>
  console.log("✅ MisinfoX backend running on http://localhost:5000")
);
