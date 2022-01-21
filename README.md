# REST API for acceptable anime GIFs

## Overview

This repository implements a REST API for serving anime GIFs from the [Acceptable Anime GIFs registry](https://github.com/LTLA/acceptable-anime-gifs).
The API is written with Node.js and is intended to be deployed on a Cloudflare Worker.
An existing deployment is available [here](https://anime-gifs.aaron-lun.workers.dev) on the Cloudflare's free tier.

## Available endpoints

The [Swagger UI](https://ltla.github.io/acceptable-anime-gifs-api) contains a full description of the available endpoints, their parameters and their responses.
We summarize them briefly here:

- `GET /random` returns metadata for a single randomly chosen GIF. 
This includes the location of the GIF, the [MyAnimeList](https://myanimelist.net) identifier and name for the show, and the names and IDs of the characters involved.
Users can optionally filter by show or sentiment.
- `GET /random/markdown` returns a Markdown-formatted message containing a link to the image and a description of the characters involved.
This is intended for direct use in, e.g., Slack messages.
- `GET /random/gif` redirects users to the GIF itself.
All GIFs are currently hosted in the registry's GitHub repository. 
- `GET /shows` returns a list of currently available shows.
- `GET /sentiments` returns a list of currently available sentiments.

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
