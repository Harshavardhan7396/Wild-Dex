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

export interface FavoriteSpeciesItem {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl?: string;
}

export interface OnboardingSavePayload {
  interests: string[];
  favoriteSpecies: FavoriteSpeciesItem[];
  onboardingDone: boolean;
  locationConsent: boolean;
  homeLat: number | null;
  homeLng: number | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  isPublic?: boolean;
  onboardingCompleted: boolean;
  onboardingDone: boolean;
  interests: string[];
  favoriteSpecies: FavoriteSpeciesItem[];
  locationConsent: boolean;
  homeLat: number | null;
  homeLng: number | null;
  notInterestedIds: number[];
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
  signUpWithEmail: (
    email: string,
    password: string,
    username: string
  ) => Promise<{ user: AuthUser | null; session: any }>;
  signInWithEmail: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  saveOnboardingPreferences: (payload: OnboardingSavePayload) => Promise<void>;
  dismissSpeciesInterest: (taxonId: number) => Promise<void>;
  resetDismissedSpecies: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function roundCoord(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function parseFavoriteSpecies(raw: unknown): FavoriteSpeciesItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): FavoriteSpeciesItem | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'number' ? obj.id : Number(obj.id);
      const commonName = typeof obj.commonName === 'string'
        ? obj.commonName
        : typeof obj.common_name === 'string'
        ? obj.common_name
        : typeof obj.name === 'string'
        ? obj.name
        : '';
      const scientificName = typeof obj.scientificName === 'string'
        ? obj.scientificName
        : typeof obj.scientific_name === 'string'
        ? obj.scientific_name
        : '';
      if (!commonName && !scientificName) return null;
      return {
        id: Number.isFinite(id) ? id : 0,
        commonName: commonName || scientificName,
        scientificName: scientificName || commonName,
        photoUrl:
          typeof obj.photoUrl === 'string'
            ? obj.photoUrl
            : typeof obj.photo_url === 'string'
            ? obj.photo_url
            : undefined,
      };
    })
    .filter((x): x is FavoriteSpeciesItem => x !== null);
}

const NOT_INTERESTED_KEY_PREFIX = 'wilddex_not_interested_';

function getLocalNotInterestedIds(userId: string): number[] {
  try {
    const raw = localStorage.getItem(`${NOT_INTERESTED_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function setLocalNotInterestedIds(userId: string, ids: number[]): void {
  try {
    localStorage.setItem(`${NOT_INTERESTED_KEY_PREFIX}${userId}`, JSON.stringify(ids));
  } catch {}
}

function parseNotInterestedIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}

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
      displayName:
        meta.username ||
        meta.display_name ||
        meta.full_name ||
        meta.name ||
        sbUser.email?.split('@')[0] ||
        'Nature Explorer',
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
        const onboardingDone = data.onboarding_done === true;
        const interests = Array.isArray(data.interests)
          ? data.interests.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        const favoriteSpecies = parseFavoriteSpecies(data.favorite_species);
        const locationConsent = Boolean(data.location_consent);
        const rawHomeLoc =
          data.home_location && typeof data.home_location === 'object'
            ? (data.home_location as Record<string, unknown>)
            : null;
        const homeLat = roundCoord(
          typeof data.home_lat === 'number'
            ? data.home_lat
            : typeof rawHomeLoc?.lat === 'number'
            ? rawHomeLoc.lat
            : null
        );
        const homeLng = roundCoord(
          typeof data.home_lng === 'number'
            ? data.home_lng
            : typeof rawHomeLoc?.lng === 'number'
            ? rawHomeLoc.lng
            : null
        );
        const locationSummary =
          homeLat !== null && homeLng !== null
            ? `Near ${homeLat.toFixed(2)}, ${homeLng.toFixed(2)}`
            : 'Location not set';
        const remoteDismissed = parseNotInterestedIds(data.not_interested_taxa);
        const localDismissed = getLocalNotInterestedIds(authUser.id);
        const mergedDismissed = Array.from(new Set([...remoteDismissed, ...localDismissed]));
        setLocalNotInterestedIds(authUser.id, mergedDismissed);

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
          isPublic: data.is_public !== false,
          onboardingCompleted: onboardingDone,
          onboardingDone,
          interests,
          favoriteSpecies,
          locationConsent,
          homeLat,
          homeLng,
          notInterestedIds: mergedDismissed,
          experienceLevel: 'enthusiast',
          favoriteTaxa: interests.length > 0 ? interests.join(', ') : 'All Kingdoms',
          bio: data.bio || 'Exploring biodiversity with WildDex.',
          location: locationSummary,
          createdAt: data.created_at,
          updatedAt: data.created_at,
        });
      } else {
        const localDismissed = getLocalNotInterestedIds(authUser.id);
        // Upsert initial profile if trigger has not executed yet
        const initialProfile: UserProfile = {
          id: authUser.id,
          email: authUser.email || '',
          displayName: authUser.displayName || 'Nature Explorer',
          photoURL: authUser.photoURL || '',
          isPublic: true,
          onboardingCompleted: false,
          onboardingDone: false,
          interests: [],
          favoriteSpecies: [],
          locationConsent: false,
          homeLat: null,
          homeLng: null,
          notInterestedIds: localDismissed,
          experienceLevel: 'enthusiast',
          favoriteTaxa: 'All Kingdoms',
          bio: 'Exploring biodiversity with WildDex.',
          location: 'Location not set',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase.from('profiles').upsert(
          [
            {
              id: authUser.id,
              display_name: initialProfile.displayName,
              avatar_url: initialProfile.photoURL,
              bio: initialProfile.bio,
              is_public: true,
              onboarding_done: false,
            },
          ],
          { onConflict: 'id', ignoreDuplicates: true }
        );

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

  const signUpWithEmail = async (
    email: string,
    password: string,
    username: string
  ): Promise<{ user: AuthUser | null; session: any }> => {
    if (!isSupabaseConfigured) {
      const err = new Error(
        'Supabase configuration missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Please set these environment variables.'
      );
      console.error(err);
      throw err;
    }

    try {
      const cleanUsername = username.trim();
      const cleanEmail = email.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanUsername,
            full_name: cleanUsername,
          },
        },
      });

      if (error) {
        console.error('Sign-up error from Supabase:', error);
        throw error;
      }

      // After sign-up, save the username in the profiles table
      if (data.user) {
        try {
          const { error: profileError } = await supabase.from('profiles').upsert(
            [
              {
                id: data.user.id,
                display_name: cleanUsername,
                bio: 'Exploring biodiversity with WildDex.',
                is_public: true,
                onboarding_done: false,
              },
            ],
            { onConflict: 'id', ignoreDuplicates: true }
          );

          if (profileError) {
            console.warn('[Supabase Profile Upsert Warning]:', profileError);
          }
        } catch (profileErr) {
          console.warn('[Supabase Profile Upsert Exception]:', profileErr);
        }

        const authUser = mapSupabaseUser(data.user);
        if (data.session) {
          setCurrentUser(authUser);
          await fetchUserProfile(authUser);
          setIsGuest(false);
          try {
            sessionStorage.removeItem('wilddex_guest_session');
          } catch {}
          setAuthModalOpen(false);
        }
        return { user: authUser, session: data.session };
      }

      return { user: null, session: null };
    } catch (err: any) {
      console.error('Sign-up error:', err);
      throw err;
    }
  };

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<AuthUser | null> => {
    if (!isSupabaseConfigured) {
      const err = new Error(
        'Supabase configuration missing: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Please set these environment variables.'
      );
      console.error(err);
      throw err;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign-in error from Supabase:', error);
        throw error;
      }

      if (data.user) {
        const authUser = mapSupabaseUser(data.user);
        setCurrentUser(authUser);
        await fetchUserProfile(authUser);
        setIsGuest(false);
        try {
          sessionStorage.removeItem('wilddex_guest_session');
        } catch {}
        setAuthModalOpen(false);
        return authUser;
      }

      return null;
    } catch (err: any) {
      console.error('Sign-in error:', err);
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
        if (data.isPublic !== undefined) updatePayload.is_public = data.isPublic;

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

  const saveOnboardingPreferences = async (payload: OnboardingSavePayload) => {
    const roundedLat = payload.locationConsent ? roundCoord(payload.homeLat) : null;
    const roundedLng = payload.locationConsent ? roundCoord(payload.homeLng) : null;

    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please check your environment settings.');
    }

    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userRes?.user) {
      throw new Error('Please sign in to save your preferences.');
    }

    const userId = userRes.user.id;
    const dbPayload: Record<string, any> = {
      id: userId,
      interests: payload.interests,
      favorite_species: payload.favoriteSpecies,
      onboarding_done: payload.onboardingDone,
      location_consent: payload.locationConsent,
      home_lat: roundedLat,
      home_lng: roundedLng,
    };

    const { error } = await supabase
      .from('profiles')
      .upsert([dbPayload], { onConflict: 'id' });

    if (error) {
      // Fallback if the table stores rounded home coordinates inside a single home_location JSON column
      if (
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        error.message?.toLowerCase().includes('home_lat') ||
        error.message?.toLowerCase().includes('home_lng')
      ) {
        const fallbackPayload = {
          id: userId,
          interests: payload.interests,
          favorite_species: payload.favoriteSpecies,
          onboarding_done: payload.onboardingDone,
          location_consent: payload.locationConsent,
          home_location:
            roundedLat !== null && roundedLng !== null
              ? { lat: roundedLat, lng: roundedLng }
              : null,
        };
        const { error: fallbackError } = await supabase
          .from('profiles')
          .upsert([fallbackPayload], { onConflict: 'id' });
        if (fallbackError) {
          console.error('Supabase saveOnboardingPreferences fallback error:', fallbackError);
          throw new Error(fallbackError.message || 'Could not save your preferences.');
        }
      } else {
        console.error('Supabase saveOnboardingPreferences error:', error);
        throw new Error(error.message || 'Could not save your preferences.');
      }
    }

    const locationSummary =
      roundedLat !== null && roundedLng !== null
        ? `Near ${roundedLat.toFixed(2)}, ${roundedLng.toFixed(2)}`
        : 'Location not set';

    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            onboardingCompleted: payload.onboardingDone,
            onboardingDone: payload.onboardingDone,
            interests: payload.interests,
            favoriteSpecies: payload.favoriteSpecies,
            locationConsent: payload.locationConsent,
            homeLat: roundedLat,
            homeLng: roundedLng,
            favoriteTaxa:
              payload.interests.length > 0 ? payload.interests.join(', ') : 'All Kingdoms',
            location: locationSummary,
          }
        : null
    );
  };

  const persistNotInterestedList = async (nextIds: number[]) => {
    const storageUserId = currentUser?.id || 'guest';
    setLocalNotInterestedIds(storageUserId, nextIds);

    if (!currentUser || !isSupabaseConfigured) {
      return;
    }

    try {
      const { data: userRes, error: authErr } = await supabase.auth.getUser();
      if (authErr || !userRes?.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ not_interested_taxa: nextIds })
        .eq('id', userRes.user.id);

      if (error) {
        if (
          error.code === 'PGRST204' ||
          error.code === '42703' ||
          error.message?.toLowerCase().includes('not_interested_taxa')
        ) {
          console.warn('profiles.not_interested_taxa column not present yet; kept locally per user.');
          return;
        }
        throw new Error(error.message || 'Could not save preference.');
      }
    } catch (err) {
      console.error('Error saving not_interested_taxa:', err);
      throw err;
    }
  };

  const dismissSpeciesInterest = async (taxonId: number) => {
    if (!taxonId || !Number.isFinite(taxonId)) return;
    const currentIds = userProfile?.notInterestedIds ?? getLocalNotInterestedIds(currentUser?.id || 'guest');
    if (currentIds.includes(taxonId)) return;
    const nextIds = [...currentIds, taxonId];
    setUserProfile((prev) => (prev ? { ...prev, notInterestedIds: nextIds } : prev));
    await persistNotInterestedList(nextIds);
  };

  const resetDismissedSpecies = async () => {
    setUserProfile((prev) => (prev ? { ...prev, notInterestedIds: [] } : prev));
    await persistNotInterestedList([]);
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
        signUpWithEmail,
        signInWithEmail,
        logout,
        updateUserProfile,
        saveOnboardingPreferences,
        dismissSpeciesInterest,
        resetDismissedSpecies,
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
