const dot = document.getElementById("dot");
const urlEl = document.getElementById("url");
const note = document.getElementById("note");
const saveBtn = document.getElementById("save");
const msg = document.getElementById("msg");

let currentTab = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  urlEl.textContent = tab?.url || "";
  const cfg = await MM.getConfig();
  if (!cfg.token) {
    dot.className = "dot bad";
    setMsg("Set your API token in Settings first.", "bad");
    saveBtn.disabled = true;
    return;
  }
  const p = await MM.ping();
  dot.className = "dot " + (p.ok ? "ok" : "bad");
  if (!p.ok) setMsg(p.error, "bad");
}

function setMsg(text, cls) {
  msg.textContent = text;
  msg.className = cls || "";
}

note.addEventListener("input", () => {
  saveBtn.textContent = note.value.trim() ? "Save this note" : "Save this page";
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  setMsg("Saving…", "");
  const text = note.value.trim();
  const payload = text
    ? { text, title: currentTab?.title ? `Note from ${currentTab.title}` : "Saved note" }
    : { url: currentTab?.url };
  const r = await MM.save(payload);
  if (r.ok) {
    setMsg(r.deduped ? "Already saved." : "Saved — reading it now.", "ok");
    setTimeout(() => window.close(), 1200);
  } else {
    setMsg(r.error, "bad");
    saveBtn.disabled = false;
  }
});

document.getElementById("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
