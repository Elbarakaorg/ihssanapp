type RangeRow = Record<string, string | number>;
type MeasurementForInterpretation = {
  numeric_value: number | null;
  unit: string | null;
  component_values: Record<string, number> | null;
  context: Record<string, string>;
};

const categoryCopy: Record<string, Record<'en' | 'fr' | 'ar', string>> = {
  normal: { en: 'within this commonly cited reference category', fr: 'dans cette catégorie de référence couramment citée', ar: 'ضمن فئة المرجع الشائعة هذه' },
  elevated: { en: 'in the elevated screening category', fr: 'dans la catégorie de dépistage élevée', ar: 'ضمن فئة الفحص المرتفع' },
  'stage 1 hypertension screening': { en: 'in the stage 1 screening category', fr: 'dans la catégorie de dépistage de stade 1', ar: 'ضمن فئة الفحص للمرحلة الأولى' },
  'stage 2 hypertension screening': { en: 'in the stage 2 screening category', fr: 'dans la catégorie de dépistage de stade 2', ar: 'ضمن فئة الفحص للمرحلة الثانية' },
  'common prediabetes screening range': { en: 'within a commonly used prediabetes screening range', fr: 'dans une plage de dépistage couramment utilisée du prédiabète', ar: 'ضمن نطاق شائع لفحص مقدمات السكري' },
  'common screening reference': { en: 'below a commonly used screening threshold', fr: 'sous un seuil de dépistage couramment utilisé', ar: 'أقل من حد شائع للفحص' },
  'individualized diabetes care-plan goal': { en: 'within one commonly cited post-meal care-plan goal', fr: 'dans un objectif de suivi après repas couramment cité', ar: 'ضمن أحد أهداف المتابعة الشائعة بعد الوجبة' },
  'diagnostic threshold that may require confirmation': { en: 'at or above a threshold that may require clinical confirmation', fr: 'au niveau ou au-dessus d’un seuil pouvant nécessiter une confirmation clinique', ar: 'عند حد قد يتطلب تأكيدًا سريريًا أو أعلى منه' },
  'commonly cited adult resting range': { en: 'within a commonly cited adult resting range', fr: 'dans une plage de repos couramment citée chez l’adulte', ar: 'ضمن نطاق الراحة الشائع للبالغين' },
  'commonly expected for many people at sea level': { en: 'within a commonly expected range for many people at sea level', fr: 'dans une plage souvent attendue chez de nombreuses personnes au niveau de la mer', ar: 'ضمن نطاق متوقع لدى كثير من الناس عند مستوى سطح البحر' },
  'interpret with symptoms and clinical context': { en: 'in a range that needs symptom and clinical context', fr: 'dans une plage à interpréter selon les symptômes et le contexte clinique', ar: 'ضمن نطاق يتطلب تفسيرًا وفق الأعراض والسياق السريري' },
  'potentially urgent; seek medical advice': { en: 'in a range that warrants prompt medical advice', fr: 'dans une plage nécessitant un avis médical rapide', ar: 'ضمن نطاق يستدعي مشورة طبية عاجلة' },
  'commonly used deficiency threshold': { en: 'below a commonly used deficiency threshold', fr: 'sous un seuil de carence couramment utilisé', ar: 'أقل من حد شائع للنقص' },
  'often described as insufficient': { en: 'within a range often described as insufficient', fr: 'dans une plage souvent décrite comme insuffisante', ar: 'ضمن نطاق يوصف غالبًا بأنه غير كافٍ' },
  'commonly considered sufficient in some guidance': { en: 'within a range considered sufficient in some guidance', fr: 'dans une plage considérée suffisante par certaines recommandations', ar: 'ضمن نطاق تعتبره بعض الإرشادات كافيًا' },
  'possible excess; clinician review needed': { en: 'at a level that needs clinician review for possible excess', fr: 'à un niveau nécessitant un avis clinique pour un excès possible', ar: 'عند مستوى يتطلب مراجعة الطبيب لاحتمال الزيادة' },
};

export function interpretPublishedRange(
  metricKey: string,
  measurement: MeasurementForInterpretation | undefined,
  referenceRanges: unknown[] | null,
  locale: 'en' | 'fr' | 'ar',
): string | null {
  if (!measurement || !referenceRanges?.length) return null;
  if (metricKey === 'inr') {
    const text = {
      en: 'INR targets depend on your condition and treatment plan. Compare this value with the target given by your care team.',
      fr: 'La cible INR dépend de votre état et de votre plan de traitement. Comparez cette valeur à la cible donnée par votre équipe soignante.',
      ar: 'يعتمد هدف INR على حالتك وخطة العلاج. قارن هذه النتيجة بالهدف الذي حدده فريق الرعاية.',
    };
    return text[locale];
  }
  if (metricKey === 'blood_pressure') {
    const components = measurement.component_values;
    if (!components || components.systolic === undefined || components.diastolic === undefined) return null;
    const rows = referenceRanges.filter(isRangeRow);
    const priority = ['stage 2 hypertension screening', 'stage 1 hypertension screening', 'elevated', 'normal'];
    const match = priority.flatMap((category) => rows.filter((row) => row.category === category)).find((row) => bloodPressureRangeMatches(components.systolic, components.diastolic, row));
    const message = match ? categoryCopy[String(match.category)]?.[locale] : null;
    if (!message) return null;
    const caution = {
      en: 'This is a screening category, not a diagnosis or personal treatment target.',
      fr: 'Il s’agit d’une catégorie de dépistage, pas d’un diagnostic ni d’un objectif thérapeutique personnel.',
      ar: 'هذه فئة للفحص وليست تشخيصًا أو هدفًا علاجيًا شخصيًا.',
    };
    return `${message}. ${caution[locale]}`;
  }
  if (measurement.numeric_value === null) return null;

  const value = metricKey === 'blood_glucose' && measurement.unit === 'mmol/L'
    ? measurement.numeric_value * 18.0182
    : measurement.numeric_value;
  let rows = referenceRanges.filter(isRangeRow);

  if (metricKey === 'blood_glucose') {
    const timing = measurement.context.timing;
    if (timing === 'fasting') rows = rows.filter((row) => row.context === 'fasting' && !String(row.category).includes('individualized'));
    else if (timing === 'postprandial_1_2h') rows = rows.filter((row) => row.context === '1-2 hours after meal');
    else return null;
  }
  if (metricKey === 'hba1c') rows = rows.filter((row) => !String(row.category).includes('individualized'));

  const matchingRange = rows.find((row) => rangeContains(metricKey, value, row));
  if (!matchingRange) return null;
  const message = categoryCopy[String(matchingRange.category)]?.[locale];
  if (!message) return null;
  const caution = {
    en: 'This is a reference category, not a diagnosis or personal treatment target.',
    fr: 'Il s’agit d’une catégorie de référence, pas d’un diagnostic ni d’un objectif thérapeutique personnel.',
    ar: 'هذه فئة مرجعية وليست تشخيصًا أو هدفًا علاجيًا شخصيًا.',
  };
  return `${message}. ${caution[locale]}`;
}

function isRangeRow(value: unknown): value is RangeRow {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bloodPressureRangeMatches(systolic: number, diastolic: number, row: RangeRow): boolean {
  const systolicMatches = axisMatches(systolic, row, 'systolic');
  const diastolicMatches = axisMatches(diastolic, row, 'diastolic');
  if (String(row.category).includes('stage 1') || String(row.category).includes('stage 2')) return systolicMatches || diastolicMatches;
  return systolicMatches && diastolicMatches;
}

function axisMatches(value: number, row: RangeRow, axis: 'systolic' | 'diastolic'): boolean {
  const minimum = row[`${axis}_min`];
  const maximum = row[`${axis}_max`];
  const maximumExclusive = row[`${axis}_max_exclusive`];
  if (typeof minimum === 'number' && value < minimum) return false;
  if (typeof maximum === 'number' && value > maximum) return false;
  if (typeof maximumExclusive === 'number' && value >= maximumExclusive) return false;
  return typeof minimum === 'number' || typeof maximum === 'number' || typeof maximumExclusive === 'number';
}

function rangeContains(metricKey: string, value: number, row: RangeRow): boolean {
  const applicable = metricKey === 'blood_glucose' ? '_mg_dl' : metricKey === 'hba1c' || metricKey === 'spo2' ? '_percent' : metricKey === 'resting_heart_rate' ? '_bpm' : metricKey === 'vitamin_d' ? '_ng_ml' : '';
  const minimumKey = Object.keys(row).find((key) => key.startsWith('minimum') && (!applicable || key.includes(applicable)));
  const maximumKey = Object.keys(row).find((key) => key.startsWith('maximum') && (!applicable || key.includes(applicable)));
  const minimum = minimumKey ? Number(row[minimumKey]) : null;
  const maximum = maximumKey ? Number(row[maximumKey]) : null;
  const minimumExclusive = minimumKey?.endsWith('_exclusive') ?? false;
  const maximumExclusive = maximumKey?.endsWith('_exclusive') ?? false;

  if (minimum !== null && (minimumExclusive ? value <= minimum : value < minimum)) return false;
  if (maximum !== null && (maximumExclusive ? value >= maximum : value > maximum)) return false;
  return minimum !== null || maximum !== null;
}