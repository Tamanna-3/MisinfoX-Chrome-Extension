const GEMINI_API_KEY = "enter your key here";
const GEMINI_ENDPOINT =
  "your url here" +
  GEMINI_API_KEY;


async function analyzeWithGemini(text) {
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
            You are a fact-checking expert.

Analyze the following claim.

Respond ONLY in JSON with this schema:
{
  "verdict": "TRUE | FALSE | MISLEADING | OPINION | UNVERIFIABLE",
  "confidence": number,
  "summary": string,
  "reasoning": string[],
  "sources": [{ "label": string, "url": string }]
}

Claim:
<USER_TEXT>

You are a cybersecurity assistant specializing in scam and phishing detection.

Analyze the following message carefully.

Pay special attention to:
- urgency or time pressure
- unsolicited job or internship offers
- suspicious or unofficial domains
- requests to click links or verify accounts
- threats of losing opportunity

Respond ONLY in JSON with this format:

{
  "verdict": "SAFE | SCAM | SUSPICIOUS",
  "confidence": number (0-100),
  "summary": "2–3 line clear explanation for a normal user",
  "riskLevel": "low | medium | high"
}

MESSAGE:
${text}
`

          }]
        }]
      })
    });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return null;

    return JSON.parse(rawText);
  } catch (err) {
    console.warn("Gemini failed, using fallback", err);
    return null;
  }
}

async function analyzeTextContent(text) {
  let result = {
    verdict: "TRUE",
    confidence: 70,
    summary: "No strong indicators of misinformation detected.",
    class: "safe",
    details: {
      flags: [],
      recommendations: ["Verify information from trusted sources"],
      riskLevel: "low"
    },
    text
  };

  // 1️⃣ Gemini AI
  const ai = await analyzeWithGemini(text);
  if (ai) {
    result.verdict = ai.verdict;
    result.confidence = ai.confidence;
    result.summary = ai.summary;
    result.details.riskLevel = ai.riskLevel;

    result.class =
      ai.verdict === "SCAM" || ai.verdict === "FALSE"
        ? "danger"
        : ai.verdict === "SUSPICIOUS"
        ? "warning"
        : "safe";
  }

  // 2️⃣ Simple rule fallback
  const lower = text.toLowerCase();
  if (lower.includes("verify your account") || lower.includes("click the link")) {
    result.verdict = "SCAM";
    result.confidence = 92;
    result.summary = "Phishing attempt detected based on known scam patterns.";
    result.class = "danger";
    result.details.flags.push("Credential harvesting attempt");
    result.details.recommendations.unshift("Do NOT click any links");
    result.details.riskLevel = "high";
  }

  if (
  lower.includes("verify") ||
  lower.includes("onboarding") ||
  lower.includes("selected for internship") ||
  lower.includes("24 hours")
) {
  result.verdict = "SCAM";
  result.confidence = Math.max(result.confidence, 95);
  result.summary =
    "This message shows strong signs of an internship phishing scam using urgency and an unverified domain.";
  result.class = "danger";
  result.details.riskLevel = "high";
}
  return result;
}