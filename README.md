# BuildStack

Ranked AI tool directory. Live at https://buildstack.tier11.com

## Stack
- Cloudflare Workers + Hono
- Cloudflare D1 for newsletter subscribers
- Stripe TEST payment link for featured listings
- Resend domain news.tier11.com (DNS configured; no sends yet)

## Develop
```bash
npm install
npx wrangler dev
```

## Deploy (from Scar with wrangler OAuth)
```bash
npx wrangler d1 execute buildstack --remote --file=schema.sql
npx wrangler deploy
```

## Secrets
None required for v1. Stripe link is a public TEST payment link in `wrangler.toml` vars.
