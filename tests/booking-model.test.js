import test from "node:test";
import assert from "node:assert/strict";
import { ALL_SEATS, BLOCKS, SEAT_BY_ID, TIER_TOTALS, TOTAL_SEATS } from "../js/config.js";
import { normalizePhone, orderedSeatIds, seatStatus, totalForSeats, validateWalkInDetails } from "../js/booking-model.js";

test("the original auditorium retains 600 unique seats and 200 seats per tier", () => {
  assert.equal(TOTAL_SEATS, 600);
  assert.equal(new Set(ALL_SEATS.map((seat) => seat.id)).size, 600);
  assert.deepEqual(TIER_TOTALS, { A: 200, B: 200, C: 200 });
  assert.equal(BLOCKS.length, 6);
});

test("legacy seat prefixes and tier prices remain unchanged", () => {
  assert.equal(SEAT_BY_ID.get("LA001").block.price, 2000);
  assert.equal(SEAT_BY_ID.get("RA104").block.price, 2000);
  assert.equal(SEAT_BY_ID.get("LB001").block.price, 1500);
  assert.equal(SEAT_BY_ID.get("RC104").block.price, 1000);
});

test("selected seats are ordered according to the physical seat plan", () => {
  assert.deepEqual(orderedSeatIds(["RA104", "LA001", "LA002", "LA001"]), ["LA002", "LA001", "RA104"]);
});

test("confirmed and active tentative seats are unavailable while expired holds are available", () => {
  const now = Date.now();
  const timestamp = (milliseconds) => ({ toMillis: () => milliseconds });
  assert.equal(seatStatus(undefined, now), "available");
  assert.equal(seatStatus({ status: "booked" }, now), "booked");
  assert.equal(seatStatus({ status: "reserved", expiresAt: timestamp(now + 1000) }, now), "reserved");
  assert.equal(seatStatus({ status: "reserved", expiresAt: timestamp(now - 1000) }, now), "available");
});

test("walk-in validation normalises data and calculates server-matching totals", () => {
  assert.equal(normalizePhone("077 123 4567"), "+94771234567");
  assert.equal(totalForSeats(["LA001", "LB001", "LC001"]), 4500);
  assert.deepEqual(validateWalkInDetails({
    name: "  Test   Customer ",
    contact: "077-123-4567",
    idNumber: "200612345678",
    paymentMethod: "cash",
    notes: " Paid at counter ",
  }), {
    customer: { name: "Test Customer", contact: "+94771234567", idNumber: "200612345678" },
    paymentMethod: "cash",
    notes: "Paid at counter",
  });
});

test("invalid phone numbers and payment methods are rejected", () => {
  assert.throws(() => normalizePhone("1234"), /Sri Lankan/);
  assert.throws(() => validateWalkInDetails({ name: "Test", contact: "0771234567", paymentMethod: "crypto" }), /payment method/);
});
