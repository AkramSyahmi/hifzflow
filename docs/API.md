# API

There is no REST API surface for application data, and that is a decision rather
than an omission.

Reads happen in Server Components, calling typed queries directly. Writes happen
through Server Actions. Neither needs a serialised HTTP contract, and inventing
one would mean maintaining a second authorisation boundary alongside the one
already enforced in the database.

Route handlers exist only where something outside the app has to reach in: OAuth
callbacks, email links, health checks and the scheduled job.

**Authorisation is not documented per endpoint below, because it is not
implemented per endpoint.** Row Level Security scopes every query to the calling
user, so no action takes a user id and none could act on someone else's rows if
it did. Where a database function needs to be called by an unauthenticated user,
that is called out explicitly.

---

## Server Actions

Every action returns `ActionResult<T>`:

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
```

Actions that redirect on success never return — `redirect()` throws internally,
so the calling component should treat a returned value as a failure.

Input is validated by a Zod schema shared with the form that submits it. The
client copy gives instant feedback; the server copy is the one that enforces
anything.

### Auth — `src/features/auth/actions/auth-actions.ts`

| Action | Input | Result | Notes |
| ------ | ----- | ------ | ----- |
| `signInAction(values, next?)` | `signInSchema` | Redirects to `next` or `/dashboard` | Rate limited. `next` must be a same-origin path. |
| `signUpAction(values)` | `signUpSchema` | `void` | Rate limited. Same response whether or not the address is registered. |
| `signOutAction()` | — | Redirects to `/sign-in` | |
| `signInWithGoogleAction(next?)` | — | Redirects to Google | |
| `requestPasswordResetAction(values)` | `forgotPasswordSchema` | `void` | Rate limited hardest of the four. Always reports success. |
| `updatePasswordAction(values)` | `resetPasswordSchema` | Redirects to `/dashboard?password=updated` | Requires the recovery session. |

Three of these deliberately reveal nothing about whether an account exists.
Sign-in reports one message for an unknown address and a wrong password;
sign-up and password reset report success either way. Differing responses would
turn each form into an account-enumeration oracle.

### Memorisation — `src/features/memorisation/actions/memorisation-actions.ts`

| Action | Input | Result |
| ------ | ----- | ------ |
| `recordPagesAction(values)` | `recordPagesSchema` | `{ segmentsCreated, ayahsAdded }` |
| `recordAyahsAction(values)` | `recordAyahsSchema` | `{ segmentsCreated, ayahsAdded }` |
| `recordSurahAction(values)` | `recordSurahSchema` | `{ segmentsCreated, ayahsAdded }` |
| `removePagesAction(values)` | `removePagesSchema` | `{ ayahsRemoved }` |
| `removeSurahAction(surahNumber)` | `number` | `{ ayahsRemoved }` |
| `togglePageAction(values)` | `togglePageSchema` | `{ memorised }` |

`segmentsCreated` is `0` when the range was already fully recorded. That is a
success, not a no-op to report as failure — recording something twice is a
reasonable thing for a person to do.

All of these are **idempotent**, because the underlying database functions fill
gaps rather than inserting blindly. That is what makes the offline outbox safe to
replay.

### Murajaah — `src/features/murajaah/actions/murajaah-actions.ts`

| Action | Input | Result |
| ------ | ----- | ------ |
| `completeItemAction(values)` | `completeItemSchema` | `{ itemId }` |
| `savePlanAction(values)` | `planSchema` | `{ created }` |
| `regenerateTodayAction()` | — | `void` |

`completeItemAction` is idempotent: completing an already-completed item returns
its existing session rather than logging a second one.

`savePlanAction` cannot set `manzil_cursor`. The cursor belongs to the rotation,
and letting a settings form reset it would silently replay pages the user has
already worked through.

`regenerateTodayAction` deletes today's queue so it rebuilds on next load. Needed
after a plan change, because the day's queue was generated against the old
budget. Completed items are unaffected — deleting a queue does not delete the
review sessions it produced.

### Goals — `src/features/goals/actions/goal-actions.ts`

| Action | Input | Result |
| ------ | ----- | ------ |
| `createGoalAction(values)` | `createGoalSchema` | `{ goalId }` |
| `updateGoalAction(values)` | `updateGoalSchema` | `void` |
| `setGoalStatusAction(values)` | `goalStatusSchema` | `void` |
| `deleteGoalAction(goalId)` | `string` | `void` |

`createGoalAction` resolves the scope through `goal_scope_range()` and captures
the baseline — how much of the scope is already memorised — at creation. The
baseline is then frozen; `baseline_ayahs` is not a writable column.

### Settings — `src/features/settings/actions/settings-actions.ts`

| Action | Input | Result |
| ------ | ----- | ------ |
| `updateProfileAction(values)` | `profileSchema` | `void` |
| `updateLocaleAction(values)` | `localeSchema` | `void` |
| `updateRemindersAction(values)` | `remindersSchema` | `void` |
| `exportDataAction()` | — | `{ filename, json }` |
| `deleteAccountAction(values)` | `deleteAccountSchema` | Redirects to `/?deleted=1` |

`updateLocaleAction` writes both a cookie and the profile. The cookie is what the
request config reads before any database round trip, so the change applies on the
next render; the profile is what makes a different device pick up the right
language on first load.

`deleteAccountAction` requires the exact phrase `delete my account`. It is
permanent and immediate.

---

## Database functions

Called via `supabase.rpc()`. All are `SECURITY INVOKER` — running as the calling
user so RLS still applies — **except** the three noted at the end.

Multi-statement writes live here rather than in application code because they
have to be atomic. Filling gaps and splitting segments across several round trips
leaves a window in which a row has been deleted but its remainder is not yet
written.

### Memorisation

| Function | Arguments | Returns |
| -------- | --------- | ------- |
| `record_memorisation` | `first_ayah, last_ayah, status?, confidence?, memorised_on?, notes?` | Created segments |
| `remove_memorisation` | `first_ayah, last_ayah` | Ayahs removed |
| `record_pages` | `edition_id, first_page, last_page, …` | Created segments |
| `remove_pages` | `edition_id, first_page, last_page` | Ayahs removed |
| `record_surah` | `surah_number, …` | Created segments |
| `remove_surah` | `surah_number` | Ayahs removed |
| `page_status` | `edition_id` | All 604 pages with memorised counts |
| `ayah_range` | `first_ayah, last_ayah` | `int4range`, inclusive |
| `ayah_range_length` | `int4range` | Ayah count |

`record_memorisation` subtracts existing coverage from the requested range using
`range_agg` and inserts only what is left. `remove_memorisation` soft-deletes
overlapping segments and reinserts their surviving portions, carrying notes,
confidence and date to both halves of a split.

### Murajaah

| Function | Arguments | Returns |
| -------- | --------- | ------- |
| `ensure_review_queue` | `date?` | Queue id, or null with no plan |
| `complete_queue_item` | `item_id, confidence, notes?, duration_seconds?` | Session id |
| `effective_daily_pages` | `plan_id` | Pages per day |

`ensure_review_queue` is idempotent — calling it on every page load returns the
existing queue rather than rebuilding it, which is what keeps the day's plan
stable while it is being worked through.

`complete_queue_item` logs the session, marks the item complete and advances the
rotation cursor in one transaction. It refuses items belonging to another user
explicitly, rather than relying only on the policy.

### Goals, analytics and activity

| Function | Arguments | Returns |
| -------- | --------- | ------- |
| `goal_scope_range` | `scope_type, scope_from, scope_to?, edition_id?` | `int4range` |
| `activity_calendar` | `from, to` | One row per day, empty days included |
| `review_trend` | `from, to` | Weekly volume by tier plus mean confidence |
| `memorisation_growth` | `from, to` | Cumulative ayahs per day |

### Account

| Function | Arguments | Returns |
| -------- | --------- | ------- |
| `export_my_data` | — | JSON of everything held about the caller |
| `delete_my_account` | — | `void` |

### The three exceptions

| Function | Why it is `SECURITY DEFINER` | What makes it safe |
| -------- | ---------------------------- | ------------------ |
| `handle_new_user` | Trigger; the auth service has no privileges in `public` | Trigger-only, `search_path` pinned |
| `delete_my_account` | The `auth` schema is not writable by application roles | **Takes no arguments** and deletes exactly `auth.uid()`; a test asserts no overload exists |
| `consume_rate_limit` | Must be callable before a session exists | Returns only a boolean, never the counter, so a limit cannot be probed |

`prune_rate_limits` is also `SECURITY DEFINER` but is granted to `service_role`
only. A test asserts that **no** definer function is executable by `PUBLIC`
other than the two intended ones — PostgreSQL grants that by default, and doing
so silently.

---

## Route handlers

| Route | Method | Auth | Purpose |
| ----- | ------ | ---- | ------- |
| `/api/health` | GET | None | Liveness. Dependency-free by design, so it stays green when a downstream service is not. |
| `/api/cron/keepalive` | GET | `Bearer CRON_SECRET` | Scheduled: keeps the Supabase project awake, prunes stale rate limits. |
| `/auth/callback` | GET | Single-use code | OAuth exchange. `next` restricted to same-origin paths. |
| `/auth/confirm` | GET | Single-use token | Email verification, recovery, email change. |

`/api/health` deliberately touches nothing. Its value is telling you the app is
serving requests, which is a different question from whether the database is
reachable, and conflating them makes both answers less useful.

The two `/auth/*` routes are excluded from service worker caching. A cached
callback would replay a consumed one-time code.

---

## Rate limiting

Applied to every action reachable without a session, against **both** the
submitted identifier and the caller's IP address.

| Scope | Attempts | Window |
| ----- | -------- | ------ |
| `sign_in` | 10 | 5 minutes |
| `sign_up` | 5 | 1 hour |
| `password_reset` | 3 | 1 hour |
| `password_update` | 5 | 15 minutes |

The limits are not uniform, on purpose. Sign-in is the loosest because people
genuinely mistype passwords, and locking them out is both a support burden and a
denial of service handed to an attacker. Password reset is the tightest because
each attempt sends mail to a third party, so abuse there is abuse of someone
else's inbox.

Two limits rather than one, because either alone is trivially defeated: by
identifier only lets a botnet grind one account, by address only lets an attacker
spray one attempt each at thousands of addresses.

The bucket key is a salted SHA-256 computed in the application, so the counter
table never holds an email or an IP — it is one of very few tables the anonymous
role can reach at all.

The limiter **fails open**. If it errors, the request proceeds: a database hiccup
that locked everyone out of sign-in would be worse than a brief window with no
application-level limiting, and Supabase Auth applies its own limits underneath,
so the floor is never zero.
