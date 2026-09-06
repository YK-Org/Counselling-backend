/**
 * Bound to the intake (personal history) Google Form.
 *
 * This is the existing script with two changes: it retries a failed post, and
 * it logs when a submission was stored but could not be attached to a couple.
 * The payload it sends is unchanged, so it is a drop-in replacement.
 *
 * Setup:
 *   1. Extensions > Apps Script, replace the contents with this.
 *   2. Triggers > On form submit, if not already set.
 *   3. Submit a test response; the log should say matched:true.
 *   4. Only then set FORM_SECRET here and FORM_SHARED_SECRET on the server.
 *      Setting the server value first rejects live submissions.
 *
 * The form's "Reference Code" question is what attaches a submission to the
 * couple it belongs to. Without it, matching falls back to the phone number
 * and lands in the dashboard queue whenever that does not resolve.
 */

// Wherever the API is deployed. Update this in every bound script if it moves.
const POST_URL = "https://your-api-host.example.com/api/v1/couples/details";

// Must equal FORM_SHARED_SECRET on the server. Leave "" until the server has
// the same value — see step 4 above.
const FORM_SECRET = "";

// Hosts that sleep when idle are slow to answer the first request after a
// quiet spell, and any host has the occasional blip. Google Forms keeps its own
// copy of every response, so nothing is lost outright — but without a retry the
// submission does not reach the app until someone replays it by hand.
const MAX_ATTEMPTS = 4;
const FIRST_BACKOFF_MS = 4000;

function onSubmit(e) {
  const latestResponse =
    e && e.response ? e.response : FormApp.getActiveForm().getResponses().pop();

  const response = latestResponse.getItemResponses();
  const payload = {};
  for (let i = 0; i < response.length; i++) {
    payload[response[i].getItem().getTitle()] = response[i].getResponse();
  }

  const result = postWithRetry(payload);
  const code = result.getResponseCode();
  const body = result.getContentText();

  if (code >= 300) {
    throw new Error("Submission failed: " + code + " " + body);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    parsed = {};
  }

  if (parsed.matched === false) {
    Logger.log(
      "Stored but NOT attached to a couple. Resolve it in the dashboard " +
        "under Outstanding submissions."
    );
  } else {
    Logger.log("Attached successfully: " + body);
  }
}

function postWithRetry(payload) {
  let lastResult = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      Utilities.sleep(FIRST_BACKOFF_MS * Math.pow(2, attempt - 1));
    }

    lastResult = UrlFetchApp.fetch(POST_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: FORM_SECRET ? { "X-Form-Secret": FORM_SECRET } : {},
      muteHttpExceptions: true,
    });

    const code = lastResult.getResponseCode();

    // 4xx will fail the same way next time — a bad payload or a wrong secret —
    // so only 5xx and rate limiting are worth retrying.
    if (code < 300) return lastResult;
    if (code < 500 && code !== 429) return lastResult;
  }

  return lastResult;
}
