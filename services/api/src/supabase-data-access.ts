import { createClient } from '@supabase/supabase-js';

import { DataAccessError, type AuthIdentity, type DataAccess, type MetricDefinition, type Measurement, type NewMeasurement, type Profile } from './data-access.js';

const profileColumns = 'id,display_name,preferred_locale';
const measurementColumns = 'id,metric_definition_id,numeric_value,component_values,unit,measured_at,source_kind,source_label,created_at';

export function createSupabaseDataAccess(url: string, publishableKey: string): DataAccess {
  const clientForUser = (accessToken: string) => createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  return {
    async verifyAccessToken(accessToken): Promise<AuthIdentity | null> {
      const { data, error } = await clientForUser(accessToken).auth.getUser(accessToken);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },

    async getProfile(accessToken, userId): Promise<Profile | null> {
      const { data, error } = await clientForUser(accessToken)
        .from('profiles')
        .select(profileColumns)
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new DataAccessError('Could not load profile.', error.code === '42501' ? 403 : 500);
      return data as Profile | null;
    },

    async updateProfile(accessToken, userId, changes): Promise<Profile> {
      const { data, error } = await clientForUser(accessToken)
        .from('profiles')
        .update(changes)
        .eq('id', userId)
        .select(profileColumns)
        .single();
      if (error || !data) throw new DataAccessError('Could not update profile.', error?.code === '42501' ? 403 : 500);
      return data as Profile;
    },

    async listMetricDefinitions(accessToken): Promise<MetricDefinition[]> {
      const { data, error } = await clientForUser(accessToken)
        .from('metric_definitions')
        .select('id,metric_key,version,display_names,value_kind,supported_units,value_shape')
        .eq('is_active', true)
        .order('metric_key')
        .order('version', { ascending: false });
      if (error) throw new DataAccessError('Could not load metric definitions.');
      return (data ?? []) as MetricDefinition[];
    },

    async listMeasurements(accessToken, userId): Promise<Measurement[]> {
      const { data, error } = await clientForUser(accessToken)
        .from('health_measurements')
        .select(measurementColumns)
        .eq('patient_id', userId)
        .order('measured_at', { ascending: false })
        .limit(100);
      if (error) throw new DataAccessError('Could not load measurements.', error.code === '42501' ? 403 : 500);
      return (data ?? []) as Measurement[];
    },

    async createMeasurement(accessToken, userId, input: NewMeasurement): Promise<Measurement> {
      const client = clientForUser(accessToken);
      const { data: definition, error: definitionError } = await client
        .from('metric_definitions')
        .select('id,supported_units')
        .eq('metric_key', input.metricKey)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (definitionError) throw new DataAccessError('Could not validate metric definition.');
      if (!definition) throw new DataAccessError('This metric is not available.', 422);
      if (!(definition.supported_units as string[]).includes(input.unit)) {
        throw new DataAccessError('Choose a supported unit for this metric.', 422);
      }

      const { data, error } = await client
        .from('health_measurements')
        .insert({
          patient_id: userId,
          metric_definition_id: definition.id,
          numeric_value: input.numericValue,
          unit: input.unit,
          measured_at: input.measuredAt,
          source_kind: 'patient_entry',
          entered_by: userId,
        })
        .select(measurementColumns)
        .single();

      if (error || !data) throw new DataAccessError('Could not save measurement.', error?.code === '42501' ? 403 : 500);
      return data as Measurement;
    },
  };
}