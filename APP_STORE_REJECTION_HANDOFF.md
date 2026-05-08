# App Store Rejection — Handoff Notes

Document for whoever is helping with the Apple Developer / D-U-N-S / email setup work.

---

## What happened

Titra Health: GLP-1 Tracker (v1.0.0, build 31) was submitted to the App Store and **rejected on May 6, 2026**. Apple cited four separate issues. We're working through them in order.

- **Submission ID:** `f3cd7a34-cd3f-4bf3-bd3b-d280be24d401`
- **Apple Developer account holder:** Ibrahim Mohammad
- **Apple ID on file:** `ibm7862@gmail.com`
- **Current account type:** Individual

## The four rejection issues

| # | Guideline | Issue | Type |
|---|-----------|-------|------|
| 1 | 1.4.1 Safety: Physical Harm | Medical info in the app needs citations / sources | In-app code work |
| 2 | 4.1(a) Design: Copycats | App Store metadata references Ozempic / Wegovy / Zepbound (trademarks) | App Store Connect listing copy |
| 3 | **5.1.1(ix) Privacy: Data Collection** | **Apple Dev account must be Organization, not Individual** — currently blocking | **Account/legal — what this doc is about** |
| 4 | 5.1.1(i) / 5.1.2(i) Privacy: Data Use | App sends data to third-party AI (OpenAI, FatSecret) without consent UI or proper privacy-policy disclosure | In-app code + privacy policy work |

Issues 1, 2, and 4 are tracked separately and will be handled after #3 unblocks.

---

## Issue #3 — Apple Developer account conversion (FOCUS OF THIS DOC)

Apple requires an Organization-tier Apple Developer Program account for apps that handle regulated/sensitive health data. The Individual account that's currently in place does not meet 5.1.1(ix). We need to convert it to an Organization account under **Titra Health LLC**.

### What we have ready

- ✅ **Titra Health LLC is formed** (Georgia, effective 04/09/2026)
  - Control Number: `26084283`
  - Legal name: `Titra Health LLC`
  - Business address: `1480 Wrightsboro Rd, Augusta, GA 30901`
  - Registered agent / organizer / member: Ibrahim Mohammad
- ✅ **Certificate of Organization** (PDF, downloaded from GA SoS)
- ✅ **Articles of Organization** (PDF, same file)
- ✅ Decision made: convert the existing Individual account rather than open a new Org account (preserves Team ID, app records, TestFlight builds, bundle ID)
- ✅ Apple Developer Support page reached: contact form selected → **Membership → Program Enrollment** is the right subtopic. The "Send us a message" form is open.

### What's still missing (all needed before/during the support request)

1. ❌ **EIN (federal tax ID)** — LLC was just formed 04/09/2026; almost certainly no EIN has been applied for yet.
   - Apply at: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
   - Free, ~10 min, EIN issued instantly at end of online application
   - **CRITICAL:** save the CP 575 PDF that appears on the final page — it is shown only once. If you miss it, you have to call IRS Business & Specialty Tax Line (800-829-4933) for a 147C replacement letter.
   - Only the LLC member/manager can apply. Must be done in one sitting.

2. ❌ **D-U-N-S Number** for Titra Health LLC — required by Apple for Organization enrollment.
   - Look up / request at: https://developer.apple.com/enroll/duns-lookup
   - Use legal name "Titra Health LLC" + business address `1480 Wrightsboro Rd, Augusta, GA 30901`
   - Brand-new LLC will not be in D&B yet → request a new D-U-N-S via the same form
   - Free, but takes 1–14 days. **Start this in parallel with the Apple support message** so the clock is running.

3. ❌ **Company-domain email address** — needed for the Apple D-U-N-S request form.
   - **THIS IS THE CURRENT BLOCKER.** The D-U-N-S request form rejects Gmail addresses. It requires an email at the company's own domain.
   - We own `titrahealth.io` (registered, but where DNS is hosted needs to be confirmed).
   - We do **not** want to pay for Google Workspace. Free options below.

### Free email-on-domain options for `titrahealth.io`

Recommended for fastest unblock:

- **ImprovMX (free email forwarding)** — https://improvmx.com
  - Forwards `ibrahim@titrahealth.io` → existing Gmail (`ibm7862@gmail.com`)
  - Just add 2 MX records to wherever DNS is hosted; works without moving DNS
  - 25 aliases free on one domain
  - Setup time: ~10 min + DNS propagation (5–15 min)
  - **Receive-only is sufficient for the Apple/D&B verification email** — you do NOT need to send from the address to complete D-U-N-S

Alternatives if richer email is wanted:

- **Cloudflare Email Routing** — free forwarding, but requires moving DNS to Cloudflare first
- **Zoho Mail Free tier** — actual webmail/IMAP, up to 5 users, custom domain, ~30 min setup
- **iCloud+ Custom Email Domain** — $0.99/mo if not already paying for iCloud+, real send/receive

### Address mismatch to be aware of

The current Apple Developer account is registered to Ibrahim's **personal address** (435 Hendron Pl, Johns Creek, GA 30005). The LLC's principal office is in **Augusta** (1480 Wrightsboro Rd). When Apple converts the account to Organization, the address on file needs to update to the LLC's business address. **Do not change it preemptively** — let Apple drive the address update as part of the conversion process.

---

## Recommended order of operations

1. **Set up `ibrahim@titrahealth.io`** via ImprovMX (or equivalent). Verify it can receive a test email.
2. **Apply for the EIN** at irs.gov. Save the CP 575 PDF.
3. **Submit the D-U-N-S request** via Apple's lookup tool, using the new `@titrahealth.io` email.
4. **Send the Apple Developer Support message** (draft below). Don't wait on D-U-N-S to come back — mention the request is in progress so Apple's clock starts running.
5. When Apple replies, provide whatever they ask for: Articles of Organization, Certificate of Organization, EIN letter, D-U-N-S number.
6. After conversion, redo the Paid Apps Agreement under the LLC + business bank account.

---

## Apple Developer Support message draft

To paste into the "Send us a message" form on developer.apple.com:

> Hello Apple Developer Support,
>
> I'm writing to request that my Apple Developer Program account be converted from an Individual enrollment to an Organization enrollment under my existing legal entity, **Titra Health LLC**.
>
> **Account details:**
> - Apple Account: ibm7862@gmail.com
> - Current enrollment: Individual (Ibrahim Mohammad)
> - Desired enrollment: Organization — Titra Health LLC
>
> **Reason for the request:**
> My app, **Titra Health: GLP-1 Tracker** (version 1.0.0, build 31), was reviewed on May 6, 2026 and rejected under Guideline 5.1.1(ix). The reviewer indicated that apps offering highly regulated services or handling sensitive user data must be submitted through an Organization-enrolled account. The original rejection submission ID is **f3cd7a34-cd3f-4bf3-bd3b-d280be24d401**.
>
> Titra Health LLC is the legal entity that owns and operates this app, and I would like to bring the Apple Developer account into alignment with that entity so I can address the 5.1.1(ix) issue and resubmit the app.
>
> **Documents I have ready:**
> - Titra Health LLC Articles of Organization (Georgia, Control # 26084283, effective 04/09/2026)
> - Certificate of Organization issued by the Georgia Secretary of State
> - IRS EIN confirmation letter (CP 575) — *update this line based on whether EIN is in hand by send time*
> - D-U-N-S Number request submitted to Dun & Bradstreet via Apple's lookup tool — *update if number is already issued*
>
> I'd like to keep my existing Team ID, app records, TestFlight builds, and bundle identifier intact through this transition if possible. Please let me know the next steps and what additional documentation you'd like me to send.
>
> Thank you for your help.
>
> Best regards,
> Ibrahim Mohammad
> Titra Health LLC

Adjust the "Documents I have ready" lines to reflect what's actually in hand at the time of sending.

---

## Useful links / contact info

- Apple Developer Support contact: https://developer.apple.com/contact/
- D-U-N-S lookup / request: https://developer.apple.com/enroll/duns-lookup
- IRS EIN online application: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
- IRS Business & Specialty Tax Line (for 147C replacement EIN letter): 800-829-4933 (Mon–Fri 7am–7pm local time)
- Georgia Secretary of State business records: https://ecorp.sos.ga.gov
- ImprovMX: https://improvmx.com
- Cloudflare Email Routing docs: https://developers.cloudflare.com/email-routing/
- Zoho Mail Free: https://www.zoho.com/mail/zohomail-pricing.html

## Files in the project relevant to this work

- `/Users/ibrahimmohammad/Downloads/31352670 (1).pdf` — Certificate + Articles of Organization (download to a safer location and rename, e.g. `titra-health-llc-articles.pdf`)
- This file: `APP_STORE_REJECTION_HANDOFF.md` — the doc you're reading
