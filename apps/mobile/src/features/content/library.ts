// General wellbeing information written for Ihssan. It is NOT clinician-reviewed
// and must be medically reviewed before public launch. It never replaces a doctor.
export type LibraryItem = {
  id: string; slug: string; locale: 'en' | 'fr' | 'ar'; category: string; title: string;
  summary: string; body_markdown: string; effective_from: string; kind: 'articles' | 'blogs';
};

const d = '2026-05-01T00:00:00Z';
const note = '\n\nThis is general information, not medical advice. Speak to a doctor or pharmacist about your own situation.';

export const localLibrary: LibraryItem[] = [
  {
    id: 'local-a1', slug: 'understanding-blood-pressure', locale: 'en', category: 'heart_health', kind: 'articles', effective_from: d,
    title: 'Understanding your blood pressure',
    summary: 'What the two numbers mean and why regular readings matter more than a single one.',
    body_markdown: `Blood pressure is written as two numbers, such as 120/80. The first (systolic) is the pressure when your heart beats. The second (diastolic) is the pressure between beats.\n\nA single reading can be affected by stress, caffeine, a full bladder or rushing to the appointment. Readings taken calmly, at the same time of day, over several days tell a far truer story.\n\nHow to measure well:\n• Sit quietly for five minutes, back supported, feet flat.\n• Rest your arm at heart level.\n• Avoid caffeine and smoking for 30 minutes before.\n• Take two readings a minute apart and note both.\n\nTrack your readings in Ihssan and share the trend with your doctor, who will tell you what range is right for you.${note}`,
  },
  {
    id: 'local-a2', slug: 'blood-sugar-basics', locale: 'en', category: 'diabetes', kind: 'articles', effective_from: d,
    title: 'Blood sugar basics',
    summary: 'Fasting, after-meal and long-term sugar: what each measurement tells you.',
    body_markdown: `Blood sugar (glucose) is your body's main fuel. It rises after meals and falls with activity and time.\n\n• Fasting glucose is measured after at least eight hours without food.\n• After-meal readings show how your body handles a meal.\n• HbA1c reflects your average over roughly three months and is measured in a lab.\n\nSmall habits help: regular meals, fibre-rich food, walking after eating and enough sleep. Never change diabetes medication on your own.\n\nLog your readings with the time and what you ate, so your doctor can see patterns and not isolated numbers.${note}`,
  },
  {
    id: 'local-a3', slug: 'taking-medicines-safely', locale: 'en', category: 'medication', kind: 'articles', effective_from: d,
    title: 'Taking your medicines safely',
    summary: 'Simple habits that prevent missed doses, mix-ups and avoidable side effects.',
    body_markdown: `Most medicine problems come from small slips, not big mistakes.\n\n• Keep one up-to-date list of everything you take, including vitamins and herbal products.\n• Take medicines at the same times each day, linked to a habit such as breakfast.\n• Do not stop a prescribed medicine because you feel better unless your doctor says so.\n• If you miss a dose, check the leaflet or ask your pharmacist; do not simply double up.\n• Tell every doctor and pharmacist what you take, and about any allergies.\n\nThe Treatments feature in Ihssan lets you tick off each dose so you can see your own consistency.${note}`,
  },
  {
    id: 'local-a4', slug: 'preparing-for-a-doctor-visit', locale: 'en', category: 'general_health', kind: 'articles', effective_from: d,
    title: 'Preparing for a doctor visit',
    summary: 'Make a short visit count: what to bring, what to ask and what to write down.',
    body_markdown: `Appointments are short. A little preparation turns them into useful ones.\n\nBring: your medicine list, recent results, and any questions written down.\n\nWrite down: when symptoms started, what makes them better or worse, and how they affect daily life.\n\nAsk: what is the likely cause, what are the options, what should I watch for, and when should I come back?\n\nAfterwards, note what was agreed. Sharing your Ihssan medical profile with a verified doctor saves time repeating your history.${note}`,
  },
  {
    id: 'local-a5', slug: 'ihsan-in-caring-for-the-sick', locale: 'en', category: 'wellbeing', kind: 'articles', effective_from: d,
    title: 'Ihsan in caring for the sick',
    summary: 'Excellence, patience and presence: how care is a form of worship.',
    body_markdown: `Ihsan means doing what we do beautifully, as if we saw God, knowing that He sees us.\n\nIn care this becomes concrete: listening fully, explaining patiently, protecting dignity and privacy, and showing up. Visiting the sick is an act the tradition holds in great esteem.\n\nFor patients, Ihsan can mean small acts toward oneself: taking medicine on time, resting, asking for help.\n\nFor families and clinicians, it means gentleness without hurry, even on a long day.`,
  },
  {
    id: 'local-b1', slug: 'a-gentle-week-of-eating', locale: 'en', category: 'nutrition', kind: 'blogs', effective_from: d,
    title: 'A gentle week of eating well',
    summary: 'No strict plan: a few steady swaps that fit Moroccan kitchens.',
    body_markdown: `Good eating does not need a rulebook. Try one change a week.\n\nWeek one: add a vegetable to lunch, such as a zaalouk or a simple tomato salad.\nWeek two: swap some white bread for whole grain, or add lentils and chickpeas, which are already part of our table.\nWeek three: water or mint tea instead of sugary drinks.\nWeek four: keep dates and nuts as a snack in place of pastries on most days.\n\nSlow progress that lasts beats a perfect plan that ends on day four.${note}`,
  },
  {
    id: 'local-b2', slug: 'sleep-and-the-evening-wind-down', locale: 'en', category: 'sleep', kind: 'blogs', effective_from: d,
    title: 'Sleep and the evening wind-down',
    summary: 'Small evening rituals that tell your body the day is over.',
    body_markdown: `Sleep is often the first thing we give up and the last thing we notice.\n\nA wind-down can be simple: dim lights an hour before bed, put the phone in another room, a warm drink without caffeine, and a few minutes of quiet dhikr or reflection.\n\nKeep wake-up time steady even after a bad night. If tiredness or snoring is persistent, mention it to your doctor.${note}`,
  },
  {
    id: 'local-b3', slug: 'walking-as-medicine', locale: 'en', category: 'fitness', kind: 'blogs', effective_from: d,
    title: 'Walking: the quiet exercise',
    summary: 'Ten minutes after meals can change a day. Start where you are.',
    body_markdown: `You do not need a gym. A ten-minute walk after meals helps digestion, mood and blood sugar for many people.\n\nStart with what feels easy, add a few minutes each week, and walk with a friend or family member. Count the habit, not the distance.\n\nIf you have heart, joint or breathing conditions, ask your doctor what level is right before increasing.${note}`,
  },
];
