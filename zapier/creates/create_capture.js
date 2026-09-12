const perform = async (z, bundle) => {
  const body = {};
  if (bundle.inputData.url) body.url = bundle.inputData.url;
  if (bundle.inputData.text) body.text = bundle.inputData.text;
  if (bundle.inputData.title) body.title = bundle.inputData.title;

  const res = await z.request({
    method: "POST",
    url: `${bundle.authData.base_url}/api/v1/captures`,
    body,
  });
  return res.data; // { id, status, deduped }
};

module.exports = {
  key: "create_capture",
  noun: "Capture",
  display: {
    label: "Save to Personal AI",
    description: "Saves a link or a note to your Personal AI memory.",
  },
  operation: {
    perform,
    inputFields: [
      { key: "url", label: "URL", type: "string", helpText: "A web page to fetch and remember." },
      { key: "text", label: "Note text", type: "text", helpText: "Or save plain text instead." },
      { key: "title", label: "Title", type: "string", helpText: "Optional title for a note." },
    ],
    sample: { id: "01NEWCAP", status: "queued" },
  },
};
