# Garu Katanayaka — Admin-Only Walk-in Booking Desk

This is the plain HTML/CSS/JavaScript version of the original 600-seat project, rebuilt as a dedicated staff tool. Opening the root URL first verifies Firebase administrator access. Only then does the browser load the seat map, customer records and booking controls.

## What this version does

- No public reservation page, tentative-booking form, PayHere checkout or customer login.
- Root `index.html` is the administrator login and dashboard.
- Existing media filenames and Zeus Hall seat layout are preserved.
- Live availability for both shows and Block A/B/C sales totals.
- Select up to eight available seats visually.
- Enter customer details and confirm a walk-in booking immediately.
- Atomic Firestore transactions prevent double booking.
- Search, filter and export reservation records.
- Permanently delete walk-in or legacy reservations and release only seats still owned by them.
- Protect PayHere-backed reservations from browser deletion so payment records cannot be orphaned.
- Minimal immutable audit records for booking creation and permanent deletion.
- No Cloud Functions are required by this admin portal.
- No Vite, React, build process, SQL, PHP framework or Composer dependency.

## Important coexistence with the online-payment site

This project is compatible with the existing `katanayaka-booking-v2` Firebase project and its payment system. The supplied Firestore rules retain anonymous **read-only** access to seat-state documents because the separate public ticketing website needs them to display availability. Customer, payment and audit documents remain private.

Firebase Cloud Functions use the Admin SDK and continue working even though browser writes are restricted. Do not replace the supplied rules with rules that deny public seat reads while the customer ticketing site is operating, or its availability display will stop working.

## Main files

| File | Purpose |
| --- | --- |
| `index.html` | Login, seat map, walk-in form and record manager |
| `js/admin.js` | Authentication, live listeners, transactions and deletion |
| `js/booking-model.js` | Input validation, phone normalisation and seat calculations |
| `js/config.js` | Firebase public config, shows, prices and all 600 seats |
| `firestore.rules` | Public seat reads plus administrator-only private access/writes |
| `DEPLOYMENT.md` | Complete local, Firebase and cPanel instructions |
| `SECURITY.md` | Access model and operational safeguards |
| `deployment/admin-only-cpanel-upload.zip` | Ready-to-extract static website files |

## Administrator authorisation

The portal accepts either of these secure Firebase authorisation methods:

1. An existing Firebase Auth custom claim `admin: true`; or
2. An active Firestore document at `admins/{Firebase Auth UID}`.

The second method requires no Cloud Function. See `DEPLOYMENT.md` for the exact console steps.

## Permanent deletion behaviour

The **Delete permanently** action for walk-in and legacy records runs one Firestore transaction:

1. Re-reads the reservation.
2. Re-reads every recorded seat.
3. Deletes only seat documents whose `reservationId` still matches that reservation.
4. Deletes the reservation document.
5. Creates a minimal audit entry without copying customer details.

This prevents deletion of an old record from accidentally releasing a seat that has since been assigned to somebody else. PayHere-backed reservations are deliberately protected in the UI because deleting only the reservation would leave payment-session and payment-event evidence inconsistent. The deletion cannot be undone, so take a Firestore backup or export before event operations.

## Quick verification

Run from the project folder:

```bat
npm test
```

The application itself must be opened through a local web server, not by double-clicking `index.html`. Full instructions are in `DEPLOYMENT.md`.
