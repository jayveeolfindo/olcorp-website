// Shared helper: builds a PDF copy of a submitted rental checklist and
// emails it (via the Resend API) to the client and consulting@olcorp.ca.
//
// Setup required (done by the site owner, not in code):
// Netlify dashboard -> Site settings -> Environment variables
// Add: RESEND_API_KEY = re_xxx (from resend.com, after verifying a sending domain)
// Optional: RESEND_FROM_EMAIL = "Olcorp.ca <consulting@olcorp.ca>"
// (falls back to Resend's shared test sender if not set)

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const GST_RATE = 0.05;
const PST_RATE = 0.06;
const CC_FEE_PCT = 0.029;
const CC_FEE_FLAT = 0.3;
const DEPOSIT_FULL = 100;
const COVERAGE_RATE = 15;

// Vehicle owner CC'd on every car rental confirmation email, regardless of
// which vehicle was booked.
const OWNER_CC_EMAIL = "castorjuel@yahoo.com";

function fmt(n) {
return (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fetches the Olcorp company logo (same file used in the site's topbar) from
// the live site so the PDF stays in sync automatically if the logo is ever
// replaced. Returns null (and the PDF is built without a logo) if anything
// goes wrong -- a missing logo should never block the checklist PDF from
// being generated and emailed.
async function fetchLogoBytes() {
try {
const baseUrl = (process.env.URL || "https://olcorp.ca").replace(/\/$/, "");
const resp = await fetch(baseUrl + "/logo.png");
if (!resp.ok) return null;
return Buffer.from(await resp.arrayBuffer());
} catch (e) {
return null;
}
}

// Mirrors the client-side recalcTotals() logic so the PDF breakdown matches
// exactly what the client saw and paid on the site.
function computeBreakdown(sub) {
const quoteTotal = Number(sub.quoteTotal) || 0;
const days = Number(sub.rentalDays) || 0;
const paid = Number(sub.amountPaid) || 0;
const paymentMethod = sub.paymentMethod || "";
const coverageAccepted = (sub.damageCoverage || "").startsWith("Accepted") && days > 0;
const coverageFee = coverageAccepted ? COVERAGE_RATE * days : 0;
const gst = coverageFee > 0 ? coverageFee * GST_RATE : 0;
const pst = coverageFee > 0 ? coverageFee * PST_RATE : 0;

let embeddedCcFee = 0;
let adjustedQuoteTotal = quoteTotal;
if (paymentMethod === "etransfer" && quoteTotal > 0) {
const preFeeTotal = (quoteTotal - CC_FEE_FLAT) / (1 + CC_FEE_PCT);
embeddedCcFee = quoteTotal - preFeeTotal;
adjustedQuoteTotal = preFeeTotal;
}

const rentalBalance = Math.max(0, adjustedQuoteTotal - paid);
const subtotal = rentalBalance + DEPOSIT_FULL;
const nopChargeWithTax = coverageFee + gst + pst;
const ccFee = paymentMethod === "card" && nopChargeWithTax > 0 ? nopChargeWithTax * CC_FEE_PCT + CC_FEE_FLAT : 0;
const computedTotalDue = subtotal + coverageFee + gst + pst + ccFee;

return {
quoteTotal,
embeddedCcFee,
rentalBalance,
deposit: DEPOSIT_FULL,
subtotal,
coverageFee,
gst,
pst,
ccFee,
totalDue: Number(sub.totalDue) || computedTotalDue,
};
}

// Company letterhead block -- mirrors the header on Olcorp.ca's real
// invoices (see the accounting app's invoice PDFs) so this document reads as
// an official Olcorp.ca form rather than a generic one-off page.
const COMPANY_LINES = [
{ text: "Olcorp.ca Immigration & Rentals", bold: true, size: 10.5 },
{ text: "7th Floor 2010 11th Ave", size: 9 },
{ text: "Regina SK  S4P 0J3", size: 9 },
{ text: "+1 639 554 9791", size: 9 },
{ text: "consulting@olcorp.ca", size: 9 },
{ text: "www.olcorp.ca", size: 9 },
{ text: "GST/HST Registration No.: 779913003RT0001", size: 8 },
{ text: "Business Number 779913003", size: 8 },
];

function formatSubmittedDate(iso) {
try {
return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
} catch (e) {
return iso;
}
}

async function buildPdfBuffer(sub) {
const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]); // US Letter
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const navy = rgb(0.05, 0.05, 0.05);
const gray = rgb(0.35, 0.35, 0.35);

const left = 54;
const right = 558; // right margin -- amount columns and right-aligned text end here
const lineGap = 16;

function widthOf(f, text, size) {
return f.widthOfTextAtSize(String(text), size);
}
function drawRight(text, yPos, size, f, color) {
page.drawText(String(text), { x: right - widthOf(f, text, size), y: yPos, size, font: f, color });
}
function heading(text, yPos) {
page.drawText(text, { x: left, y: yPos, size: 13, font: bold, color: navy });
page.drawLine({ start: { x: left, y: yPos - 6 }, end: { x: right, y: yPos - 6 }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });
return yPos - 24;
}
function row(label, value, yPos) {
page.drawText(label, { x: left, y: yPos, size: 10, font: bold, color: gray });
page.drawText(String(value == null || value === "" ? "—" : value), {
x: left + 160,
y: yPos,
size: 10,
font,
color: navy,
});
return yPos - lineGap;
}
function moneyRow(label, value, yPos, opts) {
opts = opts || {};
const f = opts.bold ? bold : font;
const text = "$" + fmt(value);
page.drawText(label, { x: left, y: yPos, size: 10.5, font: f, color: navy });
drawRight(text, yPos, 10.5, f, navy);
return yPos - lineGap;
}

// --- Letterhead: logo top-left (2x size), company block top-right ---
const topY = 758;
let logoBottom = topY;
const logoBytes = await fetchLogoBytes();
if (logoBytes) {
try {
const logoImg = await doc.embedPng(logoBytes);
const logoWidth = 200; // 2x the original header size
const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
page.drawImage(logoImg, { x: left, y: topY - logoHeight, width: logoWidth, height: logoHeight });
logoBottom = topY - logoHeight;
} catch (e) {
// If the logo fails to embed, just skip it -- the rest of the letterhead still renders.
}
}

let companyY = topY - 2;
for (const line of COMPANY_LINES) {
drawRight(line.text, companyY, line.size, line.bold ? bold : font, line.bold ? navy : gray);
companyY -= line.size + 3;
}

let y = Math.min(logoBottom, companyY) - 26;

// --- Title ---
const titleText = "VEHICLE RENTAL CHECKLIST & AGREEMENT";
const titleSize = 20 * 0.2; // 80% smaller than the original 20pt
const titleWidth = widthOf(bold, titleText, titleSize);
page.drawText(titleText, { x: (612 - titleWidth) / 2, y, size: titleSize, font: bold, color: navy });
y -= 18;
page.drawText("Signed Copy", { x: left, y, size: 10.5, font, color: gray });
y -= 20;
page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: navy });
y -= 26;

// --- Meta block: client on the left, booking reference on the right (mirrors BILL TO / INVOICE #) ---
const metaTop = y;
page.drawText("PREPARED FOR", { x: left, y, size: 8.5, font: bold, color: gray });
page.drawText("SUBMITTED", { x: left + 260, y, size: 8.5, font: bold, color: gray });
y -= 14;
page.drawText(sub.fullName || "—", { x: left, y, size: 12.5, font: bold, color: navy });
page.drawText(sub.submittedAt ? formatSubmittedDate(sub.submittedAt) : "—", { x: left + 260, y, size: 11, font, color: navy });
y -= 15;
if (sub.email) {
page.drawText(sub.email, { x: left, y, size: 9.5, font, color: gray });
y -= 13;
}
if (sub.phone) {
page.drawText(sub.phone, { x: left, y, size: 9.5, font, color: gray });
y -= 13;
}
if (sub.vehicle) {
page.drawText("VEHICLE", { x: left + 260, y: metaTop - 29, size: 8.5, font: bold, color: gray });
page.drawText(sub.vehicle, { x: left + 260, y: metaTop - 43, size: 10.5, font, color: navy });
}
y = Math.min(y, metaTop - 60) - 12;
page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });
y -= 24;

y = heading("Checklist", y);
y = row("Emergency Contact", sub.emergencyContactName, y);
y = row("Emergency Phone", sub.emergencyContactPhone, y);
y = row("Photo Consent", sub.photoConsent, y);
y = row("Vehicle Condition", sub.vehicleCondition, y);
if (sub.conditionNotes) y = row("Condition Notes", sub.conditionNotes, y);
y = row("Damage Coverage", sub.damageCoverage, y);
y = row("Payment Method", sub.paymentMethod === "etransfer" ? "Interac e-Transfer" : "Credit Card (Stripe)", y);
y = row("Rental Duration", (Number(sub.rentalDays) || 0) + " day(s)", y);
y -= 10;

const b = computeBreakdown(sub);
y = heading("Payment Summary", y);
y = moneyRow("Quotation Total", b.quoteTotal, y);
if (b.embeddedCcFee > 0) y = moneyRow("Credit Card Fee Removed (e-Transfer)", -b.embeddedCcFee, y);
y = moneyRow("Reservation Fee Paid", -(Number(sub.amountPaid) || 0), y);
y = moneyRow("Remaining Rental Balance", b.rentalBalance, y, { bold: true });
y = moneyRow("$100 Refundable Security Deposit", b.deposit, y);
y = moneyRow("Subtotal", b.subtotal, y, { bold: true });
if (b.coverageFee > 0) {
y = moneyRow("No Obligation Plan (" + (Number(sub.rentalDays) || 0) + " days x $15)", b.coverageFee, y);
y = moneyRow("GST (5%)", b.gst, y);
y = moneyRow("PST (6%)", b.pst, y);
}
if (b.ccFee > 0) y = moneyRow("Credit Card Processing Fee", b.ccFee, y);
y -= 4;
page.drawLine({ start: { x: left, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.75, color: gray });
y -= 10;
y = moneyRow("Total Due", b.totalDue, y, { bold: true });
y -= 20;

if (sub.signatureDataUrl && sub.signatureDataUrl.indexOf("data:image/png;base64,") === 0) {
try {
const base64 = sub.signatureDataUrl.split(",")[1];
const bytes = Buffer.from(base64, "base64");
const png = await doc.embedPng(bytes);
const sigWidth = 220;
const sigHeight = (png.height / png.width) * sigWidth;
page.drawText("Customer Signature", { x: left, y, size: 10.5, font: bold, color: gray });
y -= sigHeight - 4;
page.drawImage(png, { x: left, y, width: sigWidth, height: sigHeight });
y -= 16;
} catch (e) {
// If the signature image fails to embed, skip it rather than failing the whole PDF.
}
}

page.drawText("Questions? Please contact Juel at 639-915-0209.", {
x: left,
y: 50,
size: 9,
font,
color: gray,
});
page.drawText("Submitted " + (sub.submittedAt || new Date().toISOString()), {
x: left,
y: 34,
size: 8,
font,
color: gray,
});

const pdfBytes = await doc.save();
return Buffer.from(pdfBytes);
}

function ownerCcForVehicle(vehicleName) {
return OWNER_CC_EMAIL;
}

async function sendConfirmationEmail(sub) {
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
throw new Error("RESEND_API_KEY is not configured on this site.");
}
const from = process.env.RESEND_FROM_EMAIL || "Olcorp.ca <onboarding@resend.dev>";

const pdfBuffer = await buildPdfBuffer(sub);
const pdfBase64 = pdfBuffer.toString("base64");

const recipients = ["consulting@olcorp.ca"];
if (sub.email) recipients.unshift(sub.email);

const ownerCc = ownerCcForVehicle(sub.vehicle);

const html =
"<p>Hi " +
(sub.fullName || "there") +
",</p>" +
"<p>Thank you — your Vehicle Rental Checklist &amp; Agreement has been received. A signed PDF copy is attached for your records.</p>" +
"<p>Olfindo Immigration Consulting Corporation (Olcorp.ca)</p>";

const emailPayload = {
from: from,
to: recipients,
subject: "Your Vehicle Rental Checklist & Receipt",
html: html,
attachments: [
{
filename: "rental-checklist.pdf",
content: pdfBase64,
},
],
};
if (ownerCc) emailPayload.cc = [ownerCc];

const resp = await fetch("https://api.resend.com/emails", {
method: "POST",
headers: {
Authorization: "Bearer " + RESEND_API_KEY,
"Content-Type": "application/json",
},
body: JSON.stringify(emailPayload),
});

if (!resp.ok) {
const errText = await resp.text();
throw new Error("Resend API error: " + errText);
}
return true;
}

module.exports = { buildPdfBuffer, sendConfirmationEmail, computeBreakdown };
