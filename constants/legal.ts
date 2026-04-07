// ─── Legal Document Versions ─────────────────────────────────────────────────

export const TOS_VERSION = '1.0';
export const TOS_EFFECTIVE_DATE = 'April 15, 2026';

export const PRIVACY_VERSION = '1.0';
export const PRIVACY_EFFECTIVE_DATE = 'April 15, 2026';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LegalSection = { title: string; body: string };

// ─── Terms of Service ────────────────────────────────────────────────────────

export const TOS_SECTIONS: LegalSection[] = [
  {
    title: '1. Acceptance of Terms',
    body: `By creating an account or using the Titra app ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App.\n\nYou must be at least 18 years of age to use this App. By using the App, you represent and warrant that you are at least 18 years old.`,
  },
  {
    title: '2. Wellness App — Not Medical Advice',
    body: `Titra is a consumer wellness companion app designed to help you track lifestyle habits related to GLP-1 medication use. Titra is NOT a medical device, NOT a healthcare provider, and NOT subject to HIPAA regulations.\n\nThe App does not diagnose, treat, cure, or prevent any disease or medical condition. It does not provide medical advice, and nothing in the App should be interpreted as a substitute for professional medical judgment.\n\nAlways consult your prescribing physician or qualified healthcare provider before making any changes to your medication, dosage, diet, or exercise regimen. Do not disregard professional medical advice or delay seeking it because of information provided by this App.\n\nIf you experience a medical emergency, call 911 or your local emergency number immediately.`,
  },
  {
    title: '3. Account & Eligibility',
    body: `To use the App, you must create an account using an email address and a username. You are not required to provide your real name. You are responsible for maintaining the confidentiality of your account credentials.\n\nYou agree to provide accurate information during registration and to update it as necessary. Each person may only maintain one account. You are solely responsible for all activity under your account.`,
  },
  {
    title: '4. AI-Powered Features',
    body: `The App uses artificial intelligence (AI) services, including OpenAI's GPT-4o-mini, to provide personalized wellness coaching, food analysis, and health insights.\n\nWhen you use AI features, certain health context data (such as your medication type, wellness scores, nutrition logs, and activity data) is sent to OpenAI's servers for processing. This data is transmitted securely and is used solely to generate your personalized responses.\n\nImportant limitations of AI features:\n• AI-generated content is informational only and is NOT medical advice\n• AI responses may contain inaccuracies or errors\n• AI does not have access to your complete medical history\n• AI cannot diagnose conditions, prescribe medications, or replace your physician\n• You should verify any AI suggestions with your healthcare provider before acting on them`,
  },
  {
    title: '5. Third-Party Integrations',
    body: `The App may integrate with the following third-party services, each subject to their own terms:\n\n• Apple HealthKit — reads health metrics (steps, heart rate, sleep, etc.) with your explicit permission\n• USDA FoodData Central — provides nutritional information for food logging\n• FatSecret API — provides additional food and nutrition data\n\nThese integrations are optional. You can use the App without enabling any third-party connections. When you enable an integration, you authorize the App to access the specified data from that service.`,
  },
  {
    title: '6. User-Generated Health Data',
    body: `All health and wellness data you enter into the App (including logs, surveys, and check-ins) is your data. You retain ownership of your data at all times.\n\nYou may export your data at any time via the App's PDF export feature and share it at your own discretion — for example, with your physician during an appointment. The App is not responsible for how exported data is used, interpreted, or acted upon after export.\n\nExported reports contain self-reported wellness data and are clearly labeled as such. They are not medical records.`,
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
    body: `Titra collects the following categories of data:\n\nAccount Information:\n• Email address (for authentication)\n• Username (no real name required)\n• Password (encrypted, never stored in plain text)\n\nHealth & Wellness Data (self-reported):\n• Medication details: brand, dose, frequency, injection dates and sites\n• Body metrics: height, weight, body composition\n• Food logs: meal descriptions, photos, nutritional data\n• Activity logs: exercise type, duration, steps\n• Side effects: type, severity, frequency\n• Wellness surveys: appetite, energy, mood, sleep quality, GI symptoms, food noise, mental wellness\n• Weekly check-in scores across 7 wellness domains\n\nBiometric Data (optional, with permission):\n• Apple HealthKit: heart rate, HRV, sleep duration, steps, SpO2, blood glucose, resting heart rate\n\nDemographic Data:\n• Date of birth, sex, activity level\n\nUsage Data:\n• App interaction data, feature usage patterns`,
  },
  {
    title: '2. How Data Is Stored',
    body: `Your data is stored using industry-standard security practices:\n\nServer-Side Storage:\n• Supabase (PostgreSQL database) with Row-Level Security (RLS) — each user can only access their own data\n• All data is encrypted in transit using TLS/SSL\n• Authentication managed by Supabase Auth with secure JWT tokens\n\nDevice-Local Storage:\n• AsyncStorage for offline access to profile data, preferences, and cached content\n• Local data stays on your device and is not shared with third parties\n\nWe do not sell your data to any third party.`,
  },
  {
    title: '3. Third-Party Data Sharing',
    body: `We share limited data with the following service providers solely to deliver App functionality:\n\nOpenAI (GPT-4o-mini):\n• What is shared: wellness context (medication type, scores, nutrition/activity summaries, side effects), food photos for analysis, voice transcriptions\n• What is NOT shared: your email, username, or any directly identifying information\n• Purpose: AI-powered coaching, food recognition, personalized insights\n• OpenAI's data retention: subject to OpenAI's API data usage policy\n\nUSDA FoodData Central & FatSecret:\n• What is shared: food search queries\n• Purpose: nutritional database lookups\n\nWe do not share your data with advertisers, data brokers, or any entity not listed above.`,
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
    body: `For questions about this Privacy Policy, to exercise your data rights, or to report a concern:\n\nEmail: privacy@titrahealth.com\n\nWe will respond to all data rights requests within 30 days.`,
  },
];
