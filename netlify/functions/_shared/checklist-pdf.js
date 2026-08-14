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

// Vehicle owners who should be CC'd on the confirmation email for their car.
// Match is case-insensitive substring against the vehicle name captured from
// the rental checklist link (?vehicle=...).
const OWNER_CC_BY_VEHICLE = [
  { match: "kia carnival", email: "castorjuel@yahoo.com" },
  { match: "jeep wrangler", email: "castorjuel@yahoo.com" },
];

function fmt(n) {
return (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

async function buildPdfBuffer(sub) {
const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]); // US Letter
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const navy = rgb(0.05, 0.05, 0.05);
const gray = rgb(0.35, 0.35, 0.35);

let y = 740;
const left = 54;
const lineGap = 16;

function heading(text) {
page.drawText(text, { x: left, y, size: 15, font: bold, color: navy });
y -= 22;
}
function row(label, value) {
page.drawText(label, { x: left, y, size: 10.5, font: bold, color: gray });
page.drawText(String(value == null || value === "" ? "—" : value), {
x: left + 190,
y,
size: 10.5,
font,
color: navy,
});
y -= lineGap;
}
function moneyRow(label, value, opts) {
opts = opts || {};
page.drawText(label, { x: left, y, size: 10.5, font: opts.bold ? bold : font, color: navy });
page.drawText("$" + fmt(value), { x: 480, y, size: 10.5, font: opts.bold ? bold : font, color: navy });
y -= lineGap;
}

page.drawText("Olfindo Immigration Consulting Corporation (Olcorp.ca)", {
x: left,
y,
size: 11,
font: bold,
color: navy,
});
y -= 16;
page.drawText("Vehicle Rental Checklist & Agreement — Signed Copy", { x: left, y, size: 16, font: bold, color: navy });
y -= 30;

heading("Client Information");
row("Full Name", sub.fullName);
row("Email", sub.email);
row("Phone", sub.phone);
row("Emergency Contact", sub.emergencyContactName);
row("Emergency Phone", sub.emergencyContactPhone);
y -= 8;

heading("Checklist");
if (sub.vehicle) row("Vehicle", sub.vehicle);
row("Photo Consent", sub.photoConsent);
row("Vehicle Condition", sub.vehicleCondition);
if (sub.conditionNotes) row("Condition Notes", sub.conditionNotes);
row("Damage Coverage", sub.damageCoverage);
row("Payment Method", sub.paymentMethod === "etransfer" ? "Interac e-Transfer" : "Credit Card (Stripe)");
row("Rental Duration", (Number(sub.rentalDays) || 0) + " day(s)");
y -= 8;

const b = computeBreakdown(sub);
heading("Payment Summary");
moneyRow("Quotation Total", b.quoteTotal);
if (b.embeddedCcFee > 0) moneyRow("Credit Card Fee Removed (e-Transfer)", -b.embeddedCcFee);
moneyRow("Reservation Fee Paid", -(Number(sub.amountPaid) || 0));
moneyRow("Remaining Rental Balance", b.rentalBalance, { bold: true });
moneyRow("$100 Refundable Security Deposit", b.deposit);
moneyRow("Subtotal", b.subtotal, { bold: true });
if (b.coverageFee > 0) {
moneyRow("No Obligation Plan (" + (Number(sub.rentalDays) || 0) + " days x $15)", b.coverageFee);
moneyRow("GST (5%)", b.gst);
moneyRow("PST (6%)", b.pst);
}
if (b.ccFee > 0) moneyRow("Credit Card Processing Fee", b.ccFee);
y -= 4;
page.drawLine({ start: { x: left, y: y + 10 }, end: { x: 558, y: y + 10 }, thickness: 0.75, color: gray });
y -= 10;
moneyRow("Total Due", b.totalDue, { bold: true });
y -= 20;

if (sub.signatureDataUrl && sub.signatureDataUrl.indexOf("data:image/png;base64,") === 0) {
try {
const base64 = sub.signatureDataUrl.split(",")[1];
const bytes = Buffer.from(base64, "base64");
const png = await doc.embedPng(bytes);
const sigWidth = 220;
const sigHeight = (png.height / png.width) * sigWidth;
page.drawText("Signature", { x: left, y, size: 10.5, font: bold, color: gray });
y -= sigHeight - 4;
page.drawImage(png, { x: left, y, width: sigWidth, height: sigHeight });
y -= 16;
} catch (e) {
// If the signature image fails to embed, skip it rather than failing the whole PDF.
}
}

page.drawText("Submitted " + (sub.submittedAt || new Date().toISOString()), {
x: left,
y: 40,
size: 8.5,
font,
color: gray,
});

const pdfBytes = await doc.save();
return Buffer.from(pdfBytes);
}

function ownerCcForVehicle(vehicleName) {
const key = (vehicleName || "").toLowerCase();
if (!key) return null;
const hit = OWNER_CC_BY_VEHICLE.find((o) => key.includes(o.match));
return hit ? hit.email : null;
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
