import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import {
  ALL_SEATS,
  BLOCKS,
  MAX_SEATS,
  SEAT_BY_ID,
  SHOWS,
  TOTAL_SEATS,
  formatLkr,
  seatsForBlock,
} from "./config.js";
import {
  orderedSeatIds,
  seatStatus,
  totalForSeats,
  validateSeatIds,
  validateWalkInDetails,
} from "./booking-model.js";
import { renderSalesSummary } from "./sales-summary.js";

const $ = (selector) => document.querySelector(selector);
const state = {
  user: null,
  showId: "show1",
  records: new Map(),
  selected: new Set(),
  reservations: [],
  now: Date.now(),
  seatUnsubscribe: null,
  reservationUnsubscribe: null,
  salesRecords: Object.fromEntries(Object.keys(SHOWS).map((showId) => [showId, new Map()])),
  salesLoaded: Object.fromEntries(Object.keys(SHOWS).map((showId) => [showId, false])),
  salesUnsubscribes: [],
  busyReservationId: "",
};

function showView(name) {
  ["loading", "login", "dashboard"].forEach((view) => {
    $(`#${view}-view`).hidden = view !== name;
  });
}

function setError(selector, message = "") {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
}

function showToast(message) {
  const toast = $("#admin-toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 4200);
}

function updateConnection(status, message) {
  const element = $("#connection-status");
  element.className = `connection-pill ${status}`;
  element.querySelector("span").textContent = message;
}

function stopListeners() {
  state.seatUnsubscribe?.();
  state.reservationUnsubscribe?.();
  state.salesUnsubscribes.forEach((unsubscribe) => unsubscribe());
  state.seatUnsubscribe = null;
  state.reservationUnsubscribe = null;
  state.salesUnsubscribes = [];
  state.records = new Map();
  state.reservations = [];
  state.selected.clear();
}

async function hasAdminAccess(user) {
  const token = await user.getIdTokenResult(true);
  if (token.claims.admin === true) return true;

  const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
  return adminSnapshot.exists() && adminSnapshot.data()?.active === true;
}

function listenForSeats() {
  state.seatUnsubscribe?.();
  updateConnection("loading", "Loading live seat availability…");
  state.seatUnsubscribe = onSnapshot(
    collection(db, "shows", state.showId, "seats"),
    (snapshot) => {
      state.records = new Map(snapshot.docs.map((seat) => [seat.id, seat.data()]));
      state.selected = new Set(
        [...state.selected].filter((seatId) => seatStatus(state.records.get(seatId), state.now) === "available"),
      );
      updateConnection("live", "Live Firestore connection");
      renderMap();
      renderSelection();
      updateAvailability();
    },
    (error) => {
      console.error("Seat listener error:", error);
      updateConnection("error", "Seat availability could not be loaded");
      setError("#booking-error", "Firestore rejected the seat request. Check App Check and administrator permissions.");
    },
  );
}

function listenForSalesSummary() {
  state.salesUnsubscribes.forEach((unsubscribe) => unsubscribe());
  state.salesUnsubscribes = Object.keys(SHOWS).map((showId) => onSnapshot(
    collection(db, "shows", showId, "seats"),
    (snapshot) => {
      state.salesRecords[showId] = new Map(snapshot.docs.map((seat) => [seat.id, seat.data()]));
      state.salesLoaded[showId] = true;
      renderSalesSummary($("#ticket-sales-summary"), state.salesRecords, state.salesLoaded);
    },
    (error) => {
      console.error("Sales summary error:", error);
      state.salesLoaded[showId] = false;
      renderSalesSummary($("#ticket-sales-summary"), state.salesRecords, state.salesLoaded);
    },
  ));
}

function listenForReservations() {
  state.reservationUnsubscribe?.();
  state.reservationUnsubscribe = onSnapshot(
    query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(1000)),
    (snapshot) => {
      state.reservations = snapshot.docs
        .map((reservation) => ({ id: reservation.id, ...reservation.data() }))
        .filter((reservation) => Array.isArray(reservation.seatIds));
      setError("#admin-error");
      renderReservations();
    },
    (error) => {
      console.error("Reservation listener error:", error);
      setError("#admin-error", "Reservation records could not be loaded. Check Firestore rules and administrator access.");
    },
  );
}

function updateAvailability() {
  const unavailable = [...state.records.values()].filter((record) => seatStatus(record, state.now) !== "available").length;
  $("#available-count").textContent = String(TOTAL_SEATS - unavailable);
}

function makeSeatButton(seat) {
  const status = state.selected.has(seat.id) ? "selected" : seatStatus(state.records.get(seat.id), state.now);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `seat tier-${seat.block.tier.toLowerCase()} ${status}`;
  button.textContent = seat.id.slice(2);
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-selected", String(status === "selected"));
  button.setAttribute("aria-label", `Seat ${seat.id}, row ${seat.row}, ${formatLkr(seat.block.price)}, ${status}`);
  button.title = `${seat.id} — ${status}`;
  button.disabled = status === "reserved" || status === "booked";
  button.addEventListener("click", () => toggleSeat(seat.id));
  return button;
}

function makeBlock(block) {
  const section = document.createElement("section");
  section.className = `seat-block tier-${block.tier.toLowerCase()}`;
  section.setAttribute("aria-label", `Block ${block.tier}, ${block.side} wing`);

  const heading = document.createElement("header");
  heading.className = "block-heading";
  const title = document.createElement("div");
  const side = document.createElement("span");
  side.className = "block-eyebrow";
  side.textContent = `${block.side} wing`;
  const name = document.createElement("h3");
  name.textContent = `Block ${block.tier}`;
  const price = document.createElement("strong");
  price.textContent = formatLkr(block.price);
  title.append(side, name);
  heading.append(title, price);
  section.append(heading);

  const rows = document.createElement("div");
  rows.className = "seat-rows";
  rows.setAttribute("role", "grid");
  const seats = seatsForBlock(block);
  for (let index = 0; index < seats.length; index += block.columns) {
    const rowSeats = seats.slice(index, index + block.columns);
    const row = document.createElement("div");
    row.className = "seat-row";
    row.style.setProperty("--columns", block.columns);
    row.setAttribute("role", "row");
    const label = document.createElement("span");
    label.className = "row-label";
    label.setAttribute("role", "rowheader");
    label.textContent = rowSeats[0].row;
    row.append(label, ...rowSeats.map(makeSeatButton));
    rows.append(row);
  }
  section.append(rows);
  return section;
}

function renderMap() {
  const map = $("#seat-map");
  map.replaceChildren();
  ["left", "right"].forEach((side) => {
    const wing = document.createElement("div");
    wing.className = `wing wing-${side}`;
    BLOCKS.filter((block) => block.side === side).forEach((block) => wing.append(makeBlock(block)));
    map.append(wing);
  });
}

function toggleSeat(seatId) {
  if (state.selected.has(seatId)) {
    state.selected.delete(seatId);
  } else if (state.selected.size >= MAX_SEATS) {
    showToast(`A single booking can contain up to ${MAX_SEATS} seats.`);
  } else if (seatStatus(state.records.get(seatId), state.now) === "available") {
    state.selected.add(seatId);
  }
  renderMap();
  renderSelection();
}

function selectedIds() {
  return orderedSeatIds(state.selected);
}

function clearSelection() {
  state.selected.clear();
  renderMap();
  renderSelection();
}

function renderSelection() {
  const content = $("#selection-content");
  const button = $("#confirm-booking");
  content.replaceChildren();
  const ids = selectedIds();

  if (!ids.length) {
    const empty = document.createElement("div");
    empty.className = "empty-selection";
    const icon = document.createElement("span");
    icon.textContent = "+";
    icon.setAttribute("aria-hidden", "true");
    const message = document.createElement("p");
    message.textContent = "Select available seats from the map.";
    const hint = document.createElement("small");
    hint.textContent = `Maximum ${MAX_SEATS} seats per booking.`;
    empty.append(icon, message, hint);
    content.append(empty);
    button.disabled = true;
    button.textContent = "Select seats to continue";
    return;
  }

  const chips = document.createElement("div");
  chips.className = "seat-chips";
  ids.forEach((id) => {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = `${id} ×`;
    remove.setAttribute("aria-label", `Remove seat ${id}`);
    remove.addEventListener("click", () => toggleSeat(id));
    chips.append(remove);
  });

  const count = document.createElement("p");
  count.className = "selection-count";
  count.textContent = `${ids.length} seat${ids.length === 1 ? "" : "s"} selected`;
  const total = document.createElement("div");
  total.className = "total-row";
  const label = document.createElement("span");
  label.textContent = "Booking total";
  const value = document.createElement("strong");
  value.textContent = formatLkr(totalForSeats(ids));
  total.append(label, value);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "text-button";
  clear.textContent = "Clear selected seats";
  clear.addEventListener("click", clearSelection);
  content.append(chips, count, total, clear);
  button.disabled = false;
  button.textContent = `Confirm ${ids.length} seat${ids.length === 1 ? "" : "s"}`;
}

async function createWalkInBooking(event) {
  event.preventDefault();
  setError("#booking-error");

  let seatIds;
  let details;
  try {
    seatIds = validateSeatIds(selectedIds());
    const formData = new FormData(event.currentTarget);
    details = validateWalkInDetails(Object.fromEntries(formData.entries()));
  } catch (error) {
    setError("#booking-error", error.message);
    return;
  }

  const button = $("#confirm-booking");
  button.disabled = true;
  button.textContent = "Checking and confirming…";

  const reservationRef = doc(collection(db, "reservations"));
  const auditRef = doc(collection(db, "auditLogs"));
  const reference = `GK-${reservationRef.id.slice(0, 8).toUpperCase()}`;
  const total = totalForSeats(seatIds);

  try {
    await runTransaction(db, async (transaction) => {
      const seatRefs = seatIds.map((seatId) => doc(db, "shows", state.showId, "seats", seatId));
      const seatSnapshots = await Promise.all(seatRefs.map((seatRef) => transaction.get(seatRef)));
      if (seatSnapshots.some((snapshot) => snapshot.exists() && seatStatus(snapshot.data(), Date.now()) !== "available")) {
        throw new Error("seat-unavailable");
      }

      transaction.set(reservationRef, {
        reference,
        showId: state.showId,
        seatIds,
        total,
        currency: "LKR",
        status: "booked",
        source: "walk-in-admin",
        customer: details.customer,
        payment: { method: details.paymentMethod, status: "paid-at-counter" },
        ...(details.notes ? { staffNotes: details.notes } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
        confirmedBy: state.user.uid,
        confirmedByEmail: state.user.email || "",
      });

      seatRefs.forEach((seatRef) => transaction.set(seatRef, {
        status: "booked",
        reservationId: reservationRef.id,
        updatedAt: serverTimestamp(),
      }));

      transaction.set(auditRef, {
        action: "walk-in-booking-created",
        reservationId: reservationRef.id,
        reference,
        showId: state.showId,
        seatIds,
        actorUid: state.user.uid,
        actorEmail: state.user.email || "",
        createdAt: serverTimestamp(),
      });
    });

    event.currentTarget.reset();
    clearSelection();
    $("#success-reference").textContent = reference;
    renderSuccessDetails([["Show", SHOWS[state.showId].time], ["Seats", seatIds.join(", ")], ["Total", formatLkr(total)], ["Payment", paymentLabel(details.paymentMethod)]]);
    $("#success-dialog").showModal();
  } catch (error) {
    console.error("Walk-in booking error:", error);
    setError(
      "#booking-error",
      error.message === "seat-unavailable"
        ? "One or more selected seats were just taken. Live availability has been refreshed."
        : "The booking could not be saved. Check Firestore access and try again.",
    );
  } finally {
    renderSelection();
  }
}

function renderSuccessDetails(items) {
  const list = $("#success-details");
  list.replaceChildren();
  items.forEach(([term, description]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    row.append(dt, dd);
    list.append(row);
  });
}

function timestampText(value) {
  return value?.toDate?.().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }) || "—";
}

function effectiveReservationStatus(reservation) {
  const expiresAt = reservation.expiresAt?.toMillis?.();
  if (reservation.status === "reserved" && expiresAt && expiresAt <= state.now) return "expired";
  return reservation.status || "unknown";
}

function paymentLabel(value) {
  return { cash: "Cash", card: "Card", "bank-transfer": "Bank transfer", other: "Other" }[value] || "Not recorded";
}

function isPaymentBacked(reservation) {
  return reservation.paymentGateway === "payhere" || Boolean(reservation.paymentSessionId);
}

function reservationPaymentLabel(reservation) {
  return isPaymentBacked(reservation) ? "PayHere" : paymentLabel(reservation.payment?.method);
}

function reservationTotal(reservation) {
  if (Number.isFinite(reservation.total)) return reservation.total;
  const validIds = (reservation.seatIds || []).filter((seatId) => SEAT_BY_ID.has(seatId));
  return validIds.reduce((total, seatId) => total + SEAT_BY_ID.get(seatId).block.price, 0);
}

function maskId(value = "") {
  return value ? `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : "";
}

function visibleReservations() {
  const search = $("#admin-search").value.trim().toLowerCase();
  const filter = $("#status-filter").value;
  return state.reservations.filter((reservation) => {
    const status = effectiveReservationStatus(reservation);
    const haystack = [reservation.reference, reservation.customer?.name, reservation.customer?.contact, ...(reservation.seatIds || [])].join(" ").toLowerCase();
    return (filter === "all" || status === filter) && (!search || haystack.includes(search));
  });
}

function appendTextCell(row, lines) {
  const cell = document.createElement("td");
  lines.filter(Boolean).forEach((line, index) => {
    const element = document.createElement(index === 0 ? "strong" : "small");
    element.textContent = line;
    cell.append(element);
  });
  row.append(cell);
}

function renderReservations() {
  const booked = state.reservations.filter((reservation) => effectiveReservationStatus(reservation) === "booked").length;
  $("#count-booked").textContent = String(booked);
  $("#count-other").textContent = String(state.reservations.length - booked);
  $("#count-total").textContent = String(state.reservations.length);

  const body = $("#reservation-rows");
  body.replaceChildren();
  const reservations = visibleReservations();
  if (!reservations.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-table";
    cell.textContent = "No matching reservation records.";
    row.append(cell);
    body.append(row);
    return;
  }

  reservations.forEach((reservation) => {
    const row = document.createElement("tr");
    appendTextCell(row, [reservation.reference || reservation.id, reservation.source === "walk-in-admin" ? "Walk-in" : "Existing record"]);

    const customer = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = reservation.customer?.name || "—";
    const phone = document.createElement("a");
    phone.href = `tel:${reservation.customer?.contact || ""}`;
    phone.textContent = reservation.customer?.contact || "—";
    customer.append(name, phone);
    const masked = maskId(reservation.customer?.idNumber);
    if (masked) {
      const id = document.createElement("small");
      id.textContent = `ID ${masked}`;
      customer.append(id);
    }
    row.append(customer);

    appendTextCell(row, [SHOWS[reservation.showId]?.time || reservation.showId || "—", (reservation.seatIds || []).join(", ")]);
    appendTextCell(row, [reservationPaymentLabel(reservation)]);

    const statusCell = document.createElement("td");
    const status = effectiveReservationStatus(reservation);
    const badge = document.createElement("span");
    badge.className = `status-badge ${status}`;
    badge.textContent = status === "booked" ? "Confirmed" : status;
    statusCell.append(badge);
    row.append(statusCell);

    const total = document.createElement("td");
    total.textContent = formatLkr(reservationTotal(reservation));
    row.append(total);
    appendTextCell(row, [timestampText(reservation.createdAt)]);

    const actions = document.createElement("td");
    actions.className = "table-actions";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-action";
    const protectedPayment = isPaymentBacked(reservation);
    remove.textContent = protectedPayment ? "Payment record protected" : state.busyReservationId === reservation.id ? "Deleting…" : "Delete permanently";
    remove.disabled = protectedPayment || Boolean(state.busyReservationId);
    if (protectedPayment) remove.title = "PayHere-backed records must be handled through the payment and refund process.";
    remove.addEventListener("click", () => deleteReservation(reservation));
    actions.append(remove);
    row.append(actions);
    body.append(row);
  });
}

async function deleteReservation(reservation) {
  if (isPaymentBacked(reservation)) {
    setError("#admin-error", "PayHere-backed reservations are protected from deletion because removing one would orphan payment records.");
    return;
  }
  const reference = reservation.reference || reservation.id;
  const seats = (reservation.seatIds || []).join(", ") || "no recorded seats";
  const confirmed = window.confirm(
    `Permanently delete ${reference}?\n\nRecorded seats: ${seats}\n\nAny seats still owned by this record will become available. This action cannot be undone.`,
  );
  if (!confirmed) return;

  state.busyReservationId = reservation.id;
  setError("#admin-error");
  renderReservations();

  try {
    const reservationRef = doc(db, "reservations", reservation.id);
    const auditRef = doc(collection(db, "auditLogs"));
    await runTransaction(db, async (transaction) => {
      const reservationSnapshot = await transaction.get(reservationRef);
      if (!reservationSnapshot.exists()) throw new Error("record-missing");
      const data = reservationSnapshot.data();
      const showId = data.showId;
      const seatIds = Array.isArray(data.seatIds) ? data.seatIds : [];
      const seatRefs = showId ? seatIds.map((seatId) => doc(db, "shows", showId, "seats", seatId)) : [];
      const seatSnapshots = await Promise.all(seatRefs.map((seatRef) => transaction.get(seatRef)));

      seatSnapshots.forEach((seatSnapshot, index) => {
        if (seatSnapshot.exists() && seatSnapshot.data()?.reservationId === reservation.id) {
          transaction.delete(seatRefs[index]);
        }
      });
      transaction.delete(reservationRef);
      transaction.set(auditRef, {
        action: "reservation-permanently-deleted",
        deletedReservationId: reservation.id,
        reference: data.reference || reservation.id,
        showId: showId || "",
        seatIds,
        actorUid: state.user.uid,
        actorEmail: state.user.email || "",
        createdAt: serverTimestamp(),
      });
    });
    showToast(`${reference} was permanently deleted and its owned seats were released.`);
  } catch (error) {
    console.error("Permanent deletion error:", error);
    setError("#admin-error", error.message === "record-missing" ? "That record was already deleted." : "The record could not be deleted. Check Firestore permissions and try again.");
  } finally {
    state.busyReservationId = "";
    renderReservations();
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headings = ["Reference", "Show", "Seats", "Name", "Contact", "ID", "Payment", "Status", "Total", "Created"];
  const rows = visibleReservations().map((reservation) => [
    reservation.reference || reservation.id,
    SHOWS[reservation.showId]?.time || reservation.showId,
    (reservation.seatIds || []).join(" "),
    reservation.customer?.name,
    reservation.customer?.contact,
    reservation.customer?.idNumber || "",
    reservationPaymentLabel(reservation),
    effectiveReservationStatus(reservation),
    reservationTotal(reservation),
    reservation.createdAt?.toDate?.().toISOString() || "",
  ]);
  const csv = `\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `katanayaka-walk-in-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("#login-error");
  const button = $("#login-button");
  const data = new FormData(event.currentTarget);
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password")));
    event.currentTarget.reset();
  } catch (error) {
    console.error("Sign-in error:", error);
    setError("#login-error", "Sign-in failed. Check the email, password and Firebase Authentication settings.");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in securely";
  }
});

$("#sign-out").addEventListener("click", () => signOut(auth));
$("#walk-in-form").addEventListener("submit", createWalkInBooking);
$("#admin-search").addEventListener("input", renderReservations);
$("#status-filter").addEventListener("change", renderReservations);
$("#export-csv").addEventListener("click", exportCsv);
$("#copy-reference").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#success-reference").textContent);
  showToast("Reference copied.");
});

document.querySelectorAll("[data-show]").forEach((button) => button.addEventListener("click", () => {
  state.showId = button.dataset.show;
  state.selected.clear();
  $("#dashboard-view").className = `site-shell admin-desk-shell ${state.showId === "show1" ? "show-one" : "show-two"}`;
  document.querySelectorAll("[data-show]").forEach((option) => option.setAttribute("aria-checked", String(option === button)));
  listenForSeats();
  renderSelection();
}));

document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
  document.getElementById(button.dataset.close).close();
}));

document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

onAuthStateChanged(auth, async (user) => {
  stopListeners();
  if (!user) {
    state.user = null;
    showView("login");
    return;
  }

  showView("loading");
  try {
    if (!(await hasAdminAccess(user))) {
      await signOut(auth);
      showView("login");
      setError("#login-error", "This account is signed in but is not authorised as an administrator.");
      return;
    }

    state.user = user;
    $("#admin-email").textContent = user.email || user.uid;
    showView("dashboard");
    renderMap();
    renderSelection();
    listenForSeats();
    listenForSalesSummary();
    listenForReservations();
  } catch (error) {
    console.error("Administrator verification error:", error);
    await signOut(auth);
    showView("login");
    setError("#login-error", "Administrator verification failed. Check App Check, Firestore rules and the admins collection.");
  }
});

setInterval(() => {
  state.now = Date.now();
  if (!$("#dashboard-view").hidden) {
    renderMap();
    renderSelection();
    updateAvailability();
    renderReservations();
  }
}, 30_000);
