# PDF Toolbox

Static browser-only PDF toolbox for Cloudflare.

## Features

- Merge PDFs in the browser
- View the selected source PDF immediately after upload
- Select pages visually from the active PDF
- Insert blank pages after selected source pages
- Add text or image stamps to selected pages
- Upload photographed document images and auto-align each trapezoid into a rectangular PNG
- Adjust detected image corners, straight edges, or curved edges manually and rotate source images before export
- Download one rectified image or all generated images as a ZIP
- Extract selected pages into a new PDF
- Remove selected pages from PDFs
- Rotate selected pages while leaving the rest of each PDF in place
- Duplicate selected pages inside each PDF
- Select page ranges per input file
- Rotate individual inputs
- Reverse selected pages per input file
- Fit source pages onto A4 or Letter output pages
- Add front and end blank pages
- Add a cover page
- Add a table of contents
- Add separator pages between queued PDFs
- Insert duplex blank pages so sections can start on right-hand pages
- Add page numbers to the output
- Scope page numbers to all pages, non-front-matter pages, or source pages only
- Add source filename labels to copied source pages
- Add a date stamp
- Apply a text watermark stamp
- Flatten form fields before merging
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
