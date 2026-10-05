export type ProfileType = 'patient' | 'clinician';

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
  signInWithGoogle(profileType?: ProfileType): Promise<void>;
  signInWithApple(profileType?: ProfileType): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, profileType: ProfileType): Promise<SignUpResult>;
  confirmSignup(email: string, token: string): Promise<void>;
  resendSignupConfirmation(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
};