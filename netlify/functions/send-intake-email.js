// Netlify Function: called directly by the browser when a client finishes
// the Client Information intake form. The PDF is already built client-side
// (via jsPDF, see intake.html) — this function just relays it through Resend
// so Olcorp gets the completed form by email and the client gets an
// automatic confirmation copy, instead of the client having to download the
// file and upload it to a shared drive manually.

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

  const clientName = payload.clientName || "";
  const clientEmail = payload.clientEmail || "";
  const pdfBase64 = payload.pdfBase64 || "";
  const filename = payload.pdfFileName || "Client Information.pdf";

  if (!pdfBase64) {
    return { statusCode: 400, headers: cors, body: "Missing pdfBase64" };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return {
      statusCode: 500,
      headers: cors,
      body: "RESEND_API_KEY is not configured on this site.",
    };
  }
  const from = process.env.RESEND_FROM_EMAIL || "Olcorp.ca <onboarding@resend.dev>";

  const signatureHtml =
    "<p style=\"margin-top:22px;\">Warm regards,</p>" +
    "<p style=\"margin:0;\">Olcorp.ca Team<br>" +
    "Olfindo Immigration Consulting Corporation<br>" +
    "<a href=\"mailto:consulting@olcorp.ca\">consulting@olcorp.ca</a></p>";

  async function sendViaResend(emailPayload) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });
    return resp;
  }

  try {
    // 1) Notify Olcorp with the completed form attached — this is the
    //    record of truth, so it must succeed or the whole request fails.
    const staffResp = await sendViaResend({
      from: from,
      to: ["consulting@olcorp.ca"],
      subject: "New Client Intake — " + (clientName || "Unnamed Applicant"),
      html:
        "<p>A new Client Information Form was submitted" +
        (clientName ? " by " + clientName : "") +
        (clientEmail ? " (" + clientEmail + ")" : "") +
        ".</p><p>The completed PDF is attached.</p>",
      attachments: [{ filename: filename, content: pdfBase64 }],
    });
    if (!staffResp.ok) {
      const errText = await staffResp.text();
      throw new Error("Resend API error (staff email): " + errText);
    }

    // 2) Confirm with the client, if they gave an email address — attach a
    //    copy for their own records too. Best-effort: if this fails, Olcorp
    //    already has the form, so we don't fail the whole request over it.
    let clientEmailSent = false;
    if (clientEmail) {
      try {
        const firstName = (clientName || "").trim().split(/\s+/)[0] || "there";
        const clientResp = await sendViaResend({
          from: from,
          to: [clientEmail],
          subject: "We received your Client Information Form — Olcorp.ca",
          html:
            "<p>Hi " + firstName + ",</p>" +
            "<p>Thank you so much for taking the time to complete your Client Information Form — we really appreciate it! We've received everything safely, and a copy is attached for your own records.</p>" +
            "<p>Our team will carefully review your information, and we'll reach out if anything needs a little more detail or clarification. In the meantime, if you have any questions at all, please don't hesitate to get in touch.</p>" +
            signatureHtml,
          attachments: [{ filename: filename, content: pdfBase64 }],
        });
        clientEmailSent = clientResp.ok;
      } catch (e) {
        clientEmailSent = false;
      }
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, clientEmailSent: clientEmailSent }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: cors,
      body: JSON.stringify({ ok: false, error: String((e && e.message) || e) }),
    };
  }
};
