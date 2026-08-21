# Security Model

## What protects the data

- Firebase Email/Password Authentication identifies the staff user.
- Firestore verifies either `admin: true` in the signed Firebase ID token or `admins/{uid}.active == true`.
- Firestore rules deny public access to reservations, payments, mail and audit records.
- Only anonymous seat-state reads remain available for the separate customer booking site.
- Every walk-in booking and permanent deletion uses a Firestore transaction.
- App Check can reject requests that do not originate from an approved site.
- CSP, clickjacking protection, no-referrer and no-store headers are included for Apache/cPanel.

Firebase web configuration values in `js/config.js` are public application identifiers; they are not administrator credentials. Security depends on Authentication, App Check and Firestore rules.

## Administrator responsibility

Direct Firestore write access is intentionally granted to authorised administrators because this version does not use Cloud Functions. An administrator can therefore modify booking data. Restrict admin access to trusted event staff, use individual accounts, remove access promptly and review audit logs.

## Permanent deletion

For walk-in and legacy records, the reservation and owned seat documents are permanently removed. A minimal audit record remains so staff can establish that an authorised deletion occurred. It contains the reference, show, seats, actor and timestamp but does not copy customer name, contact or ID. PayHere-backed reservations are protected from this browser action to avoid orphaning payment evidence.

## Recommended operations

- Use HTTPS only in production.
- Do not share administrator passwords.
- Keep App Check enforcement enabled after the correct domain is registered.
- Take a verified backup before the event and before bulk record changes.
- Keep Firebase Console access limited and protected with multi-factor authentication.
- Never place service-account files, passwords or App Check secrets in this folder.
- Remove unused admin documents or set `active` to `false` after the event.
