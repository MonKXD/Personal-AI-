const perform = async (z, bundle) => {
  const res = await z.request({
    method: "POST",
    url: `${bundle.authData.base_url}/api/v1/ask`,
    body: { question: bundle.inputData.question },
  });
  return res.data; // { answer, no_memory, citations, used_filters }
};

module.exports = {
  key: "ask",
  noun: "Answer",
  display: {
    label: "Ask MirrorMind",
    description: "Asks your memory a question and returns a cited answer.",
  },
  operation: {
    perform,
    inputFields: [
      { key: "question", label: "Question", type: "text", required: true },
    ],
    sample: {
      answer: "Your Physics lab is Mondays 15:00–17:00 in Lab-5.",
      no_memory: false,
      citations: [{ memory_id: "01ABCXYZ", title: "Time Table", type: "timetable" }],
    },
  },
};
