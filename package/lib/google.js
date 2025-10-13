const {
  wait,
  documentQuerySelector,
  loadPage,
  getPageURL,
  smackEnter,
  getDefaultClient
} = require("./util");

exports.initReverseImageSearch = async function(client, { language }) {
  await loadPage(client, `https://www.google.com/imghp?hl=${language}`);

  // We have to interact with the "Search by Image" to have the page
  // render the form we need to continue with reverse image searching.
  const selector = 'div[aria-label="Search by image"]';
  const searchByImageNode = await documentQuerySelector(client, selector);

  await client.DOM.focus({ nodeId: searchByImageNode.nodeId });

  await smackEnter(client);

  // wait until the modal as fully loaded (i.e. all elements that we
  // care about are in memory)
  await client.Runtime.evaluate({
    timeout: 30000,
    expression: `(() => {
      (function wait() {
        const isLoaded = (document.getElementById('qbui') &&
                          document.getElementById('qbfile') &&
                          document.querySelector('#qbbtc > input'));

        if (!isLoaded) {
          console.log('waiting 10ms for modal to load...');
          setTimeout(wait, 10);
        } else {
          console.log('modal has loaded!');
          setTimeout(() => {}, 1); // next tick
        }
      })();

    })()`
  });

  // hack to get around the driver not assigning a proper #qbui nodeId
  // in some instances (i.e. nodeId === 0) but still being able to "select
  // it" within the tree without an error. Headless chrome is still in
  // development so what should we expect?
  await new Promise((resolve, reject) => {
    (function waitForId() {
      documentQuerySelector(client, "#qbui")
        .then(imageURLInput => {
          if (imageURLInput.nodeId === 0) {
            setTimeout(waitForId, 10);
          } else {
            resolve();
          }
        })
        .catch(reject);
    })();
  });
};

exports.searchByImageUpload = async function({
  language,
  imageFilePath,
  userAgent
}) {
  let client;

  try {
    client = await getDefaultClient({ language, userAgent });

    await exports.initReverseImageSearch(client, { language });

    const fileInputNode = await documentQuerySelector(client, "#qbfile");

    await client.DOM.setFileInputFiles({
      files: [`${imageFilePath}`],
      nodeId: fileInputNode.nodeId
    });

    await client.Page.loadEventFired();

    return await getPageURL(client);
  } catch (err) {
    throw err;
  } finally {
    if (client) {
      await client.close();
    }
  }
};

exports.searchByImageURL = async function({ language, imageURL, userAgent }) {
  let client;

  try {
    client = await getDefaultClient({ language, userAgent });

    await exports.initReverseImageSearch(client, { language });

    await client.Runtime.evaluate({
      expression: `(() => {
        document.querySelector('#qbui').value = '${imageURL}';
        document.querySelector('#qbbtc > input').click();
      })()`
    });

    await client.Page.loadEventFired();

    return await getPageURL(client);
  } catch (err) {
    throw err;
  } finally {
    if (client) {
      await client.close();
    }
  }
};
