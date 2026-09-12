/* Service worker: context menus + result notifications. The toolbar button
 * opens popup.html instead of firing here. */

importScripts("config.js");

const MENUS = [
  { id: "mm-page", title: "Save this page to MirrorMind", contexts: ["page"] },
  { id: "mm-link", title: "Save link to MirrorMind", contexts: ["link"] },
  { id: "mm-selection", title: "Save selection to MirrorMind", contexts: ["selection"] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const m of MENUS) chrome.contextMenus.create(m);
  });
});

function toast(ok, msg) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: ok ? "Saved to MirrorMind" : "MirrorMind",
    message: msg,
  });
  // brief badge cue
  chrome.action.setBadgeText({ text: ok ? "✓" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: ok ? "#3bb2b4" : "#f06a6a" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let payload;
  if (info.menuItemId === "mm-link" && info.linkUrl) {
    payload = { url: info.linkUrl };
  } else if (info.menuItemId === "mm-selection" && info.selectionText) {
    payload = {
      text: info.selectionText,
      title: tab?.title ? `Note from ${tab.title}` : "Saved note",
    };
  } else {
    payload = { url: info.pageUrl || tab?.url };
  }
  if (!payload.url && !payload.text) return;

  const r = await MM.save(payload);
  toast(
    r.ok,
    r.ok
      ? r.deduped
        ? "Already saved — nothing new added."
        : "Reading it now. It'll be in your memory shortly."
      : r.error,
  );
});
