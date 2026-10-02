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

export type AdminMembership = {
  id: string;
  user_id: string;
  role: 'platform_owner' | 'support_admin';
  permissions: string[];
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type SupportAdminInvitation = {
  id: string;
  email_normalized: string;
  permissions: string[];
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type DataAccess = {
  verifyAccessToken(accessToken: string): Promise<AuthIdentity | null>;
  getProfile(accessToken: string, userId: string): Promise<Profile | null>;
  updateProfile(accessToken: string, userId: string, changes: Partial<Pick<Profile, 'display_name' | 'preferred_locale'>>): Promise<Profile>;
  listMetricDefinitions(accessToken: string): Promise<MetricDefinition[]>;
  listMeasurements(accessToken: string, userId: string): Promise<Measurement[]>;
  createMeasurement(accessToken: string, userId: string, input: NewMeasurement): Promise<Measurement>;
  getAdminMembership(accessToken: string, userId: string): Promise<AdminMembership | null>;
  listAdminMemberships(accessToken: string): Promise<AdminMembership[]>;
  grantSupportAdmin(accessToken: string, userId: string, permissions: string[]): Promise<string>;
  updateSupportAdminPermissions(accessToken: string, membershipId: string, permissions: string[]): Promise<void>;
  revokeSupportAdmin(accessToken: string, membershipId: string): Promise<void>;
  acceptSupportAdminInvitation(accessToken: string): Promise<boolean>;
  listSupportAdminInvitations(accessToken: string): Promise<SupportAdminInvitation[]>;
  inviteSupportAdminByEmail(accessToken: string, email: string, permissions: string[]): Promise<string>;
  revokeSupportAdminInvitation(accessToken: string, invitationId: string): Promise<void>;
};

export class DataAccessError extends Error {
  constructor(message: string, readonly statusCode = 500) {
    super(message);
  }
}