/**
 * Bound to a pre-test or post-test Google Form. One copy per form — Apps
 * Script is attached to a single form, so the pre-test and post-test forms
 * each need their own, differing only in QUESTIONNAIRE_TYPE.
 *
 * Setup, in this order:
 *   1. Add the two required questions to the form (see REQUIRED QUESTIONS).
 *   2. Extensions > Apps Script, paste this in, set QUESTIONNAIRE_TYPE.
 *   3. Triggers (clock icon) > Add Trigger > onSubmit / From form /
 *      On form submit.
 *   4. Submit one test response and check the execution log says matched:true.
 *   5. Only then set FORM_SECRET here and FORM_SHARED_SECRET on the server.
 *      Doing 5 before the server has the value rejects live submissions.
 *
 * REQUIRED QUESTIONS — add both, and mark both required:
 *
 *   "Reference Code"   short answer      the couple's code
 *   "Gender"           multiple choice   options: Male / Female
 *
 * These are the same titles and the same options the intake form already uses,
 * which is why they are the recommendation — one convention across all three
 * forms, and "Gender" is what the app keys partners on internally.
 *
 * The reference code says which couple; the gender answer says which of them.
 * A phone question ("Tel. No") is optional and used only as a cross-check.
 *
 * Titles are matched with spaces, full stops, apostrophes, question marks and
 * slashes ignored, and case ignored, so "Tel. No" and "TelNo" are the same
 * thing. "Are you the husband or wife?" is accepted in place of "Gender", with
 * answers Husband / Wife, if that reads better on the form.
 */

const QUESTIONNAIRE_TYPE = "pre-test"; // "pre-test" on one form, "post-test" on the other

// Wherever the API is deployed, including /api/v1 and no trailing slash.
// Update this in every bound script if the API moves.
const BASE_URL = "https://your-api-host.example.com/api/v1";
const POST_URL = BASE_URL + "/questionnaire/" + QUESTIONNAIRE_TYPE;

// Must equal FORM_SHARED_SECRET on the server. Leave "" until the server has
// the same value — see step 5 above.
const FORM_SECRET = "";

// Hosts that sleep when idle are slow to answer the first request after a
// quiet spell, and any host has the occasional blip. Retrying a few times with
// a growing pause covers both. A response is never lost outright — Google
// Forms keeps its own copy — but a failure here means it does not reach the
// app until someone replays it.
const MAX_ATTEMPTS = 4;
const FIRST_BACKOFF_MS = 4000;

function onSubmit(e) {
  const latestResponse =
    e && e.response ? e.response : FormApp.getActiveForm().getResponses().pop();

  const itemResponses = latestResponse.getItemResponses();
  const payload = {};
  for (let i = 0; i < itemResponses.length; i++) {
    payload[itemResponses[i].getItem().getTitle()] = itemResponses[i].getResponse();
  }

  const result = postWithRetry(payload);
  const code = result.getResponseCode();
  const body = result.getContentText();

  if (code >= 300) {
    throw new Error("Submission failed: " + code + " " + body);
  }

  // The endpoint always stores the submission; `matched` says whether it
  // reached a specific person. An unmatched one is sitting in the dashboard's
  // outstanding queue waiting to be attached by hand, so it is worth noticing.
  let parsed = {};
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    parsed = {};
  }

  if (parsed.matched === false) {
    Logger.log(
      "Stored but NOT attached to a person (reason: " +
        (parsed.reason || "unknown") +
        "). Resolve it in the dashboard under Outstanding submissions."
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

    // 2xx is done. 4xx is our mistake — a bad payload or a wrong secret — and
    // will fail identically next time, so retrying only delays the error.
    // Only 5xx and rate limiting are worth another go.
    if (code < 300) return lastResult;
    if (code < 500 && code !== 429) return lastResult;
  }

  return lastResult;
}
