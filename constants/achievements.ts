export type Achievement = {
  id: string;
  name: string;
  label: string;
  icon: string;
  category: 'streak' | 'weight' | 'treatment';
  threshold: number;
  /** Description shown on the congrats overlay. */
  description: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Streak
  { id: 's7',   name: 'First Week',      label: '7 days',   icon: '\u{1F525}', category: 'streak',    threshold: 7,   description: "You've logged 7 days in a row!" },
  { id: 's14',  name: 'Two Weeks',       label: '14 days',  icon: '\u{1F525}', category: 'streak',    threshold: 14,  description: "Two weeks of consistency!" },
  { id: 's30',  name: 'Monthly',         label: '30 days',  icon: '\u{1F525}', category: 'streak',    threshold: 30,  description: "A full month of daily logging!" },
  { id: 's60',  name: 'Dedicated',       label: '60 days',  icon: '\u{1F4AA}', category: 'streak',    threshold: 60,  description: "60 days of dedication!" },
  { id: 's100', name: 'Century',         label: '100 days', icon: '\u{2B50}',  category: 'streak',    threshold: 100, description: "100 days strong!" },
  { id: 's365', name: 'Full Year',       label: '365 days', icon: '\u{1F451}', category: 'streak',    threshold: 365, description: "A full year of daily logging!" },
  // Weight
  { id: 'w5',   name: 'First 5',         label: '5 lbs',    icon: '\u{1F3C5}', category: 'weight',    threshold: 5,   description: "You've lost your first 5 lbs!" },
  { id: 'w10',  name: 'Double Digits',   label: '10 lbs',   icon: '\u{1F3C5}', category: 'weight',    threshold: 10,  description: "Double digits \u2014 10 lbs lost!" },
  { id: 'w25',  name: 'Quarter Century', label: '25 lbs',   icon: '\u{1F3C6}', category: 'weight',    threshold: 25,  description: "25 lbs gone for good!" },
  { id: 'w50',  name: 'Half Century',    label: '50 lbs',   icon: '\u{1F3C6}', category: 'weight',    threshold: 50,  description: "An incredible 50 lbs lost!" },
  // Treatment
  { id: 't7',   name: 'Getting Started', label: '1 week',   icon: '\u{1F48A}', category: 'treatment', threshold: 7,   description: "Your first week on treatment!" },
  { id: 't30',  name: 'One Month In',    label: '30 days',  icon: '\u{1F48A}', category: 'treatment', threshold: 30,  description: "One month on your treatment plan!" },
  { id: 't90',  name: 'Committed',       label: '3 months', icon: '\u{1F6E1}\u{FE0F}', category: 'treatment', threshold: 90,  description: "Three months of commitment!" },
  { id: 't180', name: 'Half Year',       label: '6 months', icon: '\u{1F6E1}\u{FE0F}', category: 'treatment', threshold: 180, description: "Six months on treatment!" },
  { id: 't365', name: 'Veteran',         label: '1 year',   icon: '\u{1F396}\u{FE0F}', category: 'treatment', threshold: 365, description: "A full year on treatment!" },
];

/** Return IDs of all achievements currently earned based on user stats. */
export function getUnlockedAchievementIds(
  streak: number,
  weightLost: number,
  daysOnTreatment: number,
): string[] {
  return ACHIEVEMENTS.filter((a) => {
    switch (a.category) {
      case 'streak':    return streak >= a.threshold;
      case 'weight':    return weightLost >= a.threshold;
      case 'treatment': return daysOnTreatment >= a.threshold;
    }
  }).map((a) => a.id);
}

export const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  streak: 'Streak',
  weight: 'Weight Loss',
  treatment: 'Treatment',
};
