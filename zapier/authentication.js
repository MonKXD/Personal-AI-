// API-key auth. The user pastes a token from Personal AI → Settings → API.
module.exports = {
  type: "custom",
  fields: [
    {
      key: "api_token",
      label: "API token",
      type: "string",
      required: true,
      helpText: "Personal AI → Settings → API → New key. Starts with `mm_`.",
    },
    {
      key: "base_url",
      label: "Personal AI URL",
      type: "string",
      required: false,
      default: "https://personal-ai.vercel.app",
      helpText: "Only change this if you self-host.",
    },
  ],
  test: {
    url: "{{bundle.authData.base_url}}/api/v1/me",
    method: "GET",
  },
  connectionLabel: "{{json.user_id}}",
};

module.exports.beforeRequest = [
  (request, z, bundle) => {
    if (bundle.authData.api_token) {
      request.headers.Authorization = `Bearer ${bundle.authData.api_token}`;
    }
    return request;
  },
];
