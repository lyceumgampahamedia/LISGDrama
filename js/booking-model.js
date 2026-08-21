import { ALL_SEATS, MAX_SEATS, SEAT_BY_ID } from "./config.js";

const seatOrder = new Map(ALL_SEATS.map((seat, index) => [seat.id, index]));
export const PAYMENT_METHODS = Object.freeze(["cash", "card", "bank-transfer", "other"]);

function cleanText(value, maximum) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function seatStatus(record, now = Date.now()) {
  if (!record?.status) return "available";
  if (record.status === "booked") return "booked";

  const expiresAt = record.expiresAt?.toMillis?.();
  if (record.status === "reserved" && expiresAt && expiresAt <= now) return "available";
  return "reserved";
}

export function orderedSeatIds(values) {
  const ids = [...new Set([...values].map((value) => String(value).toUpperCase()))];
  return ids.sort((a, b) => (seatOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (seatOrder.get(b) ?? Number.MAX_SAFE_INTEGER));
}

export function validateSeatIds(values) {
  const ids = orderedSeatIds(values);
  if (ids.length < 1 || ids.length > MAX_SEATS) throw new Error(`Choose between 1 and ${MAX_SEATS} seats.`);
  if (ids.some((id) => !SEAT_BY_ID.has(id))) throw new Error("The selection contains an invalid seat.");
  return ids;
}

export function totalForSeats(values) {
  return validateSeatIds(values).reduce((total, id) => total + SEAT_BY_ID.get(id).block.price, 0);
}

export function normalizePhone(value) {
  const phone = String(value ?? "").replace(/[\s()-]/g, "");
  if (/^0\d{9}$/.test(phone)) return `+94${phone.slice(1)}`;
  if (/^\+94\d{9}$/.test(phone)) return phone;
  throw new Error("Enter a valid Sri Lankan contact number.");
}

export function validateWalkInDetails(values) {
  const name = cleanText(values.name, 80);
  if (name.length < 2) throw new Error("Enter a customer name between 2 and 80 characters.");

  const contact = normalizePhone(values.contact);
  const idNumber = cleanText(values.idNumber, 20);
  if (idNumber && !/^[A-Za-z0-9\-/ ]+$/.test(idNumber)) {
    throw new Error("The ID number contains unsupported characters.");
  }

  const paymentMethod = String(values.paymentMethod ?? "cash");
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Choose a valid payment method.");

  const notes = cleanText(values.notes, 300);
  return {
    customer: { name, contact, ...(idNumber ? { idNumber } : {}) },
    paymentMethod,
    ...(notes ? { notes } : {}),
  };
}
