export type AuthIdentity = {
  id: string;
  email: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  preferred_locale: 'ar' | 'fr' | 'en';
};

export type MetricDefinition = {
  id: string;
  metric_key: string;
  version: number;
  display_names: Record<string, string>;
  value_kind: 'scalar' | 'composite';
  supported_units: string[];
  value_shape: Record<string, unknown>;
};

export type Measurement = {
  id: string;
  metric_definition_id: string;
  numeric_value: number | null;
  component_values: Record<string, unknown> | null;
  unit: string | null;
  measured_at: string;
  source_kind: string;
  source_label: string | null;
  created_at: string;
};

export type NewMeasurement = {
  metricKey: string;
  numericValue: number;
  unit: string;
  measuredAt: string;
};

export type DataAccess = {
  verifyAccessToken(accessToken: string): Promise<AuthIdentity | null>;
  getProfile(accessToken: string, userId: string): Promise<Profile | null>;
  updateProfile(accessToken: string, userId: string, changes: Partial<Pick<Profile, 'display_name' | 'preferred_locale'>>): Promise<Profile>;
  listMetricDefinitions(accessToken: string): Promise<MetricDefinition[]>;
  listMeasurements(accessToken: string, userId: string): Promise<Measurement[]>;
  createMeasurement(accessToken: string, userId: string, input: NewMeasurement): Promise<Measurement>;
};

export class DataAccessError extends Error {
  constructor(message: string, readonly statusCode = 500) {
    super(message);
  }
}