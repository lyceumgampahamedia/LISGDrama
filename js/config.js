export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCVAVKlCwpsbeQnvCC3bL6rzbc_Rifnx9w",
  authDomain: "katanayaka-booking-v2.firebaseapp.com",
  projectId: "katanayaka-booking-v2",
  storageBucket: "katanayaka-booking-v2.firebasestorage.app",
  messagingSenderId: "575426124492",
  appId: "1:575426124492:web:20382ef60c51f7f9908069",
  measurementId: "G-B810STEKF3",
};

// Public reCAPTCHA v3 site key. The matching secret stays in Firebase App Check.
export const APP_CHECK_SITE_KEY = "6Lf-2ostAAAAAI_6Ow39PK2R1wWg8lwIDJUAVBOr";
export const MAX_SEATS = 8;

export const SHOWS = {
  show1: { time: "3:30 PM", startsAt: "2026-09-03T15:30:00+05:30" },
  show2: { time: "6:30 PM", startsAt: "2026-09-03T18:30:00+05:30" },
};

export const BLOCKS = [
  { id: "AL", side: "left", tier: "A", prefix: "LA", price: 2000, total: 96, columns: 12, reverse: true },
  { id: "AR", side: "right", tier: "A", prefix: "RA", price: 2000, total: 104, columns: 13, reverse: true },
  { id: "BL", side: "left", tier: "B", prefix: "LB", price: 1500, total: 96, columns: 12, reverse: true },
  { id: "BR", side: "right", tier: "B", prefix: "RB", price: 1500, total: 104, columns: 13, reverse: true },
  { id: "CL", side: "left", tier: "C", prefix: "LC", price: 1000, total: 96, columns: 12, reverse: true },
  { id: "CR", side: "right", tier: "C", prefix: "RC", price: 1000, total: 104, columns: 13, reverse: true },
];

export function seatsForBlock(block) {
  if (block.total % block.columns !== 0) {
    throw new Error(`${block.id}: total must be divisible by columns.`);
  }

  const seats = [];
  for (let rowIndex = 0; rowIndex < block.total / block.columns; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < block.columns; columnIndex += 1) {
      const offset = block.reverse ? block.columns - columnIndex : columnIndex + 1;
      const number = rowIndex * block.columns + offset;
      seats.push({
        id: `${block.prefix}${String(number).padStart(3, "0")}`,
        number,
        row: String.fromCharCode(65 + rowIndex),
        block,
      });
    }
  }
  return seats;
}

export const ALL_SEATS = BLOCKS.flatMap(seatsForBlock);
export const SEAT_BY_ID = new Map(ALL_SEATS.map((seat) => [seat.id, seat]));
export const TOTAL_SEATS = ALL_SEATS.length;
export const TIER_IDS = Object.freeze(["A", "B", "C"]);
export const TIER_TOTALS = Object.freeze(Object.fromEntries(
  TIER_IDS.map((tier) => [
    tier,
    BLOCKS.filter((block) => block.tier === tier).reduce((total, block) => total + block.total, 0),
  ]),
));

export function formatLkr(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
