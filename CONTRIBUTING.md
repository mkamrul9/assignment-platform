# Contributing

Keep environment files and database volumes intact. Check `git status` before staging.

- `apps/api/src/modules/<feature>` owns routes, schemas, and business logic. Authorization stays in Express.
- `apps/web/src/app` owns routes; `src/features` owns connected UI. Browsers call relative `/api`.
- Strict TypeScript. No `any` or blanket suppressions to hide uncertainty.
- Forward Prisma migrations only. Never rewrite applied SQL or reset a shared database.

```sh
npm run check
npm run build
npm run db:check
npm run auth:check
npm run submissions:check
npm run reviews:check
npm run demo:check
npm run test:e2e
```
