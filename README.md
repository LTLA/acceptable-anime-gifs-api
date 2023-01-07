# REST API for acceptable anime GIFs

## Overview

This repository implements a REST API for serving anime GIFs from the [Acceptable Anime GIFs registry](https://github.com/LTLA/acceptable-anime-gifs).
The API is implemented as a Cloudflare Worker using the D1 SQL database for handling metadata.
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

Testing and deployment uses te standard `wrangler` workflow:

```sh
wrangler dev # testing
wrangler publish # deployment
```

Several secrets should be configured for deployment:

- This repository contains a GitHub Action to redeploy on a push to `master`.
  An appropriate API token should be specified in the `CF_API_TOKEN` secret.
- The D1 database ID is specified in [`wrangler.toml`](wrangler.toml). 
  This should be changed for developers wishing to deploy their own instance.
- The `PUT /index` endpoint will automatically build the D1 database instance from the [registry build artifacts](https://github.com/LTLA/acceptable-anime-gifs/releases/tag/latest).
  This requires the `Authorization: Bearer <secret>` header in the request,
  where `secret` is a secret that should be registered with the Cloudflare Worker via `wrangler secret put`.

