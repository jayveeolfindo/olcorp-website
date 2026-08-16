// Netlify Function: retrieves a client's saved-progress intake record,
// stored by save-intake-resume.js. Unlike get-intake-prefill.js (one-time
// use, deletes on read), this record is NOT deleted -- a resume link
// (intake.html?resume=<id>) is meant to be reopened, re-saved, and reopened
// again as many times as the client needs. It expires 60 days after its
// most recent save (see save-intake-resume.js's `updatedAt`).

const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

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

  const store = getResumeStore();
  const record = await store.get(id, { type: "json" });

  if (!record) {
    return { statusCode: 404, headers: cors, body: "Not found" };
  }

  const updatedAtMs = record.updatedAt ? new Date(record.updatedAt).getTime() : 0;
  const expired = !updatedAtMs || Date.now() - updatedAtMs > MAX_AGE_MS;
  if (expired) {
    return { statusCode: 410, headers: cors, body: "This link has expired" };
  }

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify(record),
  };
};
