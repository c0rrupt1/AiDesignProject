reverse-image-search
================================================================================

> library & executable for reverse image searches.

Supported Providers
--------------------------------------------------------------------------------

 * "google": Google Reverse Image Search.

Install
--------------------------------------------------------------------------------

CLI:

```
npm install -g reverse-image-search
```

Module:

```
npm install --save reverse-image-search
```


Requirements
--------------------------------------------------------------------------------

You **MUST** be running a [headless chrome][hc] (or chromium) remote debugging
session (on port 9222) before running any of the examples. This module does not
handle this for you at the moment and will return an error response if skipped.

You can start a headless chromium instance as such in another terminal:

```sh
$ chromium --headless --disable-gpu --remote-debugging-port=9222
```

It's up to you to determine the best way to do this given your requirements.

[hc]: https://chromium.googlesource.com/chromium/src/+/lkgr/headless/README.md

CLI
--------------------------------------------------------------------------------

```sh
$ npm install -g reverse-image-search
$ ris --image-url https://i.imgur.com/XLXBB9z.jpg --pretty
{
  "ok": true,
  "data":{
    "provider": "google",
    "url": "https://www.google.com/search?tbs=sbi:xxx&hl=en"
  }
}
```

The `url` contains results from the reverse image search.

As a module
--------------------------------------------------------------------------------

```javascript
const { google } = require('reverse-image-search');

google.searchByImageURL({
  imageURL: 'https://i.imgur.com/XLXBB9z.jpg'
}).then(result => {
  console.log(result);
}).catch(err => {
  console.error(err);
});
```

Options
--------------------------------------------------------------------------------

The options below are in the format:

 * `<nodeOption>: <[type: default]>` / `--<cli-option> <[type: default]>`.

In some cases, options are only supported in the CLI.

- - -

### `--pretty` (default = false)

Should we pretty print the results?

### `imageURL: <string>` / `--image-url <string>`

*required unless --image-file is provided*

Provide an image URL for performing a reverse image search with.

### `imageFile: <string>` / `--image-file <string>`

*required unless --image-url is provided*

Provide an image file path for performing a reverse image search with.

### `provider: <string>` / `--provider <string>` (default = "google")

Specify which provider to use, e.g. `google`.

### `language: <string>` / `--language <string>` (default = "en")

*provider specific*

Language to pass to the provider.

e.g. Google supports `en`, `fr`, `es`, ...

### `userAgent: <string>` / `--user-agent <string>` (default = "Firefox")

Specify a user agent to use with requests.

*warning*: this might invalidate assumptions this library makes when
parsing the resulting HTML if you choose an obscure User Agent. Open
an issue or a PR with a fix if this occurs.
