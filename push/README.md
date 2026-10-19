# SLR device notifications

SLR owns its identity, D1 database, VAPID keys and delivery alarm. No World or Sodium service/database is used. Transport mechanics were adapted from WATA TECH/platform/pwa-notifications on 18 October 2026; encryption stays pinned to `@block65/webcrypto-web-push` 2.0.0.

## Build and test

With Node 24 and pnpm:

```sh
cd push
pnpm install --frozen-lockfile --ignore-scripts --ignore-workspace
pnpm build
pnpm test
```

Build uses esbuild 0.28.1 and emits the Worker to `.wrangler/slr-push/worker.mjs`. The static app has no frontend build step. Deploy only reviewed files over the current production baseline; preserve Notion secrets, existing settings and bindings. Never deploy a minimal example config over the live Worker.

## Boundary

- `POST /notifications/{state,subscribe,unsubscribe,preferences,remove-device,read,read-all,test}` accepts the saved invite code in the JSON body, requires the exact canonical browser Origin and validates active invites freshly. The server constructs the subject from the invite page ID and assigned member name. Reassignment changes the subject. Browser identity headers, recipient, app, message and destination are never trusted.
- `SLR_PUSH_DB` stores device keys/endpoints, canonical generic events, delivery receipts and achievement high-water ranks. It stores no invite codes. Subscription/read/remove/preferences queries always constrain the authenticated subject and fixed SLR app ID.
- Successful Session writes record their returned Notion page ID. The following canonical data read must contain every pending saved ID before achievements are compared. Initial history and catalog-only changes establish a baseline without pushing old badges. Stable badge/rank event IDs deduplicate retries. The same `achievements.js` engine drives the UI and server.
- Notion and D1 are separate services. A Notion commit followed by a D1 outage can save a Session without recording its notification receipt; the Session remains safe but notification delivery is not an atomic cross-service guarantee. Data reads/saves do not fail solely because the optional notification side effect is unavailable. No new general-purpose Notion write retry was introduced.
- The existing free account has five cron triggers already. Cloudflare rejected a sixth with code 10072. `SLR_DELIVERY` is a private SQLite-backed Durable Object alarm instead; no other app schedule was changed. It wakes only for pending delivery, reads at most 25 jobs, respects five-attempt backoff/Retry-After and rechecks active invite assignment before sending. No network redirects are followed. 404/410 removes expired devices. Unexpected provider/auth/storage outages reschedule the alarm; browser requests are not required to keep it alive.
- `SLR_PUSH_DELIVERY_ENABLED=on` enables dispatch. Setting it to `off` halts alarm delivery without deleting device/event data.

## Client and updates

Permission is requested only when the user turns on the On this device switch. iPhone/iPad installation guidance appears where needed. No push permission is requested automatically. Device category preferences, disable/removal, self-test, recent alerts and mark-read are in Lab Settings → Notifications. Generic previews contain no names, strains or scores. Badge counts reconcile from authenticated unread state, and clear at zero where the browser supports badging.

There is one root service worker. It has no fetch handler and caches no HTML, API, credentials, photos or drafts. Notification taps focus an exact existing destination or open a separate window; they never navigate an editor away. App updates have their own settings card. An explicit check reads the current public page once without cache and checks the worker, so page-only releases are detected too. Installing workers are awaited with a bounded timeout. Update app reloads only after the user asks; worker takeover refuses multiple SLR windows, and all reloads check forms/uploads/Lab overlays. Failed or stalled updates show feedback and restore interaction. No local storage is cleared. The new worker does not claim offline-shell support.

Notification state reads coalesce by identity generation and have a 30-second foreground freshness throttle. No hidden/offline polling timer was added. Explicit settings/read/push events bypass the throttle. Foreground reconciliation renews only an already opted-in, still-owned device; removed devices remain disabled until explicitly enabled again.

## Release and phone acceptance

Exact deployment evidence and rollback are in the owning task's `output/slr-push-2026-10-18/` and WATA TECH `output/pwa-suite-rollout-2026-10-17/slr/HANDOFF.md`. Unit tests use synthetic identities; the local workerd test uses an entirely mocked Notion/push provider and local D1/alarm. No synthetic production subscription was created.

On the installed iPhone app, open Lab Settings → Notifications, enable the device, allow the OS prompt, send a test, close SLR and lock the phone. Verify alert display, tap routing, badge count and mark-read clearing. Then test second-device removal, invite revocation, denied permission, offline/reconnect and an update with a draft/second window open. World acceptance does not count as SLR acceptance.

Rollback: set dispatch to `off`, keep the Durable Object class/binding and D1/VAPID secrets, and restore the prior static frontend if needed. Do not simply delete the Durable Object export or apply a whole old catalog. Keep schema/storage and existing user data. Installed service workers persist through their normal lifecycle; do not clear site data.

## Header inbox and full read acknowledgement (v2.6.17)

The 44px header bell opens the existing inbox directly without marking anything read. It reuses authenticated notification state: unread is shown up to 99+ visually, with the exact count in the accessible label. Zero hides the counter. Signed-out clients hide the bell. The inbox works without device push permission/support. No polling timer was added.

State returns a snapshot cursor `readThrough`, alongside total unread and at most 50 event rows, using one D1 transactional batch. Explicit `read-all` updates only this authenticated app/account's unread rows through that cursor, covering every page. Events are append-only; later inserted rows have larger SQLite rowids, so same-timestamp/backdated arrivals during acknowledgement remain unread. Do not introduce event deletion/rowid-rewriting retention without migrating this cursor contract. The legacy per-event read API remains compatible.

After success the client invalidates older unfinished reads and refreshes authoritative state before changing the header/OS badge. Offline/server failures retain counts. A failed follow-up read may leave the old count visible until a successful refresh; it never pretends all alerts were cleared. Account changes reject late responses. The Worker still requires canonical Origin and freshly validated invite identity; no browser subject/app is trusted.
