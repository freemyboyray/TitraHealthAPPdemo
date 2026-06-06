Thank you for the feedback. You are correct that the app uses a third-party AI service (OpenAI). In this build we have changed the app so that it now discloses this, identifies the recipient, and obtains the user's explicit permission before any data is sent.

What data is sent, and to whom: When a user uses an AI feature, the data for that feature is sent to OpenAI, a third-party AI provider, over an encrypted connection:

- Ask AI and personalized insights: the user's message plus a wellness-context snapshot (medication, dose, weight progress, scores, side effects).
- Describe Food and conversational food logging: the food description text.
- Capture Food: the meal photo.
- Voice logging: the audio recording, transcribed by OpenAI Whisper.

The user's name, email, and account ID are never sent.

How we changed permission handling: Previously, AI processing was enabled as part of accepting the terms. We have removed that entirely. The terms screen now covers only the Terms of Service and Privacy Policy. Everything about AI, including the full AI disclosure and the consent choice, now lives on its own dedicated screen, separate from terms acceptance. The app obtains explicit, separate permission before sending any data, in two places. First, during onboarding, a dedicated "Enable AI features?" screen presents what is sent and to whom, links to the full AI disclosure, and requires the user to actively tap "Allow." It defaults to off, and declining is non-blocking, so all core tracking features work without AI. Second, the first time a user taps any AI feature, a consent dialog naming OpenAI appears, and the request only proceeds if the user taps "Allow."

No data is sent to OpenAI unless the user has granted this consent. Consent can be reviewed or revoked at any time in Settings, under Privacy and Data. If a user has AI turned off and then uses an AI feature, the same consent dialog appears, and nothing is sent unless they tap "Allow."

Privacy policy and data protection: Our privacy policy and in-app AI disclosure identify the data the app collects, how it is collected, all uses of that data, and that it is shared with OpenAI. They also confirm OpenAI's protections: under OpenAI's API data-usage policy, the data we send is not used to train its models and is deleted within 30 days on the standard API tier. This is stated both in the app, on the AI consent screen and in the AI disclosure, and in our privacy policy: https://titrahealth.io/privacy-policy
