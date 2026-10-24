import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseUrl.includes('placeholder') &&
    supabaseUrl.startsWith('http')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing or incomplete configuration: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
      'Please configure them in your environment to enable Cloud storage, authentication, and collection persistence.'
  );
}

// Fallback dummy values to prevent runtime crashes during initial build/preview before user enters env vars
const effectiveUrl = isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co';
const effectiveKey = isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-anon-key';

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
