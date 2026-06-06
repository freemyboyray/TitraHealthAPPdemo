# App Review Reply — Guideline 5.1.1(i) / 5.1.2(i) (Third-Party AI Data)

Two things to do in App Store Connect for the next submission:

1. Paste the **Reviewer Reply** below into the Resolution Center thread.
2. Paste the **App Review Information → Notes** text so the reviewer can find the consent flow.

---

## Reviewer Reply (Resolution Center)

> Thank you for the feedback. The app does use a third-party AI service (OpenAI), and we have revised the app to disclose this, identify the recipient, and obtain explicit user permission before any data is sent.
>
> **What data is sent and to whom:** When a user uses an AI feature, the data for that feature is sent to OpenAI (a third-party AI provider) over an encrypted connection:
> - Ask AI / personalized insights: the user's message plus a wellness-context snapshot (medication, dose, weight progress, scores, side effects).
> - Describe Food / conversational food logging: the food description text.
> - Capture Food: the meal photo.
> - Voice logging: the audio recording (transcribed by OpenAI Whisper).
>
> The user's name, email, and account ID are never sent.
>
> **Permission is obtained before sending data, in two places:**
> 1. During onboarding, a dedicated "Enable AI features?" screen explains exactly what is sent and to whom, and requires the user to actively tap **Allow**. It defaults to OFF, and declining is non-blocking — all core tracking features work without AI.
> 2. The first time a user taps any AI feature, a consent dialog naming OpenAI appears and the request only proceeds if the user taps **Allow**.
>
> No data is sent to OpenAI unless the user has granted this consent. Consent can be reviewed or revoked anytime in Settings → Privacy & Data.
>
> **Privacy policy:** Our privacy policy and in-app AI Disclosure identify the data collected, how it is collected, all uses of that data, and that it is shared with OpenAI. Privacy policy: https://titrahealth.io/privacy-policy

---

## App Review Information → Notes

> AI features (Ask AI, Describe Food, Capture Food, voice logging) send data to OpenAI only after the user grants consent. To see the consent flow: complete onboarding (an "Enable AI features?" screen appears with Allow / Not now), or tap any AI feature for the first time to trigger the consent dialog. AI consent can also be toggled in Settings → Privacy & Data. Declining AI consent leaves all core tracking features fully functional.

---

## Implementation reference (for our records, not for Apple)

- Explicit onboarding opt-in: `app/onboarding/ai-consent.tsx` (default OFF).
- Point-of-first-use prompt: `lib/ai-consent.ts` `ensureAiConsent()` + `components/ai-consent-modal.tsx`, wired into Ask AI, voice, Describe Food, and conversational food logging.
- Hard backstop (no data leaves without consent): `requireAiConsent()` in `lib/openai.ts` (all GPT calls) and `lib/whisper.ts` (voice).
- Terms screen no longer auto-grants AI consent (`app/onboarding/terms.tsx`).
- Settings disclosure corrected to accurately state what is sent (`app/settings/privacy.tsx`).
