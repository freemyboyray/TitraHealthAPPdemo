# TitraHealth Privacy Policy

**Last Updated: April 8, 2026**

TitraHealth ("we," "our," or "the App") is a personal health companion application designed to help individuals track their GLP-1 medication journey. This Privacy Policy describes how we collect, use, store, and protect your information.

By using TitraHealth, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use the App.

---

## 1. Information We Collect

### 1.1 Account Information
When you create an account, we collect:
- Name
- Email address
- Password (stored as a salted hash; we never store plaintext passwords)

### 1.2 Health and Wellness Data
To provide personalized tracking, we collect data you voluntarily enter:
- **Medication information:** medication name, brand, dose, injection frequency, injection site, injection date/time, batch number
- **Body measurements:** height, weight, goal weight, starting weight
- **Food and nutrition logs:** food names, calorie and macronutrient data, meal descriptions, barcode scans
- **Activity logs:** exercise type, duration, steps, active calories
- **Side effect logs:** symptom type, severity, phase at time of logging
- **Weekly check-in responses:** self-reported scores across wellness domains (energy, mood, appetite, sleep quality, GI comfort, food noise, mental health)
- **Journal entries:** freeform text, guided prompts, thought records, and mood ratings you choose to enter
- **Mindfulness session completions:** session type, duration, and context
- **Hydration tracking:** daily water intake (stored locally on your device)

### 1.3 Device and Wearable Data
With your explicit permission, we may read data from:
- **Apple HealthKit (iOS):** steps, heart rate variability (HRV), resting heart rate, sleep duration, blood glucose, SpO2, weight, and nutritional data
- **Health Connect (Android):** equivalent metrics where available

We read this data to display health insights within the App. We do **not** write to or modify your HealthKit or Health Connect data except for weight and nutrition entries you explicitly log through TitraHealth.

### 1.4 Usage Data
We collect non-identifying usage data to improve the App:
- App screens visited and features used
- Crash reports and error logs
- Device type, operating system version, and app version

### 1.5 AI Interaction Data
When you use AI-powered features (food description, photo analysis, Ask AI chat, voice logging), your inputs are sent to our AI processing service to generate responses. We do not use your AI interaction data to train AI models. See Section 4 for details.

---

## 2. How We Use Your Information

We use your information to:
- Provide personalized health tracking, scoring, and insights
- Display your medication cycle phase and daily focus recommendations
- Generate educational content relevant to your treatment stage
- Power AI-assisted features (food logging, chat, voice input)
- Send medication reminders and notifications you have opted into
- Compute anonymized, aggregate peer comparison statistics (only if you opt in; see Section 5)
- Improve App functionality, fix bugs, and develop new features
- Comply with legal obligations

We do **not**:
- Sell your personal data to third parties
- Use your health data for advertising or marketing purposes
- Share individually identifiable health data with employers, insurers, or data brokers

---

## 3. Data Storage and Security

### 3.1 Where Your Data Is Stored
Your data is stored in a secure cloud database hosted by Supabase, Inc. on Amazon Web Services (AWS) infrastructure located in the United States. Hydration data is stored locally on your device.

### 3.2 Security Measures
- All data is encrypted in transit (TLS 1.2+) and at rest (AES-256)
- Row-Level Security (RLS) ensures that each user can only access their own data
- Authentication is handled via Supabase Auth with bcrypt password hashing
- Database access requires authenticated sessions with JWT tokens
- We conduct periodic security reviews of our infrastructure

### 3.3 Data Retention
- Your account data and health logs are retained as long as your account is active
- If you delete your account, all associated data is permanently deleted within 30 days
- Anonymized, aggregate data contributed to peer comparison (if you opted in) is retained in de-identified form after account deletion; it cannot be linked back to you
- AI interaction data is not stored beyond the duration of the request-response cycle

---

## 4. AI-Powered Features

TitraHealth uses third-party AI services (OpenAI) to power certain features:
- **Food description and photo analysis:** Your text descriptions or food photos are sent to OpenAI's API to estimate nutritional content
- **Ask AI chat:** Your messages and relevant health context (anonymized medication phase, scores, and recent log summaries) are sent to generate personalized responses
- **Voice logging:** Audio is transcribed via OpenAI's Whisper API, then processed for structured data extraction

**Important:**
- AI-generated nutritional estimates, insights, and responses are for **informational and educational purposes only** and do not constitute medical advice
- We send the minimum context necessary for each AI request
- OpenAI's data usage policy applies to data processed through their API. As of our last review, OpenAI does not use API inputs to train their models. Please refer to OpenAI's current privacy policy for the most up-to-date information.
- Your full health record is never sent to OpenAI — only the specific context relevant to each request

---

## 5. Peer Comparison Feature

TitraHealth offers an optional peer comparison feature that shows how your progress compares to other users on the same medication at a similar treatment stage.

### How It Works
- **Opt-in only:** You must explicitly join peer comparison. It is not enabled by default.
- **De-identification:** Your data is contributed to a materialized aggregate view that contains no user IDs, names, or other identifying information. Only medication type, dose tier (bucketed), treatment week (bucketed), and weight-loss percentage are included.
- **Minimum cohort size:** Comparisons are only displayed when at least 50 users share your cohort parameters, reducing re-identification risk.
- **What you see:** Percentile position and general progress context. No individual user's data is ever displayed.
- **Opt-out:** You can opt out at any time in Settings. Your data will be excluded from future aggregate calculations.

---

## 6. Third-Party Services

We use the following third-party services:

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Supabase (database, auth, edge functions) | Data storage, authentication, serverless functions | Account data, health logs, encrypted credentials |
| OpenAI (GPT-4o, Whisper) | AI food analysis, chat, voice transcription | Text prompts, food photos, audio recordings, anonymized health context |
| FatSecret Platform API | Food database search | Food search queries (no user identification) |
| Expo / EAS | App builds and over-the-air updates | Device type, app version, crash reports |
| Apple HealthKit / Health Connect | Wearable health data | Read-only access with your permission |

Each third-party service operates under its own privacy policy. We encourage you to review them.

---

## 7. Your Rights and Choices

### 7.1 Access and Export
You may request a copy of all data associated with your account by contacting us at privacy@titrahealth.com.

### 7.2 Deletion
You may delete your account and all associated data at any time through Settings > Delete Account, or by contacting us. Deletion is permanent and irreversible.

### 7.3 Correction
You may update or correct your profile information, health logs, and journal entries directly within the App at any time.

### 7.4 Opt-Out
- **Peer comparison:** Opt out at any time in Settings
- **Notifications:** Disable reminders in Settings or through your device's notification settings
- **HealthKit / Health Connect:** Revoke permissions through your device's Health settings at any time
- **AI features:** AI-powered features are optional; you may use manual logging exclusively

### 7.5 State-Specific Rights
- **California (CCPA/CPRA):** California residents have the right to know what data we collect, request deletion, and opt out of data sales. We do not sell personal information.
- **Washington (My Health My Data Act):** Washington residents have additional rights regarding consumer health data, including consent for collection, right to deletion, and restrictions on geofencing near healthcare facilities. We comply with these requirements.
- **Other states:** We respect and comply with applicable state privacy laws. Contact us for state-specific requests.

---

## 8. Children's Privacy

TitraHealth is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we learn that we have collected data from a user under 18, we will delete that data promptly.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the App or by email. Your continued use of the App after changes take effect constitutes acceptance of the updated policy.

---

## 10. Contact Us

If you have questions about this Privacy Policy or wish to exercise your rights, contact us at:

**Email:** privacy@titrahealth.com

---

*This privacy policy is provided for informational purposes and should be reviewed by qualified legal counsel before publication.*
