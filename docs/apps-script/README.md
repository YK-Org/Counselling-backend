# Google Form integration

Three Google Forms feed this app, each with its own bound Apps Script:

| Form | Script | Endpoint |
| --- | --- | --- |
| Intake / personal history | `intake-form.gs` | `POST /couples/details` |
| Pre-test questionnaire | `questionnaire.gs` (`QUESTIONNAIRE_TYPE = "pre-test"`) | `POST /questionnaire/pre-test` |
| Post-test questionnaire | `questionnaire.gs` (`QUESTIONNAIRE_TYPE = "post-test"`) | `POST /questionnaire/post-test` |

The scripts live in Google, not in this repository. These copies are the
reference — if you change one in the Apps Script editor, update it here too, or
the next person will not know what is actually running.

## How a submission finds its owner

A Google Form cannot identify who is answering it, so the form has to carry the
identity itself. Two facts are needed, and they come from two questions.

**Which couple** — the reference code, generated when the couple is registered
and given to both partners. `INTAKE_FORM_PREFILL_URL` produces a link with it
already filled in, so nobody has to copy it by hand.

**Which partner** — the gender question. Gender is what the app uses to tell
partners apart everywhere else: registration creates one male and one female
slot, and the pre/post comparison table is built by finding each of them. The
intake form already asks it, titled `Gender` with options Male / Female, so use
the same on the questionnaire forms. A phone question, if the form has one, is
used only to cross-check.

If the code and the phone point at different people, the submission is **not**
guessed at — it goes to the dashboard's outstanding queue for someone to
resolve. Attributing one spouse's answers to the other is worse than asking.

## Question titles

The payload is keyed on question title, so titles are part of the interface.
Anything not recognised as an identifying field is stored as an answer.

Titles are compared with spaces, full stops, apostrophes, question marks and
slashes removed, and case ignored — so `Tel. No`, `TelNo` and `tel no` are one
and the same. The live intake form has questions titled `Tel. No` and
`Profession/Occupation`, which is why this matters.

Recognised titles, any one of which works:

| Meaning | Accepted titles |
| --- | --- |
| Reference code | `Reference Code`, `ReferenceCode`, `Couple Code` |
| Which partner | `Gender`, `Are you the husband or wife?`, `Which of you is filling this in?`, `Husband or Wife`, `Role` |
| Phone | `Contact`, `Phone`, `Phone Number`, `Tel. No` |
| Name | `Name`, `Full Name` |

Accepted answers to the gender question: `Male`, `Female`, `Husband`, `Wife`,
`Man`, `Woman`, `Groom`, `Bride` — case does not matter. Anything else is
treated as unanswered, and the submission falls back to the phone cross-check
or the queue.

## Make Reference Code required

On the live intake form, **Reference Code is not a required question** while
Tel. No and Gender are. A respondent who skips it falls back to phone matching,
which is what lands submissions in the queue. Marking it required — on the
intake form and on both questionnaires — removes most of that work, since every
couple is given a code at registration and the prefilled link fills it in.

Note that the **intake** form parses its questions through a fixed mapping
(`src/helpers/transformFormData.ts`) that expects its own exact titles.
Renaming a question on that form silently drops the answer. The questionnaire
forms have no such mapping — every unrecognised question simply becomes a
stored answer — so they are safe to reword.

## Turning on the shared secret

The endpoints these scripts post to are filled in by counsellees who have no
account, so they cannot sit behind a login. `FORM_SHARED_SECRET` is what stops
anyone who finds the URL from writing to them.

It **fails open**: while the server value is unset the endpoints accept
unauthenticated writes, and a warning is logged on every request. That is
deliberate, so that deploying cannot take a live form offline — but it means
the protection is off until the sequence below is finished.

1. Set `FORM_SECRET` in all three scripts to the same value and save.
2. Submit one test response to each form; confirm it still arrives.
3. Set `FORM_SHARED_SECRET` to that value on the server and restart.

The reverse order rejects real submissions in the gap between the two changes.

## When a submission does not arrive

Google Forms keeps its own copy of every response, so a failed post is never
lost — it just has not reached the app. Both scripts retry a few times with a
growing pause, which covers a sleeping host waking up or a transient blip.

If one still fails, the Apps Script owner gets a failure email. Open the form's
response sheet, and re-run the submission from the Apps Script editor, or
re-enter it in the dashboard.

Submissions that arrive but cannot be matched are not failures — they are
stored, and appear in **Outstanding submissions** on the head counsellor's
dashboard, where they can be attached to the right person.
