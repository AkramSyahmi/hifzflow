# Features

Each feature is a self-contained slice of the product. A feature owns its own
components, hooks, types, validation schemas and data access, and exposes a
narrow public surface through `index.ts`.

```
src/features/<feature>/
├── components/     UI specific to this feature
├── hooks/          Client hooks specific to this feature
├── actions/        Server Actions (mutations)
├── queries/        Server-side reads
├── schemas/        Zod schemas — one schema, used by both form and server
├── types/          Types local to this feature
└── index.ts        Public exports; nothing outside imports past this file
```

## Rules

1. **Features never import from each other's internals.** Import from
   `@/features/<other>` or `@/features/<other>/server` only, never
   `@/features/<other>/components/...`. If two features need the same thing, it
   belongs in `src/components`, `src/lib` or `src/types`.
2. **Two barrels, never one.** `index.ts` is client-safe; `server.ts` holds
   anything importing `server-only` or a Supabase server client. A Client
   Component importing from `index.ts` must never pull server code into the
   browser bundle.
3. **Routes stay thin.** A file under `src/app` resolves params, checks auth
   and renders a feature component. Business logic lives in the feature.
4. **Validation is shared.** The Zod schema used by React Hook Form is the same
   object the Server Action parses. There is never a second copy.
5. **Server-first.** Reads happen in Server Components. A `'use client'`
   directive needs a reason: interactivity, browser API, or optimistic state.

## Planned features

| Feature         | Milestone | Purpose                                        |
| --------------- | --------- | ---------------------------------------------- |
| `auth`          | 2 ✓       | Sign in, sign up, password reset, verification |
| `profile`       | 2 ✓       | Profile, timezone, locale, preferences         |
| `quran`         | 3 ✓       | Ayah index, mushaf editions, unit conversion   |
| `memorisation`  | 4 ✓       | Recording, tracking grid, mushaf strip         |
| `murajaah`      | 5 ✓       | Review cycle, weak-passage overlay, queue      |
| `dashboard`     | 6 ✓       | Composed from other features; no slice of its own |
| `goals`         | 7 ✓       | Targets, required pace, projected completion   |
| `analytics`     | 8 ✓       | Heatmap, growth and trend charts, page strength |
| `settings`      | 9 ✓       | Profile, language, theme, reminders, data       |
| `offline`       | 10 ✓      | Outbox, connection status, service worker       |
