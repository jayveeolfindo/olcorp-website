// Netlify Function: retrieves a one-time-use intake prefill payload
// stored by save-intake-prefill.js, then immediately deletes it -- so a
// prefill link (intake.html?prefill=<id>) only ever works once, limiting
// exposure of the PII inside it if the link is later forwarded or leaked.
// Also expires (and refuses) anything older than 14 days, in case a link
// is never opened at all.

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function getPrefillStore() {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "intake-prefills", siteID, token });
  }
  return getStore("intake-prefills");
}

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: cors, body: "Method not allowed" };
  }

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, headers: cors, body: "Missing id" };
  }

  const store = getPrefillStore();
  const record = await store.get(id, { type: "json" });

  if (!record) {
    return { statusCode: 404, headers: cors, body: "Not found or already used" };
  }

  // One-time use: delete on read, regardless of whether it turns out to be expired.
  await store.delete(id);

  const createdAtMs = record.createdAt ? new Date(record.createdAt).getTime() : 0;
  const expired = !createdAtMs || Date.now() - createdAtMs > MAX_AGE_MS;
  if (expired) {
    return { statusCode: 410, headers: cors, body: "This link has expired" };
  }

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify(record),
  };
};
