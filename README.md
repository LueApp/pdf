# PDF Combiner

Static browser-only PDF combiner for Cloudflare Pages.

## Cloudflare Pages Settings

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: `npm run deploy:cloudflare`

Do not set the deploy command to `npx wrangler deploy`. That command is for Workers, not Pages, and Cloudflare will fail with `Missing entry-point to Worker script or to assets directory`.

For a manual Wrangler deploy from a local machine, use:

```bash
npm run deploy
```
