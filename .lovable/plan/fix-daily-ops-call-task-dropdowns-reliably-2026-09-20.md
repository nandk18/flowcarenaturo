# Fix Daily Ops call-task dropdowns reliably

## Confirmed issue

The two dropdowns do not use one shared result. In `CallTaskPage`, the type dropdown gets `Lead Call (4)` from a direct patient count, while the status dropdown and visible groups get overdue/due counts later from a separately mounted `CallTask`. This allows the exact screenshot state: `All (0)` beside `Lead Call (4)`, followed by a false empty message.

## Changes

1. Load the due lead-call rows once in `CallTaskPage` and derive their overdue and due-today totals there.
2. Use those same rows and totals for:
   - `All`, `Overdue`, and `Due today` status counts;
   - the `Lead Call` type count;
   - the group headers and rendered lead rows.
3. Remove the hidden counts-only `CallTask` workaround and its callback timing dependency.
4. Keep status and type filters combined, so every dropdown count matches the rows currently displayed.
5. Show a loading state until the initial task data is ready, preventing the temporary “tasks are clear” message before counts arrive.
6. Preserve existing call actions, notes, booking, WhatsApp, and done-today classification.

## Verification

- Open Daily Ops directly with `Lead Call` selected and confirm `All (4)` and four visible rows without switching filters first.
- Check `All`, `Overdue`, `Due today`, and `Done today` against every task type.
- Confirm empty messaging appears only when the selected status and type truly have no rows.
- Verify logging a lead call immediately updates its row and both dropdown counts.
- Check desktop and phone layouts, then confirm build and runtime diagnostics are clean.
