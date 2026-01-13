/* File: widget.js */
(() => {
  const script = document.currentScript;

  // Läs config från script-taggen i Framer (utan inline JS)
  const BACKEND = script?.dataset?.backend;
  const TITLE = script?.dataset?.title || "ZAAI";
  const ICON = script?.dataset?.icon || "💬";

  if (!BACKEND) {
    console.error("[ZAAI] Missing data-backend on script tag.");
    return;
  }

  const Z = 2147483000;

  function injectStyles() {
    const css = `
      .zaai-bubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:999px;
        background:#fff;border:1px solid #e9e9e9;box-shadow:0 10px 30px rgba(0,0,0,.2);
        display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:${Z};
        font:800 24px system-ui;user-select:none}
      .zaai-panel{position:fixed;right:20px;bottom:90px;width:380px;max-width:calc(100vw - 40px);
        height:560px;max-height:calc(100vh - 140px);background:#fff;border:1px solid #e9e9e9;
        border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);z-index:${Z};
        display:none;overflow:hidden;flex-direction:column}
      .zaai-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eee}
      .zaai-title{font:800 14px system-ui;color:#111}
      .zaai-close{border:none;background:transparent;cursor:pointer;font:900 18px system-ui;line-height:1;color:#111}
      .zaai-mount{flex:1}
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureChatKitReady() {
    if (!customElements.get("openai-chatkit")) {
      await loadScriptOnce("https://cdn.platform.openai.com/deployments/chatkit/chatkit.js");
      await customElements.whenDefined("openai-chatkit");
    }
  }

  async function createSession() {
    const deviceKey = "chatkit_device_id";
    const deviceId = localStorage.getItem(deviceKey);

    const res = await fetch(`${BACKEND}/api/chatkit/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId || null }),
    });

    if (!res.ok) throw new Error(`Session failed ${res.status}: ${await res.text()}`);
    const data = await res.json();

    if (data.user) localStorage.setItem(deviceKey, data.user);
    if (!data.client_secret) throw new Error("Missing client_secret from backend");

    return data.client_secret;
  }

  async function mountChatKit(mountEl) {
    mountEl.innerHTML = "";

    await ensureChatKitReady();

    const node = document.createElement("openai-chatkit");
    node.setOptions({
      api: {
        async getClientSecret(existing) {
          return existing || (await createSession());
        },
      },

      // ---- UI / theme här (du kan ändra färger/radius osv) ----
      theme: {
        colorScheme: "light",
        radius: "pill",
        density: "normal",
        color: {
          accent: { primary: "#9F80DA", level: 1 },
          surface: { background: "#ffffff", foreground: "#0B0B0F" },
        },
        typography: {
          baseSize: 16,
          fontFamily:
            '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          fontSources: [
            {
              family: "OpenAI Sans",
              src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
              weight: 400,
              style: "normal",
              display: "swap",
            },
            {
              family: "OpenAI Sans",
              src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Medium.woff2",
              weight: 500,
              style: "normal",
              display: "swap",
            },
            {
              family: "OpenAI Sans",
              src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Semibold.woff2",
              weight: 600,
              style: "normal",
              display: "swap",
            },
            {
              family: "OpenAI Sans",
              src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Bold.woff2",
              weight: 700,
              style: "normal",
              display: "swap",
            },
          ],
        },
      },
      composer: { placeholder: "Skriv ett meddelande till ZAAI…", attachments: { enabled: false } },
      startScreen: { greeting: "Chatta med oss! 👋", prompts: [] },
    });

    node.style.width = "100%";
    node.style.height = "100%";
    mountEl.appendChild(node);
  }

  function mountWidget() {
    injectStyles();

    // Bubble
    const bubble = document.createElement("div");
    bubble.className = "zaai-bubble";
    bubble.setAttribute("role", "button");
    bubble.setAttribute("tabindex", "0");
    bubble.setAttribute("aria-label", "Öppna chat");
    bubble.textContent = ICON;

    // Panel
    const panel = document.createElement("div");
    panel.className = "zaai-panel";
    panel.innerHTML = `
      <div class="zaai-header">
        <div class="zaai-title">${TITLE}</div>
        <button class="zaai-close" aria-label="Stäng">×</button>
      </div>
      <div class="zaai-mount"></div>
    `;

    const closeBtn = panel.querySelector(".zaai-close");
    const mountEl = panel.querySelector(".zaai-mount");

    closeBtn.addEventListener("click", () => (panel.style.display = "none"));

    async function toggle() {
      const opening = panel.style.display !== "flex";
      panel.style.display = opening ? "flex" : "none";
      if (opening) {
        try {
          await mountChatKit(mountEl);
        } catch (e) {
          console.error("[ZAAI] ChatKit mount error:", e);
          alert(e?.message || String(e));
        }
      }
    }

    bubble.addEventListener("click", toggle);
    bubble.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") toggle();
    });

    document.body.appendChild(panel);
    document.body.appendChild(bubble);

    console.log("[ZAAI] Widget mounted");
  }

  // Kör när DOM är redo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget);
  } else {
    mountWidget();
  }
})();
