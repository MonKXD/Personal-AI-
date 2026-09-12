/* Shared config + API client. Loaded by the service worker (importScripts)
 * and by the popup / options pages (<script>). No modules — max compat. */

const DEFAULT_BASE = "https://mirror-mindai.vercel.app";

const MM = {
  async getConfig() {
    const { base, token } = await chrome.storage.sync.get(["base", "token"]);
    return { base: (base || DEFAULT_BASE).replace(/\/+$/, ""), token: token || "" };
  },

  async setConfig(next) {
    await chrome.storage.sync.set(next);
  },

  /** GET /api/v1/me — used by the "Test connection" button and the popup dot. */
  async ping() {
    const { base, token } = await this.getConfig();
    if (!token) return { ok: false, error: "No API token set." };
    try {
      const res = await fetch(`${base}/api/v1/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return { ok: false, error: "Token rejected." };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Can't reach MirrorMind." };
    }
  },

  /** POST /api/v1/captures  { url } | { text, title } */
  async save(payload) {
    const { base, token } = await this.getConfig();
    if (!token) return { ok: false, error: "Set your API token in the extension options." };
    try {
      const res = await fetch(`${base}/api/v1/captures`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.message || `HTTP ${res.status}` };
      return { ok: true, id: body.id, deduped: !!body.deduped };
    } catch (e) {
      return { ok: false, error: "Can't reach MirrorMind." };
    }
  },
};

if (typeof self !== "undefined") self.MM = MM;
