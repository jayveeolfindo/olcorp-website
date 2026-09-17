// Netlify Function: resolves a short olcorp.ca/l/<id> link (created by
// create-short-link.js) and 301-redirects to the full URL it stands for.
//
// Unlike the one-time intake-prefill links elsewhere in this repo, a
// short link is meant to be opened more than once (a client may reopen an
// emailed contract link several times before signing), so this does NOT
// delete on read -- it just looks the id up and redirects every time.
//
// The id is forwarded from _redirects as a trailing PATH segment
// (/l/* -> /.netlify/functions/go/:splat), not a query string param --
// Netlify's :splat/:id substitution into a destination query string was
// unreliable in testing. The old ?id= query param is kept as a fallback
// for direct testing.

function getShortLinkStore() {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "short-links", siteID, token });
  }
  return getStore("short-links");
}

exports.handler = async function (event) {
  const pathId = (event.path || "").replace(/^\/.netlify\/functions\/go\/?/, "").trim();
  const id = pathId || (event.queryStringParameters && event.queryStringParameters.id);
  if (!id) {
    return { statusCode: 400, body: "Missing id" };
  }

  let record;
  try {
    const store = getShortLinkStore();
    record = await store.get(id, { type: "json" });
  } catch (err) {
    // Temporary diagnostic: surface exactly what happened rather than a
    // bare 502, so we can see whether this is an id-parsing issue or a
    // Blobs-context issue when invoked via the /l/* redirect vs directly.
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        debug: true,
        id,
        eventPath: event.path,
        rawUrl: event.rawUrl || null,
        hasSiteEnv: !!process.env.BLOBS_SITE_ID,
        hasTokenEnv: !!process.env.BLOBS_TOKEN,
        errMessage: err && err.message,
      }),
    };
  }

  if (!record || !record.url) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: "<!doctype html><meta charset='utf-8'><title>Link not found</title><body style='font-family:sans-serif;padding:40px;text-align:center;color:#333;'><h2>This link isn't valid</h2><p>It may have been mistyped. Please check with Olcorp.ca for the correct link.</p></body>",
    };
  }

  return {
    statusCode: 301,
    headers: { Location: record.url, "Cache-Control": "no-store" },
  };
};
