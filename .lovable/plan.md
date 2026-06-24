# State Persistence Across Navigation

A large but well-scoped change touching shared hooks, the router, the auth flow, and most form/list pages. I'll implement it in five strategies plus shared utilities, exactly as specified.

## 1. Shared utilities (new files)

- `src/hooks/usePersistedForm.ts` — hook with `values`, `updateField`, `setValues`, `clearSaved`, `hasSaved` (so RestoreBanner can decide to show). Storage key prefix `flowcare_form_`.
- `src/hooks/useUrlState.ts` — `useSearchParams`-backed hook, deletes the param when value equals default, `replace: true`.
- `src/hooks/useLastPage.ts` — listens to `useLocation`, writes `flowcare_last_page` to localStorage on every route change (skips public routes).
- `src/hooks/useUnsavedChangesBlocker.tsx` — wraps `useBlocker` and renders the confirmation dialog with three actions: Leave & Save Draft, Stay, Leave & Discard.
- `src/components/RestoreBanner.tsx` — yellow banner with Continue Editing / Start Fresh.
- `src/lib/persistedState.ts` — `clearAllPersistedState()` that removes every `flowcare_*` key, plus a `PUBLIC_ROUTES` constant and `isPublicRoute()` helper.

## 2. Strategy 1 — Form persistence (localStorage)

Wire `usePersistedForm` + `RestoreBanner` into:

| Form | Key | Clear on |
|---|---|---|
| Add Patient (`PatientAddPage` → `LeadForm`) | `add_patient` | save success |
| Edit Patient (`LeadForm` with initial) | `edit_patient_<id>` | save / cancel |
| Add Expense (`ExpenseListPage` add form) | `add_expense` | save |
| Add Todo (`TodoListPage` add form) | `add_todo` | save |
| Book Appointment (`BookAppointmentModal`) | `book_appointment` | save / close |
| Contact Notes textarea (patient profile) | `contact_note_<patient_id>` | save |
| Call Task note textareas | `call_note_<patient_id>` | log call |

`LeadForm` will accept an optional `persistKey` prop so Add vs Edit can opt-in distinctly.

## 3. Strategy 2 — URL state on list pages

Apply `useUrlState` to:

- `/patients` — `status`, `search`, `page`, `per_page` (in `LeadList` inside `Sales.tsx`).
- `/availability` — `doctor`, `view`, `date`.
- `/patients/:id` — `tab`.
- `/tasks/expense-list` — `period`, `from`, `to`.
- `/tasks/todo-list` — `filter`, `priority`.
- `/tasks/call-task` — `section`.

These replace local `useState` for filter/search/page in the affected components, defaulting to the existing initial values so the URL stays clean.

## 4. Strategy 3 — Last active page

- Add `useLastPage()` inside `App.tsx` (under the router) so every navigation persists `pathname + search` unless the path matches a public route (`/login`, `/signup`, `/patient-form`, `/auth`, `/reset-password`, `/forgot-password`, `/accept-invite`, `/invoice/public`, `/prescription`, `/`).
- Add a small `LastPageRedirect` component mounted at `/` (or guarded inside the existing landing/redirect logic) that, once auth is resolved, redirects authenticated users to `flowcare_last_page` when present and non-public, otherwise to `/dashboard`.
- On logout (`useAuth.signOut`), call `clearAllPersistedState()` before clearing the Supabase session so all `flowcare_*` keys (forms, last page, query cache) are wiped.

## 5. Strategy 4 — Unsaved changes warning

`useUnsavedChangesBlocker({ when, onSaveDraft, onDiscard })` renders a shadcn `AlertDialog` with the three buttons. Mounted in:

- Add Patient form
- Edit Patient form
- Book Appointment modal (blocks dialog close as well as route nav)
- Contact Notes editor

`when` is derived from a dirty flag (any field different from initial/default). Save Draft just calls `blocker.proceed()` (data already in localStorage); Discard calls `clearSaved()` then `proceed()`.

## 6. Strategy 5 — React Query persistence

- Add deps `@tanstack/react-query-persist-client` and `@tanstack/query-sync-storage-persister`.
- In `src/main.tsx` (or wherever `QueryClient` is created), wrap with `PersistQueryClientProvider` using a `createSyncStoragePersister` keyed `flowcare_query_cache`, `maxAge: 5 * 60 * 1000`.
- Use a `dehydrateOptions.shouldDehydrateQuery` allow-list so only the named queries are cached: `patients`, `patient`, `appointments`, `invoices`, `call-task-queue`. (Other queries refetch normally.) Confirms existing query keys then adjusts the allow-list.

## 7. Cleanup on logout

`clearAllPersistedState()` runs from `useAuth.signOut`, also called from any explicit logout button paths. The React Query cache entry is included by virtue of the `flowcare_` prefix.

## 8. Technical notes

- `usePersistedForm` stores the full values object under one key per form, JSON-serialized, with try/catch on parse and write.
- `RestoreBanner` only renders when `hasSaved && !deepEqual(saved, defaults)`. Uses a simple JSON-stringify equality check sufficient for flat form objects.
- The blocker only activates on in-app navigations; `beforeunload` is **not** added (spec only asks for the in-app dialog).
- URL params use `replace: true` to avoid polluting browser history while typing in a search field.
- Default values stay constant references via `useMemo` to avoid effect loops.

## 9. Verification checklist

I'll manually trace each of the 10 verification steps after implementation by reading the changed code paths.

## File touch list

New: 4 hooks, 1 component, 1 lib helper.
Edited: `App.tsx`, `main.tsx`, `useAuth.tsx`, `Sales.tsx` (LeadForm + LeadList), `PatientAddPage.tsx`, `PatientDetailPage.tsx`, `BookAppointmentModal.tsx`, `ExpenseListPage.tsx`, `TodoListPage.tsx`, `CallTaskPage.tsx`, `AvailabilityPage.tsx`, plus `package.json` for the two new deps.
