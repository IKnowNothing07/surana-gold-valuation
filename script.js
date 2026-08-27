/* ==========================================================
   SURANA JEWELLERS — Gold Valuation Report
   script.js

   All business logic lives here. Nothing is sent anywhere;
   everything stays in this browser tab / localStorage.
   ========================================================== */

/* ----------------------------------------------------------
   1. SHOP CONFIGURATION — edit these defaults any time.
   These are also editable at runtime via the "Shop settings"
   button, which saves overrides into localStorage.
   ---------------------------------------------------------- */
const DEFAULT_CONFIG = {
  shopName: "SURANA JEWELLERS",
  proprietor: "प्रो. नवीन सुराना (Naveen Surana)",
  tagline: "सोना, चांदी एवं कीमती रत्नों के विक्रेता",
  addressHi: "नेहरू चौक, मुख्य मार्ग, वारासिवनी, जिला - बालाघाट (म.प्र.) - 481331",
  addressEn: "Nehru Chowk, Main Road, Waraseoni, Dist. Balaghat, Madhya Pradesh - 481331",
  gstin: "23AYAPS910QIZZ",
  phone: "9425403001",
  defaultBank: "SBI",
  defaultAcct: "11226812494",
  defaultIfsc: "SBIN0000499",
};

const CONFIG_STORAGE_KEY = "surana_valuation_config_v1";

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    /* ignore corrupt storage, fall back to defaults */
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    /* storage may be unavailable (private browsing) — fail silently */
  }
}

let CONFIG = loadConfig();

/* ----------------------------------------------------------
   2. KARAT PURITY TABLE
   ---------------------------------------------------------- */
const KARAT_PURITY = {
  24: 1,
  22: 22 / 24,
  20: 20 / 24,
  18: 18 / 24,
  16: 16 / 24,
  14: 14 / 24,
  12: 12 / 24,
};

function purityForKarat(karat) {
  const k = Number(karat);
  if (KARAT_PURITY[k] !== undefined) return KARAT_PURITY[k];
  // custom karat value entered directly
  return k / 24;
}

/* ----------------------------------------------------------
   3. FORMATTING HELPERS
   ---------------------------------------------------------- */

// Indian-style currency formatting: ₹1,31,000
function formatINR(amount) {
  const rounded = Math.round(amount || 0);
  return "₹" + rounded.toLocaleString("en-IN");
}

function formatWeight(w) {
  const n = Number(w) || 0;
  return n.toFixed(3);
}

function formatKtPercent(karat) {
  const purity = purityForKarat(karat) * 100;
  return `${purity.toFixed(1)}% = ${Number(karat)}Kt`;
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function maskAadhaarValue(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 4) return value || "—";
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/* ----------------------------------------------------------
   4. DOM REFERENCES
   ---------------------------------------------------------- */
const el = (id) => document.getElementById(id);

const itemTableBody = el("itemTableBody");
const rowTemplate = el("rowTemplate");

let rowCounter = 0;

/* ----------------------------------------------------------
   5. ROW MANAGEMENT (input screen jewellery table)
   ---------------------------------------------------------- */

function addRow(prefill) {
  const fragment = rowTemplate.content.cloneNode(true);
  const tr = fragment.querySelector(".item-row");
  rowCounter += 1;
  tr.dataset.rowId = rowCounter;

  if (prefill) {
    tr.querySelector(".item-name").value = prefill.name || "";
    tr.querySelector(".item-pcs").value = prefill.pcs ?? 1;
    tr.querySelector(".item-gross").value = prefill.gross ?? "";
    tr.querySelector(".item-net").value = prefill.net ?? "";
  }

  itemTableBody.appendChild(tr);
  attachRowListeners(tr);
  renumberRows();
  recalculate();
}

function attachRowListeners(tr) {
  const nameInput = tr.querySelector(".item-name");
  const pcsInput = tr.querySelector(".item-pcs");
  const grossInput = tr.querySelector(".item-gross");
  const netInput = tr.querySelector(".item-net");
  const karatSelect = tr.querySelector(".item-karat");
  const karatCustom = tr.querySelector(".item-karat-custom");
  const delBtn = tr.querySelector(".row-del-btn");

  [nameInput, pcsInput, grossInput, netInput].forEach((input) => {
    input.addEventListener("input", recalculate);
  });

  karatSelect.addEventListener("change", () => {
    if (karatSelect.value === "custom") {
      karatCustom.style.display = "block";
      karatCustom.focus();
    } else {
      karatCustom.style.display = "none";
    }
    recalculate();
  });

  karatCustom.addEventListener("input", recalculate);

  delBtn.addEventListener("click", () => {
    tr.remove();
    renumberRows();
    recalculate();
  });
}

function renumberRows() {
  const rows = itemTableBody.querySelectorAll(".item-row");
  rows.forEach((row, index) => {
    row.querySelector(".sn-cell").textContent = index + 1;
  });
}

function getEffectiveKarat(tr) {
  const select = tr.querySelector(".item-karat");
  if (select.value === "custom") {
    const custom = tr.querySelector(".item-karat-custom").value;
    return custom === "" ? 0 : Number(custom);
  }
  return Number(select.value);
}

/* ----------------------------------------------------------
   6. CALCULATIONS
   ---------------------------------------------------------- */

function getRatePerGram() {
  const rate10g = Number(el("rate24k").value) || 0;
  return rate10g / 10;
}

function recalculate() {
  const ratePerGram = getRatePerGram();
  el("ratePerGramReadout").textContent = formatINR(ratePerGram);

  const rows = itemTableBody.querySelectorAll(".item-row");
  let totalPcs = 0;
  let totalGross = 0;
  let totalNet = 0;
  let totalValue = 0;

  rows.forEach((tr) => {
    const pcs = Number(tr.querySelector(".item-pcs").value) || 0;
    const gross = Number(tr.querySelector(".item-gross").value) || 0;
    const net = Number(tr.querySelector(".item-net").value) || 0;
    const karat = getEffectiveKarat(tr);
    const purity = karat > 0 ? purityForKarat(karat) : 0;
    const value = net * purity * ratePerGram;

    tr.querySelector(".value-cell").textContent = formatINR(value);

    totalPcs += pcs;
    totalGross += gross;
    totalNet += net;
    totalValue += value;
  });

  el("totalPcs").textContent = totalPcs;
  el("totalGross").textContent = formatWeight(totalGross);
  el("totalNet").textContent = formatWeight(totalNet);
  el("totalValue").textContent = formatINR(totalValue);
}

/* ----------------------------------------------------------
   7. REPORT GENERATION (renders screen 2 from screen 1 state)
   ---------------------------------------------------------- */

function collectReportData() {
  const rows = Array.from(itemTableBody.querySelectorAll(".item-row")).map((tr) => {
    const name = tr.querySelector(".item-name").value.trim() || "—";
    const pcs = Number(tr.querySelector(".item-pcs").value) || 0;
    const gross = Number(tr.querySelector(".item-gross").value) || 0;
    const net = Number(tr.querySelector(".item-net").value) || 0;
    const karat = getEffectiveKarat(tr);
    const purity = karat > 0 ? purityForKarat(karat) : 0;
    const value = net * purity * getRatePerGram();
    return { name, pcs, gross, net, karat, value };
  });

  return {
    refNo: el("refNo").value.trim() || "—",
    date: el("reportDate").value,
    branch: el("branchSelect").value,
    custName: el("custName").value.trim() || "—",
    custAddress: el("custAddress").value.trim() || "—",
    custSo: el("custSo").value.trim() || "—",
    custAadhaar: el("custAadhaar").value.trim(),
    maskAadhaar: el("maskAadhaar").checked,
    rate10g: Number(el("rate24k").value) || 0,
    rows,
    fees: Number(el("feesInput").value) || 0,
    acct: el("acctInput").value.trim() || CONFIG.defaultAcct,
    ifsc: el("ifscInput").value.trim() || CONFIG.defaultIfsc,
  };
}

function renderShopChrome() {
  el("rShopName").textContent = CONFIG.shopName;
  el("rTagline").textContent = CONFIG.tagline;
  el("rProprietor").textContent = CONFIG.proprietor;
  el("rGstin").textContent = `GSTIN: ${CONFIG.gstin}`;
  el("rAddressHi").textContent = CONFIG.addressHi;
  el("rAddressEn").textContent = CONFIG.addressEn;
  el("fShopName").textContent = CONFIG.shopName;
  el("fAddress").textContent = CONFIG.addressEn;
  el("fPhone").textContent = `Phone: ${CONFIG.phone}`;
}

function renderReport() {
  const data = collectReportData();

  renderShopChrome();

  el("rRefNo").textContent = data.refNo;
  el("rDate").textContent = formatDateDisplay(data.date);

  const branchLabel = data.branch === "mahendiwada" ? "Waraseoni (Mahendiwada)" : "Waraseoni";
  el("rBankLine").textContent = `For Bank: ${CONFIG.defaultBank} / Branch - ${branchLabel}`;

  el("rCustName").textContent = data.custName;
  el("rCustAddress").textContent = data.custAddress;
  el("rCustSo").textContent = data.custSo;
  el("rCustAadhaar").textContent = data.maskAadhaar
    ? maskAadhaarValue(data.custAadhaar)
    : (data.custAadhaar || "—");

  const ratePerGram = data.rate10g / 10;
  const body = el("rItemBody");
  body.innerHTML = "";

  let totalPcs = 0, totalGross = 0, totalNet = 0, totalValue = 0;

  data.rows.forEach((row, index) => {
    totalPcs += row.pcs;
    totalGross += row.gross;
    totalNet += row.net;
    totalValue += row.value;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-sn">${index + 1}</td>
      <td class="col-item">${escapeHtml(row.name)}</td>
      <td class="col-pcs">${row.pcs}</td>
      <td class="col-wt">${formatWeight(row.gross)}</td>
      <td class="col-wt">${formatWeight(row.net)}</td>
      <td class="col-kt">${row.karat > 0 ? formatKtPercent(row.karat) : "—"}</td>
      <td class="col-value">${formatINR(row.value)}</td>
    `;
    body.appendChild(tr);
  });

  if (data.rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" style="text-align:center; color:#777;">No items added</td>`;
    body.appendChild(tr);
  }

  el("rTotalPcs").textContent = totalPcs;
  el("rTotalGross").textContent = formatWeight(totalGross);
  el("rTotalNet").textContent = formatWeight(totalNet);
  el("rTotalValue").textContent = formatINR(totalValue);

  el("rFees").textContent = `${formatINR(data.fees)}/-`;
  el("rAcct").textContent = `SBI A/C - ${data.acct}`;
  el("rIfsc").textContent = `IFSC Code: ${data.ifsc}`;
}

// Minimal HTML escaping for item names (defensive, since they're user text)
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ----------------------------------------------------------
   8. SCREEN NAVIGATION
   ---------------------------------------------------------- */

function showReportScreen() {
  renderReport();
  el("inputScreen").style.display = "none";
  el("reportScreen").style.display = "block";
  window.scrollTo(0, 0);
}

function showInputScreen() {
  el("reportScreen").style.display = "none";
  el("inputScreen").style.display = "block";
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------
   9. SETTINGS MODAL
   ---------------------------------------------------------- */

function openSettingsModal() {
  el("cfgShopName").value = CONFIG.shopName;
  el("cfgProprietor").value = CONFIG.proprietor;
  el("cfgTagline").value = CONFIG.tagline;
  el("cfgAddressHi").value = CONFIG.addressHi;
  el("cfgAddressEn").value = CONFIG.addressEn;
  el("cfgGstin").value = CONFIG.gstin;
  el("cfgBank").value = CONFIG.defaultBank;
  el("cfgAcct").value = CONFIG.defaultAcct;
  el("cfgIfsc").value = CONFIG.defaultIfsc;
  el("settingsModal").classList.add("open");
}

function closeSettingsModal() {
  el("settingsModal").classList.remove("open");
}

function saveSettingsFromModal() {
  CONFIG = {
    shopName: el("cfgShopName").value.trim() || DEFAULT_CONFIG.shopName,
    proprietor: el("cfgProprietor").value.trim() || DEFAULT_CONFIG.proprietor,
    tagline: el("cfgTagline").value.trim() || DEFAULT_CONFIG.tagline,
    addressHi: el("cfgAddressHi").value.trim() || DEFAULT_CONFIG.addressHi,
    addressEn: el("cfgAddressEn").value.trim() || DEFAULT_CONFIG.addressEn,
    gstin: el("cfgGstin").value.trim() || DEFAULT_CONFIG.gstin,
    defaultBank: el("cfgBank").value.trim() || DEFAULT_CONFIG.defaultBank,
    defaultAcct: el("cfgAcct").value.trim() || DEFAULT_CONFIG.defaultAcct,
    defaultIfsc: el("cfgIfsc").value.trim() || DEFAULT_CONFIG.defaultIfsc,
  };
  saveConfig(CONFIG);
  // reflect new defaults into currently-empty fee/account fields
  if (!el("acctInput").value) el("acctInput").value = CONFIG.defaultAcct;
  if (!el("ifscInput").value) el("ifscInput").value = CONFIG.defaultIfsc;
  el("bankName").value = CONFIG.defaultBank;
  closeSettingsModal();
}

/* ----------------------------------------------------------
   10. CLEAR / NEW REPORT
   ---------------------------------------------------------- */

function openConfirmModal() {
  el("confirmModal").classList.add("open");
}

function closeConfirmModal() {
  el("confirmModal").classList.remove("open");
}

function clearForm() {
  el("refNo").value = "";
  el("reportDate").value = todayISO();
  el("branchSelect").value = "waraseoni";
  el("custName").value = "";
  el("custAddress").value = "";
  el("custSo").value = "";
  el("custAadhaar").value = "";
  el("maskAadhaar").checked = false;
  el("rate24k").value = "";
  el("feesInput").value = "";
  el("acctInput").value = CONFIG.defaultAcct;
  el("ifscInput").value = CONFIG.defaultIfsc;

  itemTableBody.innerHTML = "";
  rowCounter = 0;
  addRow();
  addRow();
  addRow();

  recalculate();
  closeConfirmModal();
}

/* ----------------------------------------------------------
   11. INITIALIZATION
   ---------------------------------------------------------- */

function applyConfigToInputScreen() {
  el("bankName").value = CONFIG.defaultBank;
  el("acctInput").value = CONFIG.defaultAcct;
  el("ifscInput").value = CONFIG.defaultIfsc;
}

function init() {
  el("reportDate").value = todayISO();
  applyConfigToInputScreen();

  // start with a few blank rows so the form doesn't look empty
  addRow();
  addRow();
  addRow();

  el("rate24k").addEventListener("input", recalculate);

  el("addRowBtn").addEventListener("click", () => addRow());

  el("generateBtn").addEventListener("click", showReportScreen);
  el("printBtn").addEventListener("click", () => {
    renderReport();
    window.print();
  });
  el("printFromReportBtn").addEventListener("click", () => window.print());
  el("backToFormBtn").addEventListener("click", showInputScreen);

  el("settingsBtn").addEventListener("click", openSettingsModal);
  el("settingsCancelBtn").addEventListener("click", closeSettingsModal);
  el("settingsSaveBtn").addEventListener("click", saveSettingsFromModal);
  el("settingsModal").addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") closeSettingsModal();
  });

  el("clearBtn").addEventListener("click", openConfirmModal);
  el("confirmCancelBtn").addEventListener("click", closeConfirmModal);
  el("confirmClearBtn").addEventListener("click", clearForm);
  el("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirmModal();
  });

  recalculate();
}

document.addEventListener("DOMContentLoaded", init);
