import { SEAT_BY_ID, SHOWS, TIER_IDS, TIER_TOTALS, TOTAL_SEATS } from "./config.js";

export function summarizeConfirmedSales(records) {
  const soldByTier = Object.fromEntries(TIER_IDS.map((tier) => [tier, 0]));
  let sold = 0;

  records.forEach((record, seatId) => {
    if (record?.status !== "booked") return;
    const tier = SEAT_BY_ID.get(seatId)?.block.tier;
    if (!tier || soldByTier[tier] === undefined) return;
    soldByTier[tier] += 1;
    sold += 1;
  });

  return { sold, soldByTier };
}

export function renderSalesSummary(root, recordsByShow, loadedByShow) {
  if (!root) return;

  let totalSold = 0;
  let allShowsLoaded = true;

  Object.keys(SHOWS).forEach((showId) => {
    const loaded = loadedByShow[showId] === true;
    const summary = summarizeConfirmedSales(recordsByShow[showId] || new Map());
    allShowsLoaded &&= loaded;
    if (loaded) totalSold += summary.sold;

    TIER_IDS.forEach((tier) => {
      const value = root.querySelector(`[data-sales-show="${showId}"][data-sales-tier="${tier}"]`);
      if (value) value.textContent = `${loaded ? summary.soldByTier[tier] : "—"} / ${TIER_TOTALS[tier]}`;
    });
  });

  const total = root.querySelector("[data-sales-total]");
  if (total) total.textContent = `${allShowsLoaded ? totalSold : "—"} / ${TOTAL_SEATS * Object.keys(SHOWS).length}`;
}
