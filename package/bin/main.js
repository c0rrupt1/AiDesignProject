const minimist = require("minimist");
const { google } = require("../lib");
const { defaultOptions } = require("../lib/util");

function getOptions() {
  const argv = minimist(process.argv.slice(2), {
    alias: {
      language: ["lang"],
      "user-agent": ["ua"],
      "image-file": ["file"],
      "image-url": ["url"]
    },
    boolean: ["pretty"],
    default: {
      language: defaultOptions.language,
      "user-agent": defaultOptions.userAgent,
      provider: defaultOptions.provider,
      pretty: false
    }
  });

  const imageFilePath = argv.file;
  const imageURL = argv.url;

  if (imageFilePath && imageURL) {
    throw new Error("You must define --image-file XOR --image-url (not both)");
  }

  if (!imageFilePath && !imageURL) {
    throw new Error("Missing required parameter --image-file XOR --image-url");
  }

  return {
    language: argv.language,
    userAgent: argv.ua,
    provider: argv.provider,
    pretty: argv.pretty,
    imageFilePath,
    imageURL
  };
}

main(getOptions());

async function main({
  language,
  userAgent,
  provider,
  imageFilePath,
  imageURL,
  pretty
}) {
  let result;
  let exitCode = 0;

  try {
    switch (provider) {
      case "google": {
        let resultURL;

        if (imageFilePath) {
          resultURL = await google.searchByImageUpload({
            imageFilePath,
            language,
            userAgent
          });
        } else {
          resultURL = await google.searchByImageURL({
            imageURL,
            language,
            userAgent
          });
        }

        result = {
          ok: true,
          data: {
            provider,
            url: resultURL
          }
        };

        break;
      }

      default: {
        throw new Error(`invalid provider ${provider}`);
      }
    }
  } catch (err) {
    exitCode = 1;
    result = {
      ok: false,
      data: {
        errors: [`${err}`]
      }
    };
  }

  console.log(
    pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result)
  );
  process.exit(exitCode);
}
