document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = document.getElementById("themeToggle");
  const powerBtn = document.getElementById("powerButton");
  const logo = document.getElementById("brandLogo");

  const enableToggle = document.getElementById("enableToggle");
  const autoAnalyzeToggle = document.getElementById("autoAnalyzeToggle");
  const highlightToggle = document.getElementById("highlightToggle");

  chrome.storage.sync.get(
    {
      enableExtension: true,
      autoAnalyze: true,
      highlightSuspicious: true,
      emailScanner: false,
      misinfoTheme: "dark"
    },
    (settings) => {
      enableToggle.checked = settings.enableExtension;
      autoAnalyzeToggle.checked = settings.autoAnalyze;
      highlightToggle.checked = settings.highlightSuspicious;
      emailScannerToggle.checked = settings.emailScanner;

      updateEmailStatus(settings.emailScanner);
      setTheme(settings.misinfoTheme);
    }
  );

  function setTheme(mode) {
    document.body.classList.toggle("light", mode === "light");
    themeBtn.textContent = mode === "light" ? "☀️" : "🌙";

    logo.src =
      mode === "light"
        ? "assets/light-mode.png"
        : "assets/dark-mode.png";

    chrome.storage.sync.set({ misinfoTheme: mode });
  }

  themeBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ misinfoTheme: "dark" }, (s) => {
      const newTheme = s.misinfoTheme === "dark" ? "light" : "dark";
      setTheme(newTheme);
    });
  });

  powerBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ enableExtension: true }, (s) => {
      const newState = !s.enableExtension;

      chrome.storage.sync.set({ enableExtension: newState });

      powerBtn.style.color = newState ? "#cc0000" : "#4ade80";

      [enableToggle, autoAnalyzeToggle, highlightToggle, emailScannerToggle]
        .forEach(i => (i.disabled = !newState));

      enableToggle.checked = newState;
      autoAnalyzeToggle.checked = newState;
      highlightToggle.checked = newState;
      emailScannerToggle.checked = newState;
    });
  });

  enableToggle.addEventListener("change", e =>
    chrome.storage.sync.set({ enableExtension: e.target.checked })
  );

  autoAnalyzeToggle.addEventListener("change", e =>
    chrome.storage.sync.set({ autoAnalyze: e.target.checked })
  );

  highlightToggle.addEventListener("change", e =>
    chrome.storage.sync.set({ highlightSuspicious: e.target.checked })
  );

  document.getElementById("helpLink").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/misinfox/docs" });
  });
});
