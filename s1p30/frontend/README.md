# s1p30 dashboard

A React dashboard for the analysis in the backend folder. It shows what is happening (Understand), what to do about it (Decide) and whether things are on track (Monitor), and it runs on Cloudflare Workers with static assets.

## Run locally

Node 22 or newer is required.

1. `npm install`
2. `npm run check` copies the latest backend output into `public/data` and checks every file against the shapes the pages expect.
3. `npm run dev` and open http://localhost:5173

## Update after the backend is re-run

Run `npm run deploy`. It refreshes the data, checks it, builds the site and deploys it.

## Deploy

1. `npx wrangler login` (first time only)
2. `npm run deploy`

Wrangler prints the address of the site when it finishes.

## Protecting the site

The data files under `/data` are public to anyone who can open the site. For real client data, put the address behind a Cloudflare Access policy. Synthetic or public data can stay open.

## Optional read-only MCP access

The Worker can serve a read-only MCP endpoint at `/mcp`. It is off by default. Set `MCP_MODE` in `wrangler.toml` to one of:

- `off`: the endpoint answers 404.
- `token`: clients must send `Authorization: Bearer <token>`. Store the token with `npx wrangler secret put MCP_TOKEN`.
- `open`: anyone can read the same data that the site already serves. Suitable for synthetic data only.

## Where the data comes from

`npm run check` and `npm run dev` copy `../backend/output` into `public/data`. The backend is never modified. The check prints one line per dataset (OK, UNAVAILABLE, MISSING or INVALID) and stops the build when a core file is invalid.

## Folder map

- `src/utils` adapters, formatters and the dataset registry
- `src/hooks` data loading and routing
- `src/components` pages grouped by section
- `scripts` data refresh and data check
- `worker` the Worker for the optional API and MCP routes
- `public` static files and the data copy
