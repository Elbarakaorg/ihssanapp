import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import type { AuthRepository, AuthSession, ProfileType, SignUpResult } from './auth-contract';

type AuthContextValue = {
  isConfigured: boolean;
  isReady: boolean;
  session: AuthSession | null;
  signInWithGoogle(profileType?: ProfileType): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, profileType: ProfileType): Promise<SignUpResult>;
  confirmSignup(email: string, token: string): Promise<void>;
  resendSignupConfirmation(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ repository, children }: PropsWithChildren<{ repository: AuthRepository }>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = repository.subscribe((nextSession) => {
      if (active) setSession(nextSession);
    });

    repository.getSession()
      .then((currentSession) => {
        if (active) setSession(currentSession);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  return (
    <AuthContext.Provider
      value={{
        isConfigured: repository.isConfigured,
        isReady,
        session,
        signInWithGoogle: repository.signInWithGoogle,
        signIn: repository.signIn,
        signUp: repository.signUp,
        confirmSignup: repository.confirmSignup,
        resendSignupConfirmation: repository.resendSignupConfirmation,
        updatePassword: repository.updatePassword,
        signOut: repository.signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}