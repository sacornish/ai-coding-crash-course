# Copilot Instructions

Cadence: a mini-Udemy course platform (React Router 8 framework mode with SSR, TypeScript, SQLite via better-sqlite3 + Drizzle ORM, Tailwind 4 + shadcn/ui, Vitest). It is the exercise repo for the AI Coding Crash Course.

## Commands

```bash
npm install
npm run db:migrate && npm run db:seed   # create/seed data.db (needed before first dev run)
npm run dev                             # http://localhost:5173
npm run typecheck                       # react-router typegen && tsc (typegen required for ./+types/* imports)
npm test                                # vitest run (all tests)
npx vitest run app/services/courseService.test.ts          # single file
npx vitest run app/services/courseService.test.ts -t "name" # single test
npm run db:generate                     # after editing app/db/schema.ts; creates a migration in drizzle/
```

No linter is configured; formatting is Prettier (`.prettierrc`).

## Architecture

- **Routing** is explicit in `app/routes.ts` (not file-system routing). New routes must be registered there; most are nested under `layout("routes/layout.app.tsx")`. Route modules export `loader`/`action`/`meta` and import generated types from `./+types/<route-file-name>`.
- **Layering**: route modules (`app/routes/*`) → services (`app/services/*Service.ts`) → Drizzle `db` (`app/db`). Routes call services; business logic and queries live in services, not in routes.
- **Schema** is in `app/db/schema.ts`; migrations in `drizzle/` are the source of truth (tests apply them, so always generate a migration when changing the schema).
- **Auth** is a dev-style cookie session (`app/lib/session.ts`, stores `userId`). `api.switch-user` / `api.set-dev-country` routes exist for dev impersonation and country override.
- **Pricing**: purchase-parity pricing in `app/lib/ppp.ts`; country detection in `app/lib/country.server.ts` (`.server` files must never be imported client-side).
- `request-logger/` is a proxy dev tool (`npm run request-logger`); `.sandcastle/` runs autonomous Claude agents in Docker against a PRD + plan.

## Conventions

- Import app code via the `~/` alias (e.g. `~/services/courseService`).
- Service functions use **positional parameters** (not option objects), are synchronous (`.get()` / `.all()` / `.run()` better-sqlite3 style), and import `db` from `~/db`.
- `app/db/index.ts` must stay side-effect free: the connection is opened lazily and `db` is a Proxy, so importing a service from a route doesn't pull better-sqlite3 into the client bundle. Don't open the DB at module scope.
- Validate request input in routes with zod helpers in `app/lib/validation.ts` (`parseFormData`, `parseParams`, `parseJsonBody`); actions with multiple intents use `z.discriminatedUnion("intent", ...)`.
- Status/enum values come from `app/db/schema.ts` (e.g. `CourseStatus`) — use them rather than string literals.
- **Tests** are colocated as `*.test.ts` next to the source. Service tests use an in-memory DB from `~/test/setup` (`createTestDb`, `seedBaseData`) and mock `~/db`:

  ```ts
  let testDb: ReturnType<typeof createTestDb>;
  vi.mock("~/db", () => ({ get db() { return testDb; } }));
  // import the service AFTER vi.mock; create testDb in beforeEach
  ```
