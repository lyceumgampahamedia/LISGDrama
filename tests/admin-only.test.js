import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("the root page is an admin gate and contains no public reservation flow", async () => {
  const html = await read("index.html");
  assert.match(html, /id="login-view"/);
  assert.match(html, /id="dashboard-view"[^>]*hidden/);
  assert.match(html, /Authorised staff only/);
  assert.match(html, /PayHere-backed records are protected/);
  assert.doesNotMatch(html, /public booking page|Reserve seats for 24 hours|Continue to PayHere|PayHere Live/i);
  assert.match(html, /src="js\/admin\.js"/);
  assert.doesNotMatch(html, /src="js\/app\.js"/);
});

test("the browser uses direct atomic Firestore transactions and no callable Functions", async () => {
  const code = await read("js/admin.js");
  assert.match(code, /runTransaction/);
  assert.match(code, /walk-in-booking-created/);
  assert.match(code, /reservation-permanently-deleted/);
  assert.match(code, /Payment record protected/);
  assert.match(code, /seatSnapshot\.data\(\)\?\.reservationId === reservation\.id/);
  assert.doesNotMatch(code, /httpsCallable|getFunctions|cloudfunctions/);
});

test("Firestore rules preserve public availability while keeping records and writes admin-only", async () => {
  const rules = await read("firestore.rules");
  assert.match(rules, /match \/seats\/\{seatId\}[\s\S]*allow read: if true;[\s\S]*allow create, update, delete: if isAdmin\(\);/);
  assert.match(rules, /match \/reservations\/\{reservationId\}[\s\S]*allow read, create, update, delete: if isAdmin\(\);/);
  assert.match(rules, /match \/admins\/\{uid\}[\s\S]*allow list, create, update, delete: if false;/);
  assert.match(rules, /match \/paymentSessions\/\{id\}[\s\S]*allow write: if false;/);
});

test("Apache configuration blocks source configuration and browser caching", async () => {
  const config = await read(".htaccess");
  assert.match(config, /Options -Indexes/);
  assert.match(config, /Cache-Control "no-store"/);
  assert.match(config, /Require all denied/);
});
