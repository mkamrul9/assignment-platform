# Operations and release readiness

## Supported topology

```text
Browser → HTTPS ingress → Next.js → private Express API → PostgreSQL
```

Next.js forwards relative `/api` requests to server-only `API_INTERNAL_URL`. That address is read by the server at runtime; the same build can point to a different internal API at startup. Browser Origins and cookies are preserved. Missing Origins are never manufactured. Upstream connection failures return JSON `502 API_UNAVAILABLE`; requests that exceed the 15-second upstream response deadline return `504 API_TIMEOUT`.

Express enforces authentication, current database roles, trusted Origins, validation, and database transactions. The frontend must never connect directly to PostgreSQL.

## Release order

1. Install with `npm ci --include=dev`. Compilation and Prisma migrations use build-time development dependencies.
2. Run `npm run check`, all four integration checks, and browser tests in an isolated test environment. Build with `npm run build`.
3. Take a database backup and verify the restore procedure in a separate database.
4. Apply **committed** migrations to the target database: `npm run db:migrate:deploy`. Review forward migrations before a release; schema rollbacks are not automatic.
5. For initial setup, supply `MENTOR_NAME`, `MENTOR_EMAIL`, and `MENTOR_PASSWORD` as secrets and run `npm run db:seed`. Existing mentors are left unchanged. Do not automate password rotation through the seed.
6. Start the API and web processes with `NODE_ENV=production` and the environment below. Verify the homepage, direct/private health, proxied health, and a synthetic HTTPS login before directing users to the release.

Use a process supervisor with restart limits and shutdown support. API shutdown stops accepting requests, drains current requests, and disconnects Prisma; a 10-second deadline bounds shutdown. Host termination grace must exceed that deadline. Do not run a disposable test suite against production credentials.

## Environment and network boundary

- API: `NODE_ENV=production`, `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, `JWT_ISSUER`, `JWT_AUDIENCE`, `WEB_ORIGINS`, `PORT`, and `TRUST_PROXY`.
- Web: `NODE_ENV=production`, private `API_INTERNAL_URL`, and optionally `TRUST_INGRESS_CLIENT_IP=1` under the restrictions below. Keep signing and database secrets out of the web environment.
- Use exact public HTTPS origins in `WEB_ORIGINS`. Cookies are HttpOnly, host-only, `SameSite=Lax`, `Path=/`, and `Secure` when the **API** runs in production. HTTP authentication in production is unsupported.
- Keep Express private. `TRUST_PROXY=1` assumes exactly the Next.js hop immediately before Express; do not add a direct public route that bypasses it.
- By default, Next strips caller forwarding headers. Login/signup then share the Next→Express peer-IP bucket. To enforce distinct per-client buckets, place a trusted ingress in front of Next that **replaces** `X-Forwarded-For` with its verified peer address. Enable `TRUST_INGRESS_CLIENT_IP=1` only if clients cannot bypass that ingress.
- At the ingress, set appropriate request-body limits, connection timeouts, TLS, and access logs with sensitive cookie/header redaction. Express bounds JSON bodies to 64 KiB; the ingress should also bound requests before Next buffers them.

Do not change `NODE_ENV` to weaken cookie security for a production smoke test. The browser suite deliberately runs its isolated API in test mode on local HTTP; it does not demonstrate real HTTPS certificate or ingress behavior.

## Running production processes

After configuration, run the following in **two separate terminals**. Port 4000 is the default API port; preserve an existing configured override.

Bash, API terminal:

```sh
NODE_ENV=production npm run start --workspace=@reviewdock/api
```

Bash, web terminal:

```sh
NODE_ENV=production API_INTERNAL_URL=http://127.0.0.1:4000 npm run start --workspace=@reviewdock/web
```

PowerShell, API terminal:

```powershell
$env:NODE_ENV = 'production'
npm run start --workspace=@reviewdock/api
```

PowerShell, web terminal:

```powershell
$env:NODE_ENV = 'production'
$env:API_INTERNAL_URL = 'http://127.0.0.1:4000'
npm run start --workspace=@reviewdock/web
```

## Backups, health, and troubleshooting

Schedule PostgreSQL backups outside the application container/volume, protect them as secrets, define retention, and perform restore drills. Container persistence is not a backup. `db:down` keeps the Docker volume; `db:reset` destroys the database named by `DATABASE_URL`. Never use reset for deployment migrations.

`GET /api/health` is a process liveness check. It stays available without a database and does not establish database readiness. Check migrations and database connectivity separately during release verification. A proxied 502 means Next cannot reach Express; check the internal hostname, port, private network, and API process. A 403 on mutations usually requires checking the exact browser Origin against `WEB_ORIGINS`. A 429 includes retry information.

Monitor API availability, error rates, latency, database pool saturation, and backup results. Choose and configure the hosting platform's structured logs, alerting, and retention before launch; this repository does not provision observability infrastructure.

## What is and is not established

The local checks establish the implemented application lifecycle, permission boundaries, database constraints/transactions, Chromium interactions, and production compilation. A real release additionally needs an observed green GitHub Actions run, an authorized hosting target, HTTPS/proxy verification, tested backups, monitoring, and capacity/load testing for the expected traffic. Firefox/WebKit and screen-reader testing are not part of the current browser suite.

Rate limits are in memory, per process, and reset on restart. Multiple API instances require a shared limiter store before relying on global limits. Logout clears the browser cookie; a copied JWT remains valid until its 30-minute expiry. There is no immediate revocation or account-recovery flow. Drafts are device-local, not server backups. These are explicit scope limitations, not production guarantees.
