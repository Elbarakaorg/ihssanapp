export type ProfileType = 'patient' | 'caregiver' | 'clinician';

export type AuthIdentity = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  identity: AuthIdentity;
};

export type SignUpResult = {
  emailConfirmationRequired: boolean;
};

export type AuthRepository = {
  isConfigured: boolean;
  getSession(): Promise<AuthSession | null>;
  subscribe(onSessionChanged: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, profileType: ProfileType): Promise<SignUpResult>;
  confirmSignup(email: string, token: string): Promise<void>;
  resendSignupConfirmation(email: string): Promise<void>;
  signOut(): Promise<void>;
};