# REST API for acceptable anime GIFs

## Overview

This repository implements a REST API for serving anime GIFs from the [Acceptable Anime GIFs registry](https://github.com/LTLA/acceptable-anime-gifs).
The API is written with Node.js and is intended to be deployed on a Cloudflare Worker.
An existing deployment is available [here](https://anime-gifs.aaron-lun.workers.dev) on the Cloudflare's free tier.

## Available endpoints

### Getting a random GIF

```
GET /random
```

returns metadata for a single randomly chosen GIF. 
This includes the location of the GIF, the [MyAnimeList](https://myanimelist.net) identifier and name for the show, and the names and IDs of the characters involved.

```
{
  "path":"10165_Nichijou/0008.gif",
  "show_id":"10165",
  "show_name":"Nichijou",
  "characters":{
    "Hakase Shinonome":"41055",
    "Sakamoto":"41069"
  },
  "url":"https://raw.githubusercontent.com/LTLA/acceptable-anime-gifs/master/registry/10165_Nichijou/0008.gif"
}
```

Alternatively, we can use

```
GET /random/markdown
```

to obtain a message that is formatted with Markdown for immediate use in, e.g., Slack messages:

```
[Yuuko Aioi](https://myanimelist.net/character/10418), [Mai Minakami](https://myanimelist.net/character/10421) and [Mio Naganohara](https://myanimelist.net/character/40081) from [Nichijou](https://myanimelist.net/anime/10165)

![10165_Nichijou/0005.gif](https://raw.githubusercontent.com/LTLA/acceptable-anime-gifs/master/registry/10165_Nichijou/0005.gif)
```

To obtain a redirect to the GIF itself, we use:

```
GET /random/gif
```

### Applying filters

We can filter for particular shows by providing a comma-separated list of their [MyAnimeList](https://myanimelist.net) identifiers.
For example, to obtain GIFs related to [Yuru Camp](https://myanimelist.net/anime/34798) or [K-On!](https://myanimelist.net/anime/5680), we can use:

```
GET /random?shows=34798,5680
```

Additionaly, we can filter for particular sentiments by providing a comma-separated list of available sentiments.
For example, to obtain GIFs involving some kind of failure, we can use:

```
GET /random?sentiments=fail
```

The set of available shows and sentiments can be obtained by calling:

```
GET /shows
GET /sentiments
```

## Build instructions

To keep things simple, we package the GIF manifest into the application rather than requiring the Worker to perform external calls.
This is done by running the `preprocess.js` script on the manifest artifacts produced by the [GIF registry's workflows](https://github.com/LTLA/acceptable-anime-gifs/actions),
which produces a `manifest.js` Node module that is imported by `index.js`.
The API can then directly interrogate the metadata for each GIF without the need for further fetch requests.

```sh
curl -L https://github.com/LTLA/acceptable-anime-gifs/releases/download/latest/gifs.json > gifs.json
curl -L https://github.com/LTLA/acceptable-anime-gifs/releases/download/latest/shows.json > shows.json
node preprocess.js
```

Deployment is performed using the usual `wrangler publish` method for Cloudflare Workers.
This repository contains a GitHub Action to redeploy on a push to `master` and nightly.
In this manner, we can incorporate updates to the GIF registry in a timely manner.
Currently, it deploys to my own Cloudflare account ID (see `wrangler.toml`) and requires the appropriate API token in the `CF_API_TOKEN` secret.
Developers wishing to create their own deployment can simply fork this repository and replace those two parameters.
