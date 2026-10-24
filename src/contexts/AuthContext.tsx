import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser {
  uid: string; // alias to id for 100% backward compatibility
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

// Compatibility export
export type User = AuthUser;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  onboardingCompleted: boolean;
  experienceLevel?: 'novice' | 'enthusiast' | 'researcher';
  favoriteTaxa?: string;
  bio?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('wilddex_guest_session') === 'true';
    } catch {
      return false;
    }
  });

  const continueAsGuest = () => {
    setIsGuest(true);
    try {
      sessionStorage.setItem('wilddex_guest_session', 'true');
    } catch {}
  };

  const mapSupabaseUser = (sbUser: SupabaseUser): AuthUser => {
    const meta = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      uid: sbUser.id,
      email: sbUser.email || '',
      displayName: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Nature Explorer',
      photoURL: meta.avatar_url || meta.picture || '',
    };
  };

  // Sync user profile document from Supabase profiles table
  const fetchUserProfile = async (authUser: AuthUser) => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error querying profiles table:', error);
      }

      if (data) {
        const resolvedName = data.display_name || authUser.displayName;
        const resolvedPhoto = data.avatar_url || authUser.photoURL;
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: resolvedName || prev.displayName,
                photoURL: resolvedPhoto !== undefined ? resolvedPhoto : prev.photoURL,
              }
            : prev
        );
        setUserProfile({
          id: data.id,
          email: authUser.email || '',
          displayName: resolvedName || 'Nature Explorer',
          photoURL: resolvedPhoto || '',
          onboardingCompleted: true,
          experienceLevel: 'enthusiast',
          favoriteTaxa: 'All Kingdoms',
          bio: data.bio || 'Exploring biodiversity with WildDex.',
          location: 'Field Research Site',
          createdAt: data.created_at,
          updatedAt: data.created_at,
        });
      } else {
        // Upsert initial profile if trigger has not executed yet
        const initialProfile: UserProfile = {
          id: authUser.id,
          email: authUser.email || '',
          displayName: authUser.displayName || 'Nature Explorer',
          photoURL: authUser.photoURL || '',
          onboardingCompleted: false,
          experienceLevel: 'enthusiast',
          favoriteTaxa: 'All Kingdoms',
          bio: 'Exploring biodiversity with WildDex.',
          location: 'Field Research Site',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase.from('profiles').upsert([
          {
            id: authUser.id,
            display_name: initialProfile.displayName,
            avatar_url: initialProfile.photoURL,
            bio: initialProfile.bio,
            is_public: true,
          },
        ]);

        if (upsertError) {
          console.warn('Could not upsert profile row:', upsertError);
        }

        setUserProfile(initialProfile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          const authUser = mapSupabaseUser(session.user);
          setCurrentUser(authUser);
          await fetchUserProfile(authUser);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      })
      .catch((err) => {
        console.error('Session retrieval error:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const authUser = mapSupabaseUser(session.user);
        setCurrentUser(authUser);
        await fetchUserProfile(authUser);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (): Promise<AuthUser | null> => {
    if (!isSupabaseConfigured) {
      const err = new Error(
        'Supabase configuration missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Please set these environment variables.'
      );
      console.error(err);
      throw err;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('Google sign-in error:', error);
        throw error;
      }
      setAuthModalOpen(false);
      return null;
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      setCurrentUser(null);
      setUserProfile(null);
      setIsGuest(false);
      try {
        sessionStorage.removeItem('wilddex_guest_session');
      } catch {}
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    try {
      if (isSupabaseConfigured) {
        const updatePayload: Record<string, any> = {};
        if (data.displayName !== undefined) updatePayload.display_name = data.displayName;
        if (data.photoURL !== undefined) updatePayload.avatar_url = data.photoURL;
        if (data.bio !== undefined) updatePayload.bio = data.bio;

        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', currentUser.id);

          if (error) {
            console.warn('Failed to update Supabase profile:', error);
          }
        }
      }

      setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isGuest,
        continueAsGuest,
        authModalOpen,
        setAuthModalOpen,
        signInWithGoogle,
        logout,
        updateUserProfile,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
