"use strict";

// Datos inventados exclusivamente para evaluar la interfaz. No hay servicios ni persistencia.
const referenceDay = Date.parse("2026-10-17T12:00:00Z");
const baselineMedicines = [
  { id: "clonazepam", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "tabletas", code: "DEMO-001", minimum: 100, lots: [{ code: "DEMO-CZ-01", quantity: 250, expires: "2028-12-31" }, { code: "DEMO-CZ-02", quantity: 180, expires: "2029-03-31" }], count: { date: "16 oct 2026 · 14:30", pharmacist: "Profesional DEMO · CF-DEMO" } },
  { id: "diazepam", name: "Diazepam", strength: "5 mg", form: "Tableta", unit: "tabletas", code: "DEMO-002", minimum: 250, lots: [{ code: "DEMO-DZ-01", quantity: 180, expires: "2027-08-31" }], count: null },
  { id: "lorazepam", name: "Lorazepam", strength: "2 mg", form: "Tableta", unit: "tabletas", code: "DEMO-003", minimum: 100, lots: [{ code: "DEMO-LZ-01", quantity: 970, expires: "2026-07-31" }], count: { date: "15 oct 2026 · 09:15", pharmacist: "Profesional DEMO · CF-DEMO" } },
  { id: "midazolam", name: "Midazolam", strength: "5 mg/mL", form: "Solución inyectable", unit: "ampollas", code: "DEMO-004", minimum: 30, lots: [{ code: "DEMO-MD-01", quantity: 48, expires: "2026-11-05" }], count: null },
  { id: "morfina", name: "Morfina", strength: "10 mg/mL", form: "Solución inyectable", unit: "ampollas", code: "DEMO-005", minimum: 50, lots: [{ code: "DEMO-MF-01", quantity: 120, expires: "2027-06-30" }], count: { date: "16 oct 2026 · 11:00", pharmacist: "Profesional DEMO · CF-DEMO" } },
  { id: "tramadol", name: "Tramadol", strength: "50 mg", form: "Cápsula", unit: "cápsulas", code: "DEMO-006", minimum: 100, lots: [{ code: "DEMO-TR-01", quantity: 240, expires: "2028-02-29" }], count: null },
];
let medicines = structuredClone(baselineMedicines);
let scenario = "normal";

const scenarioDescriptions = {
  normal: "Existencias habituales, stock bajo, vencidos y próximos a vencer. Todos los datos son ficticios.",
  mixed: "Clonazepam tiene lotes vencidos, próximos a vencer y sin alerta de fecha. Un mismo medicamento puede aparecer en varios filtros.",
  incomplete: "Fechas ausentes, lotes sin saldo, texto extenso, existencia igual al mínimo y vencimientos de hoy y a 30 días. No se infieren datos faltantes.",
  empty: "Vista inicial de un catálogo sin medicamentos. Se distingue de una búsqueda sin resultados.",
  loading: "Vista persistente del estado de carga. No hay una consulta de red en curso; cambie de escenario para continuar.",
  error: "Error de consulta simulado. Reintentar restablece los datos de demostración, sin conectar con servicios.",
};

const get = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const number = (value) => value.toLocaleString("es-CR");
const stock = (medicine) => medicine.lots.reduce((sum, lot) => sum + lot.quantity, 0);
const daysUntil = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - referenceDay) / 86400000);
const expiryType = (date) => !date || !Number.isFinite(daysUntil(date)) ? "unknown" : daysUntil(date) < 0 ? "expired" : daysUntil(date) <= 30 ? "soon" : "normal";
const positiveLots = (medicine) => medicine.lots.filter((lot) => lot.quantity > 0);
const nearestExpiry = (medicine) => positiveLots(medicine).map((lot) => lot.expires).filter((date) => expiryType(date) !== "unknown").sort()[0];
const unknownExpiry = (medicine) => positiveLots(medicine).some((lot) => expiryType(lot.expires) === "unknown");
const dateLabel = (date) => new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

function matchesFilter(medicine, filter) {
  if (filter === "all") return true;
  if (filter === "low") return stock(medicine) < medicine.minimum;
  if (filter === "expired" || filter === "soon") return medicine.lots.some((lot) => lot.quantity > 0 && expiryType(lot.expires) === filter);
  return stock(medicine) > 0 && stock(medicine) >= medicine.minimum && positiveLots(medicine).every((lot) => expiryType(lot.expires) === "normal");
}

function stockMarkup(medicine) {
  const low = stock(medicine) < medicine.minimum;
  const label = stock(medicine) === 0 ? "Sin existencias" : low ? "Stock bajo" : stock(medicine) === medicine.minimum ? "En el mínimo" : "Sobre el mínimo";
  return `<span class="stock-state${low ? " warning" : ""}">${icon(low ? "alert" : "check")}${label}</span><span class="minimum">Mínimo: ${number(medicine.minimum)} ${medicine.unit}</span>`;
}

function expiryMarkup(date) {
  const type = expiryType(date);
  if (type === "unknown") return `<span class="expiry-date">Fecha no registrada</span><span class="expiry-status warning">Revisar información del lote</span>`;
  const label = type === "expired" ? "Lote vencido" : type === "soon" ? daysUntil(date) === 0 ? "Vence hoy" : `Vence en ${daysUntil(date)} días` : "Sin alerta de fecha";
  const tone = type === "expired" ? " danger" : type === "soon" ? " warning" : "";
  return `<span class="expiry-date">${escapeHtml(dateLabel(date))}</span><span class="expiry-status${tone}">${type === "normal" ? "" : icon(type === "expired" ? "alert" : "clock")}${label}</span>`;
}

function medicineExpiryMarkup(medicine) {
  if (!positiveLots(medicine).length) return `<span class="expiry-date">Sin lotes con saldo</span><span class="expiry-status">Sin vencimiento que mostrar</span>`;
  const nearest = nearestExpiry(medicine);
  const states = new Set(positiveLots(medicine).map((lot) => expiryType(lot.expires)));
  return (nearest ? expiryMarkup(nearest) : expiryMarkup(null))
    + (states.has("expired") && states.has("soon") ? `<span class="expiry-status warning">También hay lotes por vencer</span>` : "")
    + (nearest && unknownExpiry(medicine) ? `<span class="expiry-status warning">Hay lotes sin fecha registrada</span>` : "");
}

function detailButton(medicine) {
  return `<button type="button" class="text-button row-detail" data-detail="${medicine.id}" aria-label="Ver detalle de ${escapeHtml(medicine.name)} ${escapeHtml(medicine.strength)}">Ver detalle${icon("chevron")}</button>`;
}

function render() {
  const query = normalize(get("search").value);
  const filter = get("status-filter").value;
  const sort = get("sort").value;
  const loading = scenario === "loading";
  const error = scenario === "error";
  const unavailable = loading || error;
  const hasCatalog = medicines.length > 0 && !unavailable;
  const shown = medicines.filter((medicine) => {
    const searchable = [medicine.name, medicine.strength, medicine.form, medicine.code, ...medicine.lots.map((lot) => lot.code)].join(" ");
    return normalize(searchable).includes(query) && matchesFilter(medicine, filter);
  }).sort((a, b) => sort === "stock" ? stock(a) - stock(b) : sort === "expiry" ? (nearestExpiry(a) || "9999").localeCompare(nearestExpiry(b) || "9999") : a.name.localeCompare(b.name, "es"));

  get("medicine-rows").innerHTML = shown.map((medicine) => `<tr><td><div class="medicine-name">${escapeHtml(medicine.name)}</div><div class="medicine-info">${escapeHtml(medicine.strength)} · ${escapeHtml(medicine.form)}</div><div class="medicine-code">${escapeHtml(medicine.code)}</div></td><td class="numeric"><span class="quantity">${number(stock(medicine))}</span><span class="quantity-unit">${medicine.unit}</span></td><td>${stockMarkup(medicine)}</td><td>${medicineExpiryMarkup(medicine)}</td><td>${detailButton(medicine)}</td></tr>`).join("");
  get("medicine-cards").innerHTML = shown.map((medicine) => `<article class="medicine-card" aria-label="${escapeHtml(medicine.name)} ${escapeHtml(medicine.strength)}"><div class="mobile-card-heading"><div><h3 class="medicine-name">${escapeHtml(medicine.name)}</h3><div class="medicine-info">${escapeHtml(medicine.strength)} · ${escapeHtml(medicine.form)}</div><div class="medicine-code">${escapeHtml(medicine.code)}</div></div><div class="mobile-stock"><span class="sr-only">Existencia registrada: </span><span class="quantity">${number(stock(medicine))}</span><span class="quantity-unit">${medicine.unit}</span></div></div><div class="mobile-card-meta"><div>${stockMarkup(medicine)}</div><div><span class="sr-only">Vencimiento más cercano: </span>${medicineExpiryMarkup(medicine)}</div></div><div class="mobile-card-action">${detailButton(medicine)}</div></article>`).join("");
  get("loading-state").hidden = !loading;
  get("error-state").hidden = !error;
  get("catalog-empty-state").hidden = hasCatalog || unavailable;
  get("empty-state").hidden = !hasCatalog || shown.length > 0;
  document.querySelector(".table-wrap").hidden = !hasCatalog || shown.length === 0;
  get("medicine-cards").hidden = !hasCatalog || shown.length === 0;
  document.querySelector(".detail-hint").hidden = !hasCatalog || shown.length === 0;
  get("result-count").textContent = unavailable ? loading ? "Carga simulada · sin datos confirmados" : "Consulta simulada sin resultado confirmado" : `${shown.length} de ${medicines.length} medicamentos${filter !== "all" || query ? " · Vista filtrada" : ""}`;
  for (const id of ["search", "status-filter", "sort", "new-movement"]) get(id).disabled = !hasCatalog;
  const expired = medicines.filter((medicine) => matchesFilter(medicine, "expired")).length;
  get("expiry-attention").hidden = !hasCatalog || expired === 0;
  get("expiry-message").textContent = expired === 1 ? "Hay 1 medicamento con un lote vencido." : `Hay ${expired} medicamentos con lotes vencidos.`;
  const unknown = medicines.filter(unknownExpiry).length;
  get("data-quality").hidden = !hasCatalog || unknown === 0;
  get("data-quality-message").textContent = `${unknown} medicamento${unknown === 1 ? " tiene" : "s tienen"} lotes con saldo y fecha no registrada. El vencimiento requiere revisión.`;
  get("movement-medicine").innerHTML = medicines.map((medicine) => `<option>${escapeHtml(medicine.name)} ${escapeHtml(medicine.strength)} · ${escapeHtml(medicine.code)}</option>`).join("");
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.disabled = !hasCatalog;
    const selected = button.dataset.filter === filter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  for (const key of ["all", "low", "expired", "soon"]) get(`metric-${key}`).textContent = unavailable ? "—" : number(medicines.filter((medicine) => matchesFilter(medicine, key)).length);
}

function setFilter(value) {
  get("status-filter").value = value;
  render();
}

function openDetail(id) {
  const medicine = medicines.find((item) => item.id === id);
  if (!medicine) return;
  get("detail-title").textContent = medicine.name;
  get("detail-description").textContent = `${medicine.strength} · ${medicine.form} · ${medicine.code}`;
  const lots = positiveLots(medicine);
  get("detail-body").innerHTML = `<div class="detail-stock"><div><small>Existencia registrada</small><strong>${number(stock(medicine))} <span>${medicine.unit}</span></strong></div><div><small>Stock mínimo</small><strong>${number(medicine.minimum)}</strong></div></div><section class="lot-section" aria-label="Lotes de demostración"><h3>Lotes con existencia (${lots.length})</h3>${lots.length ? lots.map((lot) => `<div class="lot-row"><div><span class="lot-label">Lote</span><strong>${escapeHtml(lot.code)}</strong></div><div class="numeric"><span class="lot-label">Existencia</span><strong>${number(lot.quantity)} ${medicine.unit}</strong></div><div>${expiryMarkup(lot.expires)}</div></div>`).join("") : '<p class="no-lots">No hay lotes con saldo positivo.</p>'}</section><section class="certification" aria-label="Última toma de inventario"><h3>Última toma de inventario</h3>${medicine.count ? `<p>${medicine.count.date}</p><p>Responsable: ${medicine.count.pharmacist}</p><p>Registro histórico de demostración; no acredita el saldo actual.</p>` : "<p>Sin toma de inventario registrada en esta demostración.</p>"}</section>`;
  get("detail-dialog").showModal();
}

get("search").addEventListener("input", render);
get("status-filter").addEventListener("change", render);
get("sort").addEventListener("change", render);
get("clear-filters").addEventListener("click", () => {
  get("search").value = "";
  get("sort").value = "name";
  setFilter("all");
  get("search").focus();
});
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));
get("review-expired").addEventListener("click", () => {
  get("search").value = "";
  setFilter("expired");
  get("list-title").scrollIntoView({ block: "nearest" });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-detail]");
  if (button) openDetail(button.dataset.detail);
});
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

get("theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  get("theme-toggle").setAttribute("aria-pressed", String(dark));
  get("theme-toggle").querySelector("span").textContent = dark ? "Modo claro" : "Modo oscuro";
  get("theme-toggle").setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
});
get("theme-toggle").setAttribute("aria-label", "Cambiar a modo oscuro");

get("new-movement").addEventListener("click", () => get("movement-dialog").showModal());

const sections = {
  movements: ["Movimientos", "La nueva pantalla conservará el historial, los filtros por fecha, tipo y medicamento, y el acceso a referencias, responsables y observaciones. La acción principal será registrar un movimiento."],
  count: ["Toma de inventario", "La nueva pantalla mostrará el saldo del sistema, las confirmaciones, el responsable y la observación de la toma. Se conservará la semántica actual: registrar el conteo no ajusta existencias."],
  settings: ["Configuración", "La nueva pantalla separará el catálogo de medicamentos del personal autorizado, con acciones de edición, baja y reactivación según el rol. Se mantendrá el historial."],
};
document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => {
  const section = sections[button.dataset.section];
  if (!section) {
    get("main").scrollIntoView({ block: "start" });
    return;
  }
  get("scope-title").textContent = section[0];
  get("scope-description").textContent = section[1];
  get("scope-dialog").showModal();
}));

document.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || document.querySelector("dialog[open]")) return;
  if (event.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  event.preventDefault();
  get("search").focus();
});

function changeScenario(value) {
  scenario = value;
  medicines = ["empty", "loading", "error"].includes(value) ? [] : structuredClone(baselineMedicines);
  if (value === "mixed") {
    medicines[0].lots = [
      { code: "DEMO-CZ-VENCIDO", quantity: 80, expires: "2026-09-30" },
      { code: "DEMO-CZ-PROXIMO", quantity: 180, expires: "2026-11-10" },
      { code: "DEMO-CZ-VIGENTE", quantity: 170, expires: "2028-12-31" },
    ];
  }
  if (value === "incomplete") {
    medicines[0].lots[0].quantity = 0;
    medicines[0].lots[0].expires = "2026-07-31";
    medicines[1].lots[0].quantity = 0;
    medicines[3].lots[0].expires = "2026-11-16";
    medicines[3].minimum = 48;
    medicines[4].name = "Morfina sulfato pentahidratado — presentación de demostración con nombre extenso";
    medicines[4].code = "DEMO-CODIGO-EXTENSO-005-REVISION-VISUAL";
    medicines[4].lots[0].expires = null;
    medicines[5].lots[0].expires = "2026-10-17";
  }
  get("scenario").value = value;
  get("scenario-description").textContent = scenarioDescriptions[value];
  get("search").value = "";
  get("status-filter").value = "all";
  get("sort").value = "name";
  render();
}

get("scenario").addEventListener("change", (event) => changeScenario(event.target.value));
for (const id of ["retry", "restore-demo"]) get(id).addEventListener("click", () => { changeScenario("normal"); get("search").focus(); });
changeScenario("normal");
