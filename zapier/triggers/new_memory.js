// Polling trigger: fires for each new memory. Zapier dedupes on `id`.
const perform = async (z, bundle) => {
  const res = await z.request({
    url: `${bundle.authData.base_url}/api/v1/memories`,
    params: { limit: 50 },
  });
  return res.data.items;
};

module.exports = {
  key: "new_memory",
  noun: "Memory",
  display: {
    label: "New Memory",
    description: "Triggers when a new memory is created in Personal AI.",
  },
  operation: {
    type: "polling",
    perform,
    sample: {
      id: "01ABCXYZ",
      type: "notice",
      title: "Exam form notice",
      summary: "Forms due Wednesday 5 PM. Code 40822.",
      tags: ["exam"],
      captured_at: "2026-09-08T08:00:00.000Z",
    },
    outputFields: [
      { key: "id", label: "Memory ID" },
      { key: "type", label: "Type" },
      { key: "title", label: "Title" },
      { key: "summary", label: "Summary" },
      { key: "captured_at", label: "Captured at", type: "datetime" },
    ],
  },
};
