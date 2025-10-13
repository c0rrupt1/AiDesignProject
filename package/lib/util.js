const CDP = require("chrome-remote-interface");

exports.wait = async function(ms) {
  return new Promise(r => setTimeout(r, ms));
};

exports.documentQuerySelector = async function(client, selector) {
  const document = await client.DOM.getDocument();

  const node = await client.DOM.querySelector({
    nodeId: document.root.nodeId,
    selector
  });

  return node;
};

exports.loadPage = async function(client, url) {
  const { errorText } = await client.Page.navigate({ url });

  if (errorText) {
    return Promise.reject(errorText);
  }

  await client.Page.loadEventFired();
};

exports.getPageURL = async function(client) {
  const windowLocation = await client.Runtime.evaluate({
    expression: "window.location.href"
  });

  return windowLocation.result.value;
};

exports.smackEnter = async function(client) {
  await client.Input.dispatchKeyEvent({
    type: "keyDown",
    windowsVirtualKeyCode: 13
  });

  await exports.wait(5);

  await client.Input.dispatchKeyEvent({
    type: "keyUp",
    windowsVirtualKeyCode: 13
  });
};

exports.defaultOptions = {
  language: "en",
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64; rv:65.0) Gecko/20100101 Firefox/65.0",
  provider: "google"
};

exports.getDefaultClient = async function(overrides) {
  const options = exports.defaultOptions;

  options.userAgent = overrides.userAgent || options.userAgent;
  options.provider = overrides.provider || options.provider;
  options.language = overrides.language || options.language;

  const client = await CDP();

  await client.Page.enable();
  await client.Network.setUserAgentOverride({ userAgent: options.userAgent });

  return client;
};
