// Netlify Function: creates a Stripe Checkout Session for a dynamic amount
// and returns the hosted checkout URL for the browser to redirect to.
//
// Setup required (done by the site owner, not in code):
// Netlify dashboard -> Site settings -> Environment variables
// Add: STRIPE_SECRET_KEY = sk_live_xxx (or sk_test_xxx while testing)
//
// No npm dependencies -- talks to Stripe's REST API directly with fetch,
// so no package.json / node_modules bundling is required for this file.
// (submissionId below is passed through as Checkout Session metadata so
// stripe-webhook.js can look up the full submission once payment succeeds.)

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

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
return {
statusCode: 500,
headers: cors,
body: JSON.stringify({
error:
"STRIPE_SECRET_KEY is not configured on this site. Add it under Netlify Site settings > Environment variables.",
}),
};
}

let payload;
try {
payload = JSON.parse(event.body || "{}");
} catch (e) {
return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON body" }) };
}

const amount = Number(payload.amount);
const clientName = (payload.clientName || "Client").toString().slice(0, 120);
const description = (payload.description || "Vehicle rental balance").toString().slice(0, 200);
const email = (payload.email || "").toString().slice(0, 200);
const submissionId = (payload.submissionId || "").toString().slice(0, 100);

if (!amount || isNaN(amount) || amount <= 0 || amount > 50000) {
return {
statusCode: 400,
headers: cors,
body: JSON.stringify({ error: "Invalid amount." }),
};
}

const unitAmountCents = Math.round(amount * 100);
const siteUrl = process.env.URL || "https://olcorp.ca";

const params = new URLSearchParams();
params.append("mode", "payment");
params.append("success_url", `${siteUrl}/turnover?paid=1`);
params.append("cancel_url", `${siteUrl}/turnover?paid=0`);
params.append("line_items[0][quantity]", "1");
params.append("line_items[0][price_data][currency]", "cad");
params.append(
"line_items[0][price_data][product_data][name]",
`Vehicle Rental Balance - ${clientName}`
);
params.append("line_items[0][price_data][product_data][description]", description);
params.append("line_items[0][price_data][unit_amount]", String(unitAmountCents));
if (email) params.append("customer_email", email);
if (submissionId) params.append("metadata[submissionId]", submissionId);

try {
const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
method: "POST",
headers: {
Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
"Content-Type": "application/x-www-form-urlencoded",
},
body: params.toString(),
});

const data = await resp.json();

if (!resp.ok) {
return {
statusCode: 502,
headers: cors,
body: JSON.stringify({ error: (data.error && data.error.message) || "Stripe error creating session." }),
};
}

return {
statusCode: 200,
headers: cors,
body: JSON.stringify({ url: data.url }),
};
} catch (err) {
return {
statusCode: 500,
headers: cors,
body: JSON.stringify({ error: "Could not reach Stripe. Try again." }),
};
}
};
