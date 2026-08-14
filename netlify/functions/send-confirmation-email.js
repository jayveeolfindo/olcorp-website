// Netlify Function: called directly by the browser right after an
// Interac e-Transfer submission (there's no payment gateway to confirm
// e-Transfer, so the PDF + confirmation email goes out immediately on
// checklist submit). Card payments instead go through stripe-webhook.js,
// which only fires once Stripe confirms the charge actually succeeded.

const { getStore } = require("@netlify/blobs");
const { sendConfirmationEmail } = require("./_shared/checklist-pdf");

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

  const submissionId = (payload.submissionId || "").toString();
  if (!submissionId) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing submissionId" }) };
  }

  try {
    const store = getStore("rental-submissions");
    const submission = await store.get(submissionId, { type: "json" });
    if (!submission) {
      return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Submission not found" }) };
    }
    await sendConfirmationEmail(submission);
    await store.delete(submissionId);
  } catch (e) {
    // Non-fatal from the client's point of view -- the checklist itself was
    // already saved via Netlify Forms either way.
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
