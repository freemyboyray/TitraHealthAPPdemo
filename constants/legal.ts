// ─── Legal Document Versions ─────────────────────────────────────────────────

export const TOS_VERSION = '1.1';
export const TOS_EFFECTIVE_DATE = 'May 4, 2026';

export const PRIVACY_VERSION = '1.1';
export const PRIVACY_EFFECTIVE_DATE = 'May 4, 2026';

export const AI_VERSION = '1.2';
export const AI_EFFECTIVE_DATE = 'May 9, 2026';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LegalSection = { title: string; body: string };

// ─── Terms of Service ────────────────────────────────────────────────────────

export const TOS_SECTIONS: LegalSection[] = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account or using the Titra app ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App.\n\nYou must be at least 18 years of age to use this App. By using the App, you represent and warrant that you are at least 18 years old.`,
  },
  {
    title: '2. Wellness App: Not Medical Advice',
    body: `Titra is a consumer wellness companion app designed to help you track lifestyle habits related to GLP-1 medication use. Titra is NOT a medical device, NOT a healthcare provider, and NOT subject to HIPAA regulations.\n\nThe App does not diagnose, treat, cure, or prevent any disease or medical condition. It does not provide medical advice, and nothing in the App should be interpreted as a substitute for professional medical judgment.\n\nAlways consult your prescribing physician or qualified healthcare provider before making any changes to your medication, dosage, diet, or exercise regimen. Do not disregard professional medical advice or delay seeking it because of information provided by this App.\n\nIf you experience a medical emergency, call 911 or your local emergency number immediately.`,
  },
  {
    title: '3. Account & Eligibility',
    body: `To use the App, you must create an account using one of the following methods: email and password, Sign in with Apple, or Sign in with Google. You are not required to provide your real name. You are responsible for maintaining the confidentiality of your account credentials.\n\nYou agree to provide accurate information during registration and to update it as necessary. Each person may only maintain one account. You are solely responsible for all activity under your account.`,
  },
  {
    title: '4. AI-Powered Features',
    body: `The App uses artificial intelligence (AI) services, including OpenAI's GPT-4o-mini, to provide personalized wellness coaching, food analysis, and health insights. The App also uses OpenAI's Whisper model to transcribe voice-based food and health entries.\n\nWhen you use AI features, certain health context data (such as your medication type, wellness scores, nutrition logs, and activity data) is sent to OpenAI's servers for processing. When you use voice input, your audio is sent to OpenAI's Whisper API for transcription. This data is transmitted securely and is used solely to generate your personalized responses.\n\nImportant limitations of AI features:\n• AI-generated content is informational only and is NOT medical advice\n• AI responses may contain inaccuracies or errors\n• AI does not have access to your complete medical history\n• AI cannot diagnose conditions, prescribe medications, or replace your physician\n• You should verify any AI suggestions with your healthcare provider before acting on them`,
  },
  {
    title: '5. Third-Party Integrations',
    body: `The App may integrate with the following third-party services, each subject to their own terms:\n\n• Apple HealthKit (iOS):reads and writes health metrics (steps, heart rate, sleep, weight, nutrition, etc.) with your explicit permission\n• Health Connect (Android):reads health metrics (steps, heart rate, sleep, weight, etc.) with your explicit permission\n• FatSecret API:provides food and nutrition data for food logging, including search, barcode lookup, and recipe data\n\nThese integrations are optional. You can use the App without enabling any third-party connections. When you enable an integration, you authorize the App to access the specified data from that service.`,
  },
  {
    title: '6. User-Generated Health Data',
    body: `All health and wellness data you enter into the App (including logs, surveys, and check-ins) is your data. You retain ownership of your data at all times.\n\nYou may export your data at any time via the App's PDF export feature and share it at your own discretion:for example, with your physician during an appointment. The App is not responsible for how exported data is used, interpreted, or acted upon after export.\n\nExported reports contain self-reported wellness data and are clearly labeled as such. They are not medical records.`,
  },
  {
    title: '7. Limitation of Liability',
    body: `The App is provided "as is" and "as available" without warranties of any kind, either express or implied.\n\nTitra does not guarantee the accuracy of:\n• Nutritional data from food databases\n• AI-generated coaching or insights\n• Health scores, targets, or projections\n• Wearable device data synchronization\n\nTo the maximum extent permitted by law, Titra and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, arising from your use of the App.\n\nTitra is not liable for any adverse health outcomes resulting from your use of the App. You use the App at your own risk and are solely responsible for any decisions you make based on information provided by the App.`,
  },
  {
    title: '8. Account Termination',
    body: `You may delete your account at any time through the App settings. Upon account deletion, your data will be removed from our servers, except where retention is required by law.\n\nTitra reserves the right to suspend or terminate accounts that violate these Terms or that are used in ways that may harm the App or other users.`,
  },
  {
    title: '9. Data Retention & Deletion',
    body: `Your data is retained for as long as your account is active. You may request deletion of your account and associated data at any time.\n\nUpon deletion request, your data will be permanently removed from our servers within 30 days, except where retention is required by applicable law or regulation.\n\nSome anonymized, aggregated data (which cannot identify you) may be retained for service improvement purposes.`,
  },
  {
    title: '10. Changes to Terms',
    body: `Titra may update these Terms from time to time. When we make material changes, we will notify you through the App and request your acceptance of the updated Terms before you can continue using the App.\n\nYour continued use of the App after accepting updated Terms constitutes your agreement to those changes. If you do not agree to updated Terms, you may delete your account.`,
  },
  {
    title: '11. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions.\n\nAny disputes arising from these Terms or your use of the App shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.`,
  },
];

// ─── Privacy Policy ──────────────────────────────────────────────────────────

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. What Data We Collect',
    body: `Titra collects the following categories of data:\n\nAccount Information:\n• Email address (for authentication)\n• Username (no real name required)\n• Apple or Google sign-in tokens (if you use social login)\n\nHealth & Wellness Data (self-reported):\n• Medication details: brand, dose, frequency, injection dates and sites\n• Body metrics: height, weight, body composition\n• Food logs: meal descriptions, photos, nutritional data\n• Activity logs: exercise type, duration, steps\n• Side effects: type, severity, frequency\n• Wellness surveys: appetite, energy, mood, sleep quality, GI symptoms, food noise, mental wellness\n• Weekly check-in scores across 7 wellness domains\n\nBiometric Data (optional, with permission):\n• Apple HealthKit (iOS): heart rate, HRV, sleep duration, steps, SpO2, blood glucose, resting heart rate, respiratory rate, VO2 max, body fat, lean mass, waist circumference, blood pressure\n• Health Connect (Android): heart rate, HRV, sleep, steps, blood glucose, resting heart rate, active calories\n\nDemographic Data:\n• Date of birth, sex, activity level\n\nUsage Data:\n• App interaction data, feature usage patterns`,
  },
  {
    title: '2. How Data Is Stored',
    body: `Your data is stored using industry-standard security practices:\n\nServer-Side Storage:\n• Supabase (PostgreSQL database) with Row-Level Security (RLS):each user can only access their own data\n• All data is encrypted in transit using TLS/SSL\n• Authentication managed by Supabase Auth with secure JWT tokens\n\nDevice-Local Storage:\n• AsyncStorage for offline access to profile data, preferences, and cached content\n• Local data stays on your device and is not shared with third parties\n\nWe do not sell your data to any third party.`,
  },
  {
    title: '3. Third-Party Data Sharing',
    body: `We share limited data with the following service providers solely to deliver App functionality:\n\nOpenAI (GPT-4o-mini & Whisper):\n• What is shared: wellness context (medication type, scores, nutrition/activity summaries, side effects), food photos for analysis, voice recordings for transcription\n• What is NOT shared: your email, username, or any directly identifying information\n• Purpose: AI-powered coaching, food recognition, personalized insights, voice-to-text transcription\n• OpenAI's data retention: subject to OpenAI's API data usage policy (API inputs are not used for model training)\n\nFatSecret:\n• What is shared: food search queries, barcode lookups, recipe search queries\n• Purpose: nutritional database lookups, food identification, recipe nutrition data\n\nPostHog (Analytics):\n• What is shared: anonymized usage events (e.g., which features you use, screen views, button taps)\n• What is NOT shared: your health data, medication data, food logs, or any personally identifying health information\n• Purpose: understanding how the App is used so we can improve the experience\n• PostHog does not receive any health, wellness, or biometric data\n\nWe do not share your data with advertisers, data brokers, or any entity not listed above.`,
  },
  {
    title: '4. How We Use Your Data',
    body: `We use your data exclusively to provide and improve the App's features:\n\n• Personalized nutrition and activity targets based on your profile\n• Medication tracking and adherence scoring\n• AI-powered wellness coaching and insights\n• Side effect monitoring and trend analysis\n• Weekly health summaries and progress tracking\n• Exportable wellness reports for your personal use\n\nWe do not use your data for advertising or marketing purposes. We do not build advertising profiles. We do not sell your data.`,
  },
  {
    title: '5. Your Rights',
    body: `You have the following rights regarding your data:\n\nAll Users:\n• Access: View all your data within the App at any time\n• Export: Download your health data as a PDF report\n• Deletion: Delete your account and all associated data\n• Correction: Update your profile and health data at any time\n\nCalifornia Residents (CCPA):\n• Right to know what personal information is collected\n• Right to delete personal information\n• Right to opt-out of the sale of personal information (note: we do not sell your data)\n• Right to non-discrimination for exercising your rights\n\nEU/EEA Residents (GDPR):\n• Right to rectification of inaccurate data\n• Right to erasure ("right to be forgotten")\n• Right to restrict processing\n• Right to data portability\n• Right to object to processing\n\nTo exercise any of these rights, contact us at the email address provided in Section 8.`,
  },
  {
    title: '6. Data Retention',
    body: `We retain your data for as long as your account is active.\n\nUpon account deletion:\n• Profile data, health logs, and chat history are permanently deleted within 30 days\n• Anonymized, aggregated analytics data may be retained (this data cannot identify you)\n• Data required by law may be retained for the legally required period\n\nLocal data stored on your device (AsyncStorage) is cleared when you sign out or delete the App.`,
  },
  {
    title: '7. Children\'s Privacy',
    body: `The App is not intended for use by anyone under 18 years of age. We do not knowingly collect personal information from children under 18.\n\nIf we become aware that we have collected data from a child under 18, we will promptly delete that information. If you believe a child under 18 has provided us with personal information, please contact us immediately.`,
  },
  {
    title: '8. Contact Information',
    body: `For questions about this Privacy Policy, to exercise your data rights, or to report a concern:\n\nEmail: support@titrahealth.io\n\nWe will respond to all data rights requests within 30 days.`,
  },
];

// ─── AI Disclosure ───────────────────────────────────────────────────────────

export const AI_SECTIONS: LegalSection[] = [
  {
    title: '1. AI in TitraHealth',
    body: `TitraHealth uses third-party artificial intelligence (AI) services to power several features of the App. This disclosure explains exactly which AI providers receive your data, what data is sent, and what those providers do with it.\n\nBy accepting this disclosure during onboarding, you give us your explicit permission to send the data described below to the providers named here (OpenAI and FatSecret), solely to deliver the features you use.`,
  },
  {
    title: '2. AI & Data Providers',
    body: `TitraHealth uses the following third-party providers to power AI and nutrition features:\n\nOpenAI (AI features):\n• GPT-4o-mini:for the Ask AI assistant, weekly summaries, food description parsing, and personalized insights\n• GPT-4o (vision):for analyzing food photos when you use the Capture Food feature\n• Whisper:for transcribing voice recordings into text when you use voice logging\n\nFatSecret (nutrition database):\n• FatSecret Platform API:for food search, barcode lookup, autocomplete, and nutritional data retrieval when you log meals\n\nAll calls to both providers go through our own server-side proxy. Your data is sent over TLS-encrypted connections.`,
  },
  {
    title: '3. Features and What Each One Sends',
    body: `Each feature sends only the data required to perform that specific task:\n\nAsk AI (chat assistant):via OpenAI:\n• Your message text\n• A snapshot of your wellness context:medication type, current dose phase, recent score, today's protein and activity progress, recent side effects\n\nDescribe Food (text):via OpenAI:\n• The text description of the food you typed\n\nCapture Food (photo):via OpenAI:\n• The photo you took of the meal\n\nVoice Logging (Whisper):via OpenAI:\n• The audio clip you recorded\n• The type of entry you're logging (food / weight / injection / side effect / activity) so the model knows how to structure the result\n\nWeekly Summary & Insights:via OpenAI:\n• Aggregated summary of the past week's logs (no individual messages or raw photos)\n\nFood Search, Barcode Scan & Autocomplete:via FatSecret:\n• The food name or search query you typed\n• The barcode number you scanned\n• Partial text as you type (for autocomplete suggestions)\n• No health data, medication data, or personal information is sent to FatSecret`,
  },
  {
    title: '4. What Is Never Sent to Third Parties',
    body: `The following are never sent to OpenAI or FatSecret under any circumstance:\n\n• Your email address\n• Your username\n• Your real name (if you provided one)\n• Your account ID\n• Your authentication tokens\n• Any directly identifying information\n\nThe data these providers see is tied only to an opaque request:they have no way to associate it with you personally.\n\nAdditionally, FatSecret never receives any of your health or medication data. FatSecret only processes food search queries and barcode numbers to return nutritional information.`,
  },
  {
    title: '5. Data Retention & Training',
    body: `OpenAI:\nPer OpenAI's API data usage policy, API inputs (the data we send to perform AI features) are NOT used to train OpenAI's models. OpenAI may retain API inputs and outputs for up to 30 days for abuse and misuse monitoring, after which they are deleted. We use OpenAI's standard API tier. For full details, see OpenAI's API data usage policy: https://openai.com/policies/api-data-usage-policies\n\nFatSecret:\nFatSecret receives only food search queries and barcode numbers. FatSecret's data usage is governed by the FatSecret Platform API Terms of Service. Your search queries are not used to build a profile of you and are not shared with advertisers. For full details, see FatSecret's privacy policy: https://www.fatsecret.com/Default.aspx?pa=privacy`,
  },
  {
    title: '6. AI Limitations: Not Medical Advice',
    body: `AI-generated content in TitraHealth is informational only and is NOT medical advice.\n\n• AI responses may contain inaccuracies, hallucinations, or errors\n• AI does not have access to your complete medical history\n• AI cannot diagnose conditions, prescribe medications, or replace your physician\n• AI does not know about drug interactions specific to your situation\n• AI suggestions about dose timing, side effects, or symptoms should always be verified with your healthcare provider before acting on them\n\nIn a medical emergency, call 911 or your local emergency number:do not consult the App.`,
  },
  {
    title: '7. Your Rights & Controls',
    body: `You have the following rights and controls regarding AI use in TitraHealth:\n\n• Granular consent toggles:you can enable or disable AI Data Processing (OpenAI) and Food Database (FatSecret) independently at any time in Settings > Privacy & Data. Disabling a toggle immediately stops all data from being sent to that provider.\n• Revoke consent at any time:toggling off a service does not delete data already processed, but prevents any future data from being sent.\n• The App is fully functional without AI features:disabling AI Data Processing only affects Ask AI, Capture Food, Describe Food, voice logging, and AI-generated insights. Core tracking features (logging, scoring, charts) continue to work without any third-party data sharing.\n• Delete AI history:your Ask AI conversation history is part of your account data and is permanently deleted within 30 days when you delete your account.\n• Export:you can export your health data at any time via the App's PDF export feature.\n• Updates:if we change AI providers or what data is sent to them, we will notify you and request your acceptance of an updated AI Disclosure before the changes take effect.\n\nFor questions, contact us at support@titrahealth.io.`,
  },
];
