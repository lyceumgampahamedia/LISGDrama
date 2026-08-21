# Verification Results

Verified on 21 August 2026.

## Automated checks

Commands:

```text
node --check js/admin.js
node --check js/booking-model.js
node --check js/firebase.js
node --test tests/admin-only.test.js tests/booking-model.test.js
```

Result: **10 passed, 0 failed**.

The checks cover:

- Root administrator gate and removal of the public reservation flow.
- Direct atomic Firestore transactions with no callable Cloud Function dependency.
- Safe permanent deletion ownership check.
- Protection of PayHere-backed reservations from browser deletion.
- Compatible Firestore rules for the shared online-payment database.
- Apache source-file blocking and no-store headers.
- Original 600 unique seats, six blocks, legacy prefixes and ticket prices.
- Seat ordering and current/expired availability behaviour.
- Sri Lankan phone normalisation, customer validation and booking totals.

## Static-server checks

The following returned HTTP 200 from a local static server:

- `/`
- `/admin.html`
- `/assets/style.css`
- `/assets/admin-only.css`
- `/assets/images/BG.png`
- `/assets/images/Logo.svg`
- `/js/admin.js`
- `/js/booking-model.js`
- `/js/firebase.js`
- `/robots.txt`

## Live Firebase checks still required

Static validation cannot authenticate against the production Firebase project or mutate its live data. Complete the non-admin rejection, admin login, test booking, permanent test deletion, public-payment-site compatibility and App Check checks in `DEPLOYMENT.md` before operational use.
