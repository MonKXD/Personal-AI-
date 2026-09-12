const { version } = require("./package.json");
const platformVersion = require("zapier-platform-core").version;

const authentication = require("./authentication");
const newMemory = require("./triggers/new_memory");
const deadline = require("./triggers/deadline");
const instantEvent = require("./triggers/instant_event");
const createCapture = require("./creates/create_capture");
const ask = require("./creates/ask");

module.exports = {
  version,
  platformVersion,
  authentication,
  beforeRequest: [...(authentication.beforeRequest || [])],
  afterResponse: [],
  triggers: {
    [newMemory.key]: newMemory,
    [deadline.key]: deadline,
    [instantEvent.key]: instantEvent,
  },
  creates: {
    [createCapture.key]: createCapture,
    [ask.key]: ask,
  },
  searches: {},
};
