// Polling trigger: open deadlines MirrorMind has extracted. Dedupes on `id`.
const perform = async (z, bundle) => {
  const res = await z.request({
    url: `${bundle.authData.base_url}/api/v1/action-items`,
    params: { status: "open" },
  });
  return res.data.items;
};

module.exports = {
  key: "deadline",
  noun: "Deadline",
  display: {
    label: "New or Open Deadline",
    description: "Triggers for each open deadline MirrorMind found in your captures.",
  },
  operation: {
    type: "polling",
    perform,
    sample: {
      id: "01DEADLN",
      title: "Submit exam form",
      due_at: "2026-09-10T11:30:00.000Z",
      status: "open",
      memory_id: "01ABCXYZ",
      memory_title: "Exam form notice",
    },
    outputFields: [
      { key: "id", label: "Deadline ID" },
      { key: "title", label: "Title" },
      { key: "due_at", label: "Due at", type: "datetime" },
      { key: "memory_title", label: "From memory" },
    ],
  },
};
