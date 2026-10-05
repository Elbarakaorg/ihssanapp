export type Reflection = {
  id: string;
  group: 'healing' | 'ihsan' | 'dua';
  source: string;
  arabic: string;
  english: string;
  note?: string;
};

// Arabic text follows the Uthmani script (Tanzil via alquran.cloud); fragments are marked with an ellipsis in the translation.
export const reflections: Reflection[] = [
  { id: 'tawbah-9-14', group: 'healing', source: 'Surah At-Tawbah 9:14', arabic: 'وَيَشْفِ صُدُورَ قَوْمٍۢ مُّؤْمِنِينَ', english: '…and soothe the hearts of the believers.' },
  { id: 'yunus-10-57', group: 'healing', source: 'Surah Yunus 10:57', arabic: 'يَٰٓأَيُّهَا ٱلنَّاسُ قَدْ جَآءَتْكُم مَّوْعِظَةٌۭ مِّن رَّبِّكُمْ وَشِفَآءٌۭ لِّمَا فِى ٱلصُّدُورِ وَهُدًۭى وَرَحْمَةٌۭ لِّلْمُؤْمِنِينَ', english: 'O humanity! Indeed, there has come to you a warning from your Lord, a cure for what is in the hearts, a guide, and a mercy for the believers.' },
  { id: 'nahl-16-69', group: 'healing', source: 'Surah An-Nahl 16:69', arabic: 'يَخْرُجُ مِنۢ بُطُونِهَا شَرَابٌۭ مُّخْتَلِفٌ أَلْوَٰنُهُۥ فِيهِ شِفَآءٌۭ لِّلنَّاسِ', english: '…From their bellies comes forth liquid of varying colours, in which there is healing for people…', note: 'Referring to honey.' },
  { id: 'isra-17-82', group: 'healing', source: 'Surah Al-Isra 17:82', arabic: 'وَنُنَزِّلُ مِنَ ٱلْقُرْءَانِ مَا هُوَ شِفَآءٌۭ وَرَحْمَةٌۭ لِّلْمُؤْمِنِينَ', english: 'We send down in the Qur’an that which is a healing and a mercy for the believers…' },
  { id: 'shuara-26-80', group: 'healing', source: 'Surah Ash-Shu’ara 26:80', arabic: 'وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ', english: 'And when I am ill, it is He Who cures me.', note: 'The supplication of Prophet Ibrahim (Abraham).' },
  { id: 'fussilat-41-44', group: 'healing', source: 'Surah Fussilat 41:44', arabic: 'قُلْ هُوَ لِلَّذِينَ ءَامَنُوا۟ هُدًۭى وَشِفَآءٌۭ', english: '…Say, “It is, for those who believe, a guidance and a healing.”' },

  { id: 'nahl-16-90', group: 'ihsan', source: 'Surah An-Nahl 16:90', arabic: 'إِنَّ ٱللَّهَ يَأْمُرُ بِٱلْعَدْلِ وَٱلْإِحْسَٰنِ وَإِيتَآئِ ذِى ٱلْقُرْبَىٰ', english: 'Indeed, Allah orders justice and good conduct (Ihsan) and giving to relatives…' },
  { id: 'rahman-55-60', group: 'ihsan', source: 'Surah Ar-Rahman 55:60', arabic: 'هَلْ جَزَآءُ ٱلْإِحْسَٰنِ إِلَّا ٱلْإِحْسَٰنُ', english: 'Is the reward for good (Ihsan) anything but good (Ihsan)?' },
  { id: 'araf-7-56', group: 'ihsan', source: 'Surah Al-A’raf 7:56', arabic: 'إِنَّ رَحْمَتَ ٱللَّهِ قَرِيبٌۭ مِّنَ ٱلْمُحْسِنِينَ', english: '…Indeed, the mercy of Allah is near to the doers of good.' },
  { id: 'baqarah-2-195', group: 'ihsan', source: 'Surah Al-Baqarah 2:195', arabic: 'وَأَنفِقُوا۟ فِى سَبِيلِ ٱللَّهِ وَلَا تُلْقُوا۟ بِأَيْدِيكُمْ إِلَى ٱلتَّهْلُكَةِ ۛ وَأَحْسِنُوٓا۟ ۛ إِنَّ ٱللَّهَ يُحِبُّ ٱلْمُحْسِنِينَ', english: 'And spend in the way of Allah and do not throw yourselves with your own hands into destruction. And do good; indeed, Allah loves the doers of good.' },
  { id: 'gabriel', group: 'ihsan', source: 'Hadith of Gabriel (Sahih Muslim)', arabic: 'أَنْ تَعْبُدَ ٱللَّهَ كَأَنَّكَ تَرَاهُ، فَإِنْ لَمْ تَكُنْ تَرَاهُ فَإِنَّهُ يَرَاكَ', english: 'Ihsan is to worship Allah as if you see Him, and if you cannot see Him, know that He sees you.' },
  { id: 'visit-sick', group: 'ihsan', source: 'Hadith Qudsi (Sahih Muslim)', arabic: 'أَمَا عَلِمْتَ أَنَّكَ لَوْ عُدْتَهُ لَوَجَدْتَنِي عِنْدَهُ', english: '…Did you not know that if you had visited him, you would have found Me with him?', note: 'On visiting and comforting the sick.' },

  { id: 'dua-sick', group: 'dua', source: 'Prophetic dua for the sick (Bukhari & Muslim)', arabic: 'اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا', english: 'O Allah, Lord of mankind, remove the difficulty and bring about healing, for You are the Healer. There is no healing but Your healing, a healing that leaves no disease behind.', note: 'Allahumma Rabban-naas adhhibil-ba’sa washfi Antash-Shaafi, laa shifaa’a illaa shifaa’uk, shifaa’an laa yughaadiru saqamaa.' },
];

export const practices = [
  { title: 'The Three Quls', arabic: 'الإخلاص · الفلق · الناس', body: 'Recite Surah Al-Ikhlas, Al-Falaq and An-Nas, blow gently over the hands, and wipe them over the body.' },
  { title: 'Surah Al-Fatiha', arabic: 'الفاتحة', body: 'Known as Al-Ruqyah, the spiritual cure, it is recited over an ailment for relief.' },
];

export const groupTitles: Record<Reflection['group'], { title: string; arabic: string; intro: string }> = {
  healing: { title: 'Verses of Healing', arabic: 'آيات الشفاء', intro: 'Six verses traditionally recited to ease pain and comfort the sick.' },
  ihsan: { title: 'Ihsan, excellence', arabic: 'الإحسان', intro: 'Doing everything beautifully, with care and presence. Caring for the sick is its purest expression.' },
  dua: { title: 'Supplication', arabic: 'دعاء', intro: 'A prayer taught by the Prophet ﷺ for those who are unwell.' },
};

/** One reflection per calendar day, stable across reloads. */
export function reflectionOfTheDay(date = new Date()): Reflection {
  const pool = reflections.filter((item) => item.group !== 'dua');
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return pool[day % pool.length];
}
