// Netlify Function: mints a short olcorp.ca/l/<id> link that redirects to
// a full olcorp.ca URL (e.g. a service-contract.html link carrying a
// client's name/address/phone/email as query params).
//
// This exists specifically so those links never have to go through a
// third-party shortener (TinyURL, Bitly, etc.) -- that would mean handing
// a client's personal information to a service with no reason to see it.
// Everything here stays on olcorp.ca's own infrastructure.
//
// Internal tool only, not called by any public-facing page: gated by
// SHORTLINK_SECRET so this can't be abused as a free open-redirect host.
// Only olcorp.ca URLs are accepted, for the same reason.

const crypto = require("crypto");

function getShortLinkStore() {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "short-links", siteID, token });
  }
  return getStore("short-links");
}

// Base62, no padding -- short, readable, URL-safe without encoding.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

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

  if (!process.env.SHORTLINK_SECRET) {
    return { statusCode: 500, headers: cors, body: "Short link creation is not configured" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: cors, body: "Invalid JSON" };
  }

  if (payload.secret !== process.env.SHORTLINK_SECRET) {
    return { statusCode: 401, headers: cors, body: "Unauthorized" };
  }

  const url = payload.url;
  if (!url || typeof url !== "string" || !/^https:\/\/([a-z0-9-]+\.)?olcorp\.ca\//i.test(url)) {
    return { statusCode: 400, headers: cors, body: "url must be a full https://olcorp.ca/... link" };
  }

  const store = getShortLinkStore();

  // Optional update-in-place: if the caller passes the id of an existing
  // short link (e.g. a client detail was corrected after the link was
  // already sent out), overwrite that record's target URL instead of
  // minting a new id -- so the link the client already has keeps working
  // and now points at the corrected contract.
  let id = typeof payload.id === "string" ? payload.id.trim() : "";
  let createdAt = new Date().toISOString();
  if (id) {
    const existing = await store.get(id, { type: "json" });
    if (!existing) {
      return { statusCode: 404, headers: cors, body: "No existing short link with that id" };
    }
    createdAt = existing.createdAt || createdAt;
  } else {
    // Collision check is a formality at this id length, but cheap insurance.
    for (let attempt = 0; attempt < 5; attempt++) {
      id = randomId(7);
      const existingCheck = await store.get(id);
      if (!existingCheck) break;
    }
  }

  await store.setJSON(id, { url, createdAt, updatedAt: new Date().toISOString() });

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ id, shortUrl: `https://olcorp.ca/l/${id}` }),
  };
};
