import { supabaseClient } from '@/platform/supabase/client';

export type SavedMeasurement = {
  id: string;
  metric_definition_id: string;
  numeric_value: number | null;
  component_values: Record<string, number> | null;
  unit: string | null;
  measured_at: string;
  context: Record<string, string>;
  source_kind: string;
  source_label: string | null;
  created_at: string;
};

export type PatientMetricDefinition = {
  id: string;
  metric_key: string;
  version: number;
  display_names: Record<string, string>;
  supported_units: string[];
  category: string;
  value_kind: 'scalar' | 'composite';
  value_shape: Record<string, unknown>;
};

export type PublishedMetricContent = {
  id: string;
  locale: 'ar' | 'fr' | 'en';
  content: Record<string, string>;
  reference_ranges: unknown[] | null;
  evidence_sources: Array<{ title: string; url: string }>;
};

const databaseMetricKeys: Record<string, string> = { glucose: 'blood_glucose' };

export async function listActiveMetricDefinitions(): Promise<PatientMetricDefinition[]> {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('metric_definitions')
    .select('id,metric_key,version,display_names,supported_units,category,value_kind,value_shape')
    .eq('is_active', true)
    .order('metric_key')
    .order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientMetricDefinition[];
}

export async function getMetricSupportedUnits(metricId: string): Promise<string[]> {
  if (!supabaseClient) return [];
  const metricKey = databaseMetricKeys[metricId] ?? metricId;
  const { data, error } = await supabaseClient
    .from('metric_definitions')
    .select('supported_units')
    .eq('metric_key', metricKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.supported_units as string[] | undefined) ?? [];
}

export async function getPatientMetric(metricId: string, locale: 'ar' | 'fr' | 'en') {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  const metricKey = databaseMetricKeys[metricId] ?? metricId;
  const { data: definition, error: definitionError } = await supabaseClient
    .from('metric_definitions')
    .select('id,metric_key,version,display_names,supported_units,category,value_kind,value_shape')
    .eq('metric_key', metricKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (definitionError) throw definitionError;
  if (!definition) throw new Error('This metric is not available.');

  const { data: profile } = await supabaseClient.from('profiles').select('preferred_locale').maybeSingle();
  const preferredLocale = profile?.preferred_locale === 'ar' || profile?.preferred_locale === 'fr'
    ? profile.preferred_locale
    : locale;

  const now = new Date().toISOString();
  const { data: localizedContent, error: contentError } = await supabaseClient
    .from('metric_content_versions')
    .select('id,locale,content,reference_ranges,evidence_sources')
    .eq('metric_definition_id', definition.id)
    .eq('status', 'published')
    .eq('locale', preferredLocale)
    .lte('effective_from', now)
    .or(`effective_to.is.null,effective_to.gt.${now}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contentError) throw contentError;

  let content = localizedContent as PublishedMetricContent | null;
  if (!content && preferredLocale !== 'en') {
    const { data: englishContent, error: englishError } = await supabaseClient
      .from('metric_content_versions')
      .select('id,locale,content,reference_ranges,evidence_sources')
      .eq('metric_definition_id', definition.id)
      .eq('status', 'published')
      .eq('locale', 'en')
      .lte('effective_from', now)
      .or(`effective_to.is.null,effective_to.gt.${now}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (englishError) throw englishError;
    content = englishContent as PublishedMetricContent | null;
  }

  const { data: definitionVersions, error: versionsError } = await supabaseClient
    .from('metric_definitions')
    .select('id')
    .eq('metric_key', metricKey);
  if (versionsError) throw versionsError;
  const definitionIds = (definitionVersions ?? []).map((version) => version.id as string);

  const { data: measurements, error: measurementsError } = await supabaseClient
    .from('health_measurements')
    .select('id,metric_definition_id,numeric_value,component_values,unit,measured_at,context,source_kind,source_label,created_at')
    .in('metric_definition_id', definitionIds)
    .order('measured_at', { ascending: false })
    .limit(100);
  if (measurementsError) throw measurementsError;

  return {
    definition: definition as PatientMetricDefinition,
    content,
    measurements: (measurements ?? []) as SavedMeasurement[],
    locale: preferredLocale,
    contentLocale: content?.locale ?? preferredLocale,
  };
}

export async function getCurrentProfile() {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You need to sign in to access your profile.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, display_name, preferred_locale')
    .eq('id', userData.user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function listMeasurementsForCurrentUser(): Promise<SavedMeasurement[]> {
  if (!supabaseClient) return [];

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabaseClient
    .from('health_measurements')
    .select('id, metric_definition_id, numeric_value, component_values, unit, measured_at, context, source_kind, source_label, created_at')
    .eq('patient_id', userData.user.id)
    .order('measured_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as SavedMeasurement[];
}

export async function saveMeasurement(metricKey: string, numericValue: number, unit: string, measuredAt: string, context: Record<string, string> = {}) {
  if (!supabaseClient) throw new Error('Authentication is not configured.');

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You need to sign in before saving a result.');

  const { data: definition, error: definitionError } = await supabaseClient
    .from('metric_definitions')
    .select('id, supported_units')
    .eq('metric_key', databaseMetricKeys[metricKey] ?? metricKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (definitionError) throw definitionError;
  if (!definition) throw new Error('This metric is not available.');
  if (!(definition.supported_units as string[]).includes(unit)) {
    throw new Error('Choose a supported unit for this measurement.');
  }

  const { data, error } = await supabaseClient
    .from('health_measurements')
    .insert({
      patient_id: userData.user.id,
      metric_definition_id: definition.id,
      numeric_value: numericValue,
      unit,
      measured_at: measuredAt,
      context,
      source_kind: 'patient_entry',
      entered_by: userData.user.id,
    })
    .select('id, metric_definition_id, numeric_value, component_values, unit, measured_at, context, source_kind, source_label, created_at')
    .single();

  if (error) throw error;
  return data as SavedMeasurement;
}

export async function saveCompositeMeasurement(metricKey: string, componentValues: Record<string, number>, measuredAt: string) {
  if (!supabaseClient) throw new Error('Authentication is not configured.');
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You need to sign in before saving a result.');

  const { data: definition, error: definitionError } = await supabaseClient
    .from('metric_definitions')
    .select('id,value_shape')
    .eq('metric_key', metricKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (definitionError) throw definitionError;
  if (!definition || !Array.isArray((definition.value_shape as { fields?: unknown }).fields)) throw new Error('This composite metric is not available.');

  const requiredKeys = ((definition.value_shape as { fields: Array<{ key: string }> }).fields).map((field) => field.key).sort();
  if (JSON.stringify(Object.keys(componentValues).sort()) !== JSON.stringify(requiredKeys)
    || Object.values(componentValues).some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Enter valid values for every part of this measurement.');
  }

  const { data, error } = await supabaseClient.from('health_measurements').insert({
    patient_id: userData.user.id,
    metric_definition_id: definition.id,
    component_values: componentValues,
    measured_at: measuredAt,
    source_kind: 'patient_entry',
    entered_by: userData.user.id,
  }).select('id,metric_definition_id,numeric_value,component_values,unit,measured_at,context,source_kind,source_label,created_at').single();
  if (error) throw error;
  return data as SavedMeasurement;
}
