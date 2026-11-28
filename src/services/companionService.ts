import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CompanionApiResponse,
  CompanionRequestPayload,
} from '../types/wilddex2';

/**
 * Sends a question to the server-side AI Nature Companion (/api/companion).
 * Attaches the signed-in user's Supabase Bearer JWT so quota and auth checks
 * are enforced on the server without ever touching Gemini keys on the client.
 */
export async function askNatureCompanion(
  payload: CompanionRequestPayload
): Promise<CompanionApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch {
      // Proceed as guest if session lookup is unavailable
    }
  }

  const response = await fetch('/api/companion', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => ({}))) as CompanionApiResponse;
  if (!response.ok) {
    return {
      success: false,
      model: json.model || '',
      error: json.error || `Request failed with status ${response.status}`,
      retryAfterSeconds: json.retryAfterSeconds,
      quota: json.quota,
    };
  }

  return json;
}
