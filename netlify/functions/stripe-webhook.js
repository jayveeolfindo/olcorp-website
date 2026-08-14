// Netlify Function: Stripe webhook endpoint. Fires when Stripe confirms a
// card payment actually succeeded (checkout.session.completed), then
// builds the PDF + emails the confirmation -- this only runs on confirmed
// payment, unlike the e-Transfer path which sends on submit.
//
// Setup required (done by the site owner, not in code):
// 1. Netlify dashboard -> Site settings -> Environment variables
//    Add: STRIPE_WEBHOOK_SECRET = whsec_xxx
// 2. Stripe dashboard -> Developers -> Webhooks -> Add endpoint
//    URL: https://olcorp.ca/.netlify/functions/stripe-webhook
//    Event to send: checkout.session.completed
//    Copy the "Signing secret" shown after creating the endpoint into step 1.

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");
const { sendConfirmationEmail } = require("./_shared/checklist-pdf");

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  const signedPayload = timestamp + "." + rawBody;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch (e) {
    return false;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: "STRIPE_WEBHOOK_SECRET is not configured on this site." };
  }

  const sigHeader = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.body || "";

  if (!verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: "Invalid Stripe signature." };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body." };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    // Acknowledge and ignore any other event types Stripe might send.
    return { statusCode: 200, body: "ignored" };
  }

  const session = stripeEvent.data && stripeEvent.data.object;
  const submissionId = session && session.metadata && session.metadata.submissionId;

  if (!submissionId) {
    // Nothing to email -- the checkout succeeded but had no linked submission
    // (e.g. an old session created before this feature existed).
    return { statusCode: 200, body: "no submissionId on session" };
  }

  try {
    const store = getStore("rental-submissions");
    const submission = await store.get(submissionId, { type: "json" });
    if (submission) {
      await sendConfirmationEmail(submission);
      await store.delete(submissionId);
    }
  } catch (e) {
    // Stripe retries webhooks on non-2xx, but a failed email send shouldn't
    // cause Stripe to think the webhook itself failed -- log-and-acknowledge.
    console.error("stripe-webhook email error:", e.message);
  }

  return { statusCode: 200, body: "ok" };
};
