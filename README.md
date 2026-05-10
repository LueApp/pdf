# PDF Combiner

Static browser-only PDF combiner for Cloudflare.

## Features

- Merge PDFs in the browser
- Select page ranges per input file
- Rotate individual inputs
- Reverse selected pages per input file
- Add a cover page
- Add separator pages between queued PDFs
- Add page numbers to the output
- Apply a text watermark stamp
- Set PDF title, author, and subject metadata
- Preview the modified PDF before download

## Cloudflare Workers Build Settings

- Framework preset: `None`
- Build command: `npm run build`
- Deploy command: `npm run deploy:cloudflare`

The project deploys as a Worker with static assets from `dist/`. The `wrangler.toml` file provides:

```toml
[assets]
directory = "./dist"
```

If using a normal Cloudflare Pages project instead of Workers Builds, use:

- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: `npm run deploy:pages`

The Pages deploy path requires an API token with Account > Cloudflare Pages > Edit permission.

For a manual Wrangler deploy from a local machine, use:

```bash
npm run deploy
```
