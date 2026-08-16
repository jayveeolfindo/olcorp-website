// Netlify Function: stores a one-time-use intake prefill payload in
// Netlify Blobs, returned by an internal extraction tool (an old IMM 0008
// PDF's data mapped into intake.html's save-file JSON shape). Called by
// Jayvee's tooling, not by the public form itself.
//
// The returned id becomes a link: intake.html?prefill=<id>. That link is
// meant to be opened exactly once -- get-intake-prefill.js deletes the
// blob as soon as it's read, so the PII in it doesn't sit around or get
// reused if the link is ever forwarded again.

const crypto = require("crypto");

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
    return { statusCode: 400, headers: cors, body: "Invalid JSON" };
  }

  if (!payload || typeof payload !== "object" || !payload.data) {
    return { statusCode: 400, headers: cors, body: "Missing 'data'" };
  }

  const id = crypto.randomBytes(24).toString("hex");
  const record = {
    __olcorpIntakeSave: true,
    version: 1,
    recordId: payload.recordId || null,
    stepIndex: typeof payload.stepIndex === "number" ? payload.stepIndex : 0,
    data: payload.data,
    createdAt: new Date().toISOString(),
  };

  const store = getPrefillStore();
  await store.setJSON(id, record);

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ id: id }),
  };
};
