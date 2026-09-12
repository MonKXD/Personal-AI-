const baseEl = document.getElementById("base");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls || "";
}

(async () => {
  const cfg = await MM.getConfig();
  baseEl.value = cfg.base;
  tokenEl.value = cfg.token;
})();

document.getElementById("save").addEventListener("click", async () => {
  const base = baseEl.value.trim().replace(/\/+$/, "") || "https://personal-ai.vercel.app";
  const token = tokenEl.value.trim();
  await MM.setConfig({ base, token });
  setStatus("Saved.", "ok");
});

document.getElementById("test").addEventListener("click", async () => {
  const base = baseEl.value.trim().replace(/\/+$/, "") || "https://personal-ai.vercel.app";
  const token = tokenEl.value.trim();
  await MM.setConfig({ base, token });
  setStatus("Checking…", "");
  const r = await MM.ping();
  setStatus(r.ok ? "Connected ✓" : r.error, r.ok ? "ok" : "bad");
});
