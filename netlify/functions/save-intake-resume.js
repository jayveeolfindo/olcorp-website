// Netlify Function: saves (or updates) the client's own in-progress intake
// form data in Netlify Blobs, so "Save & Continue Later" can hand back a
// reusable link instead of a JSON file the client has to keep and
// re-upload. Unlike save-intake-prefill.js (one-time, internal-tool-only),
// this record is meant to be read AND re-saved many times as the client
// works through the form, so get-intake-resume.js does NOT delete it on
// read. Each record expires 60 days after its most recent save.

const crypto = require("crypto");

function getResumeStore() {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "intake-resume", siteID, token });
  }
  return getStore("intake-resume");
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

  const store = getResumeStore();

  // Reuse the same id across saves (upsert) so one link keeps working;
  // only mint a new one the first time, or if the given id doesn't exist.
  let id = typeof payload.id === "string" && payload.id ? payload.id : null;
  if (id) {
    const existing = await store.get(id, { type: "json" });
    if (!existing) id = null;
  }
  if (!id) {
    id = crypto.randomBytes(24).toString("hex");
  }

  const record = {
    __olcorpIntakeSave: true,
    version: 1,
    recordId: payload.recordId || null,
    stepIndex: typeof payload.stepIndex === "number" ? payload.stepIndex : 0,
    data: payload.data,
    updatedAt: new Date().toISOString(),
  };

  await store.setJSON(id, record);

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ id: id }),
  };
};
