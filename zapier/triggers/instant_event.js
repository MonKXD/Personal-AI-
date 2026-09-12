// REST Hook trigger — instant events via Personal AI webhooks.
const subscribe = async (z, bundle) => {
  const res = await z.request({
    method: "POST",
    url: `${bundle.authData.base_url}/api/v1/webhooks`,
    body: { url: bundle.targetUrl, events: [bundle.inputData.event || "*"] },
  });
  return res.data; // { id, secret, ... }
};

const unsubscribe = async (z, bundle) => {
  const id = bundle.subscribeData && bundle.subscribeData.id;
  if (!id) return {};
  await z.request({
    method: "DELETE",
    url: `${bundle.authData.base_url}/api/v1/webhooks/${id}`,
  });
  return {};
};

// Incoming POST body: { event, data, timestamp } — hand `data` to Zapier.
const perform = (z, bundle) => [{ ...bundle.cleanedRequest.data, event: bundle.cleanedRequest.event }];

const performList = async (z, bundle) => {
  // Fallback sample for the editor: last few memories.
  const res = await z.request({
    url: `${bundle.authData.base_url}/api/v1/memories`,
    params: { limit: 3 },
  });
  return res.data.items.map((m) => ({ ...m, event: "memory.created" }));
};

module.exports = {
  key: "instant_event",
  noun: "Event",
  display: {
    label: "Instant Event (webhook)",
    description:
      "Fires immediately on capture.completed / memory.created / action_item.due_soon / digest.weekly.",
  },
  operation: {
    type: "hook",
    inputFields: [
      {
        key: "event",
        label: "Event",
        type: "string",
        choices: {
          "*": "All events",
          "memory.created": "Memory created",
          "capture.completed": "Capture completed",
          "action_item.due_soon": "Deadline due soon",
          "digest.weekly": "Weekly digest",
        },
        default: "*",
      },
    ],
    performSubscribe: subscribe,
    performUnsubscribe: unsubscribe,
    perform,
    performList,
    sample: {
      event: "memory.created",
      memory_id: "01ABCXYZ",
      type: "notice",
      title: "Exam form notice",
      summary: "Forms due Wednesday 5 PM.",
    },
  },
};
