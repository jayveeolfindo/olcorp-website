// Shared helper: opens the "rental-submissions" Netlify Blobs store.
//
// On this site, Netlify's automatic Blobs context injection isn't
// available at function runtime (getStore() throws "The environment has
// not been configured to use Netlify Blobs"). As a fallback, this helper
// passes siteID + token manually when they're present as environment
// variables:
//   BLOBS_SITE_ID  - this project's Site ID (not secret; Project
//                    configuration -> General -> Project ID / Site ID).
//   BLOBS_TOKEN    - a Netlify Personal Access Token with access to this
//                    site (secret; User settings -> OAuth applications ->
//                    Personal access tokens -> New access token).
//
// If automatic context ever starts working on its own, this transparently
// falls back to the zero-config getStore(name) call.

const { getStore } = require("@netlify/blobs");

function getSubmissionsStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "rental-submissions", siteID, token });
  }
  return getStore("rental-submissions");
}

module.exports = { getSubmissionsStore };
