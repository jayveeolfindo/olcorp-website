// Netlify Function: stores a full checklist submission (including the
// signature image) in Netlify Blobs, keyed by a generated submissionId.
// The id is later passed through Stripe Checkout metadata (card payments)
// or used immediately (e-Transfer) to build the PDF + send the confirmation
// email without needing to shuttle large payloads through Stripe.
//
// No extra account/API key needed for this one -- Netlify Blobs is built
// into Netlify itself.

const { getSubmissionsStore } = require("./_shared/blob-store");
const crypto = require("crypto");

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const submissionId = crypto.randomUUID();
  const record = {
    fullName: (payload.fullName || "").toString().slice(0, 200),
    email: (payload.email || "").toString().slice(0, 200),
    phone: (payload.phone || "").toString().slice(0, 60),
    vehicle: (payload.vehicle || "").toString().slice(0, 200),
    emergencyContactName: (payload.emergencyContactName || "").toString().slice(0, 200),
    emergencyContactPhone: (payload.emergencyContactPhone || "").toString().slice(0, 60),
    photoConsent: (payload.photoConsent || "").toString().slice(0, 200),
    vehicleCondition: (payload.vehicleCondition || "").toString().slice(0, 200),
    conditionNotes: (payload.conditionNotes || "").toString().slice(0, 2000),
    damageCoverage: (payload.damageCoverage || "").toString().slice(0, 200),
    paymentMethod: (payload.paymentMethod || "").toString().slice(0, 30),
    quoteTotal: Number(payload.quoteTotal) || 0,
    rentalDays: Number(payload.rentalDays) || 0,
    amountPaid: Number(payload.amountPaid) || 0,
    totalDue: Number(payload.totalDue) || 0,
    signatureDataUrl: (payload.signatureDataUrl || "").toString().slice(0, 300000),
    submittedAt: new Date().toISOString(),
  };

  try {
    const store = getSubmissionsStore();
    await store.setJSON(submissionId, record);
  } catch (e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Could not save submission: " + e.message }),
    };
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ submissionId: submissionId }) };
};
