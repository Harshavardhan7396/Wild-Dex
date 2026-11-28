import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  compressPostImageTo1280Jpeg,
  containsExactCoordinates,
  formatRelativeTime,
} from './communityService';

export type AskCategory =
  | 'animal'
  | 'bird'
  | 'insect'
  | 'reptile'
  | 'plant'
  | 'fungi'
  | 'marine'
  | 'other';

export type AskStatus = 'open' | 'solved';
export type AskFeedTab = 'open' | 'solved' | 'mine';

export interface AskCategoryMeta {
  id: AskCategory;
  label: string;
  chipLabel: string;
  icon: string;
}

export const ASK_CATEGORIES: AskCategoryMeta[] = [
  { id: 'animal', label: 'Animal', chipLabel: 'Animals', icon: 'pets' },
  { id: 'bird', label: 'Bird', chipLabel: 'Birds', icon: 'flutter_dash' },
  { id: 'insect', label: 'Insect', chipLabel: 'Insects', icon: 'pest_control' },
  { id: 'reptile', label: 'Reptile', chipLabel: 'Reptiles', icon: 'pest_control_rodent' },
  { id: 'plant', label: 'Plant', chipLabel: 'Plants', icon: 'local_florist' },
  { id: 'fungi', label: 'Fungi', chipLabel: 'Fungi', icon: 'eco' },
  { id: 'marine', label: 'Marine', chipLabel: 'Marine', icon: 'water' },
  { id: 'other', label: 'Other', chipLabel: 'Other', icon: 'help' },
];

export const ASK_SAFETY_NOTICE =
  'Never eat, touch or handle a wild mushroom, snake or plant because of an online answer. Ask a local expert.';

export const ASK_PAGE_SIZE = 10;

export function requiresAskSafetyNotice(category?: string | null): boolean {
  const normalized = (category || '').trim().toLowerCase();
  return normalized === 'fungi' || normalized === 'reptile' || normalized === 'plant';
}

export function getAskCategoryMeta(category?: string | null): AskCategoryMeta {
  const normalized = (category || '').trim().toLowerCase();
  return (
    ASK_CATEGORIES.find((c) => c.id === normalized) || {
      id: 'other',
      label: 'Other',
      chipLabel: 'Other',
      icon: 'help',
    }
  );
}

export { formatRelativeTime };

export interface AskAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface AskQuestion {
  id: string;
  authorId: string;
  title: string;
  description: string;
  category: AskCategory;
  photoPath: string;
  photoUrl: string;
  placeLabel: string;
  status: AskStatus;
  acceptedAnswerId: string | null;
  answerCount: number;
  createdAt: string;
  author: AskAuthor;
}

export interface AskQuestionCreateInput {
  photoSource: File | string;
  title: string;
  description: string;
  category: AskCategory;
  placeLabel: string;
}

export interface AskQuestionUpdateInput {
  title: string;
  description: string;
  category: AskCategory;
  placeLabel: string;
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('App database is not configured yet.');
  }
}

async function getAuthenticatedUserId(): Promise<string> {
  ensureConfigured();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('Please sign in to use Ask the community.');
  }
  return user.id;
}

export function resolveAskPhotoUrl(photoPath: string): string {
  if (!photoPath) return '';
  if (
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://') ||
    photoPath.startsWith('data:')
  ) {
    return photoPath;
  }
  const { data } = supabase.storage.from('asks').getPublicUrl(photoPath);
  return data?.publicUrl || '';
}

function normalizeCategory(raw: unknown): AskCategory {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const match = ASK_CATEGORIES.find((c) => c.id === value);
  return match ? match.id : 'other';
}

function normalizeStatus(raw: unknown): AskStatus {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'solved'
    ? 'solved'
    : 'open';
}

function normalizeAuthorFromRow(row: any, fallbackProfile?: AskAuthor): AskAuthor {
  const authorId = String(row?.author_id || fallbackProfile?.id || '');
  const rawNested = Array.isArray(row?.author) ? row.author[0] : row?.author;

  const username =
    (typeof row?.author_username === 'string' && row.author_username.trim()) ||
    (typeof row?.username === 'string' && row.username.trim()) ||
    (typeof rawNested?.username === 'string' && rawNested.username.trim()) ||
    fallbackProfile?.username ||
    '';

  const displayName =
    (typeof row?.author_display_name === 'string' && row.author_display_name.trim()) ||
    (typeof row?.display_name === 'string' && row.display_name.trim()) ||
    (typeof rawNested?.display_name === 'string' && rawNested.display_name.trim()) ||
    fallbackProfile?.displayName ||
    username ||
    'Explorer';

  const avatarUrl =
    (typeof row?.author_avatar_url === 'string' && row.author_avatar_url.trim()) ||
    (typeof row?.avatar_url === 'string' && row.avatar_url.trim()) ||
    (typeof rawNested?.avatar_url === 'string' && rawNested.avatar_url.trim()) ||
    fallbackProfile?.avatarUrl ||
    '';

  return {
    id: authorId,
    username,
    displayName,
    avatarUrl,
  };
}

function mapQuestionRow(row: any, profileMap?: Map<string, AskAuthor>): AskQuestion {
  const authorId = String(row?.author_id || '');
  const fallbackProfile = profileMap?.get(authorId);
  const photoPath = typeof row?.photo_path === 'string' ? row.photo_path : '';
  const rawCount = row?.answer_count ?? row?.answers_count ?? 0;
  const answerCount =
    typeof rawCount === 'number'
      ? Math.max(0, rawCount)
      : Number.isFinite(Number(rawCount))
      ? Math.max(0, Number(rawCount))
      : 0;

  return {
    id: String(row?.id || ''),
    authorId,
    title: typeof row?.title === 'string' ? row.title : '',
    description: typeof row?.description === 'string' ? row.description : '',
    category: normalizeCategory(row?.category),
    photoPath,
    photoUrl: resolveAskPhotoUrl(photoPath),
    placeLabel: typeof row?.place_label === 'string' ? row.place_label : '',
    status: normalizeStatus(row?.status),
    acceptedAnswerId:
      typeof row?.accepted_answer_id === 'string' && row.accepted_answer_id
        ? row.accepted_answer_id
        : null,
    answerCount,
    createdAt: typeof row?.created_at === 'string' ? row.created_at : new Date().toISOString(),
    author: normalizeAuthorFromRow(row, fallbackProfile),
  };
}

async function fetchPublicProfilesMap(userIds: string[]): Promise<Map<string, AskAuthor>> {
  const map = new Map<string, AskAuthor>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  try {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', uniqueIds);

    if (error || !Array.isArray(data)) {
      return map;
    }

    for (const row of data) {
      if (!row?.id) continue;
      const username =
        typeof row.username === 'string' && row.username.trim()
          ? row.username.trim()
          : '';
      const displayName =
        (typeof row.display_name === 'string' && row.display_name.trim()) ||
        username ||
        'Explorer';
      map.set(row.id, {
        id: row.id,
        username,
        displayName,
        avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : '',
      });
    }
  } catch {
    // Soft fallback if public_profiles is temporarily unavailable
  }

  return map;
}

/**
 * Loads questions using supabase.rpc('list_questions', { p_status, p_category, p_mine, p_limit: 10, p_offset }).
 */
export async function listQuestions(params: {
  tab: AskFeedTab;
  category: AskCategory | 'all';
  offset?: number;
}): Promise<{ questions: AskQuestion[]; hasMore: boolean }> {
  try {
    await getAuthenticatedUserId();

    const p_status: AskStatus | null =
      params.tab === 'open' ? 'open' : params.tab === 'solved' ? 'solved' : null;
    const p_mine = params.tab === 'mine';
    const p_category: AskCategory | null =
      params.category === 'all' ? null : params.category;
    const p_offset = Math.max(0, params.offset ?? 0);

    const { data, error } = await supabase.rpc('list_questions', {
      p_status,
      p_category,
      p_mine,
      p_limit: ASK_PAGE_SIZE,
      p_offset,
    });

    if (error) {
      throw new Error(error.message || 'Could not load questions.');
    }

    const rows = Array.isArray(data) ? data : [];
    const missingAuthorIds = rows
      .filter(
        (r: any) =>
          r?.author_id &&
          !r?.author_username &&
          !r?.username &&
          !r?.author?.username
      )
      .map((r: any) => String(r.author_id));

    const profileMap =
      missingAuthorIds.length > 0
        ? await fetchPublicProfilesMap(missingAuthorIds)
        : new Map<string, AskAuthor>();

    const questions = rows.map((row: any) => mapQuestionRow(row, profileMap));
    const hasMore = rows.length >= ASK_PAGE_SIZE;

    return { questions, hasMore };
  } catch (err: any) {
    console.error('[Ask] listQuestions failed:', err);
    throw new Error(err?.message || 'Could not load questions right now.');
  }
}

/**
 * Fetches a single question from id_questions by ID and resolves its author profile.
 */
export async function getAskQuestionById(
  questionId: string
): Promise<AskQuestion | null> {
  try {
    await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('id_questions')
      .select('*')
      .eq('id', questionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Could not load this question.');
    }
    if (!data) return null;

    const profileMap = data.author_id
      ? await fetchPublicProfilesMap([String(data.author_id)])
      : new Map<string, AskAuthor>();

    return mapQuestionRow(data, profileMap);
  } catch (err: any) {
    console.error('[Ask] getAskQuestionById failed:', err);
    throw new Error(err?.message || 'Could not load this question.');
  }
}

function validateQuestionFields(input: {
  title: string;
  description: string;
  category: AskCategory;
  placeLabel: string;
}): {
  cleanTitle: string;
  cleanDescription: string;
  category: AskCategory;
  cleanPlaceLabel: string;
} {
  const cleanTitle = input.title.trim();
  if (cleanTitle.length < 3 || cleanTitle.length > 120) {
    throw new Error('Title must be between 3 and 120 characters.');
  }

  const cleanDescription = input.description.trim();
  if (cleanDescription.length > 1000) {
    throw new Error('Description must be 1000 characters or fewer.');
  }

  const cleanPlaceLabel = input.placeLabel.trim();
  if (cleanPlaceLabel.length > 120) {
    throw new Error('Place name must be 120 characters or fewer.');
  }
  if (containsExactCoordinates(cleanPlaceLabel)) {
    throw new Error(
      'Please enter a general place name (like a town, park, or region), never exact coordinates.'
    );
  }

  const category = normalizeCategory(input.category);

  return {
    cleanTitle,
    cleanDescription,
    category,
    cleanPlaceLabel,
  };
}

async function removeAskPhotoPath(photoPath: string): Promise<void> {
  const cleanPath = (photoPath || '').trim();
  if (!cleanPath || cleanPath.startsWith('http') || cleanPath.startsWith('data:')) {
    return;
  }
  const { error } = await supabase.storage.from('asks').remove([cleanPath]);
  if (error) {
    throw new Error(error.message || 'Could not remove photo from storage.');
  }
}

/**
 * Compresses the photo to 1280px JPEG, uploads it to the public 'asks' bucket at
 * {user_id}/{timestamp}.jpg, and inserts into id_questions.
 */
export async function createAskQuestion(
  input: AskQuestionCreateInput
): Promise<AskQuestion> {
  const authUserId = await getAuthenticatedUserId();
  const { cleanTitle, cleanDescription, category, cleanPlaceLabel } =
    validateQuestionFields(input);

  let uploadedPath = '';
  try {
    const jpegBlob = await compressPostImageTo1280Jpeg(input.photoSource);
    const photoPath = `${authUserId}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('asks')
      .upload(photoPath, jpegBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Could not upload your photo.');
    }
    uploadedPath = photoPath;

    const { data, error } = await supabase
      .from('id_questions')
      .insert([
        {
          author_id: authUserId,
          title: cleanTitle,
          description: cleanDescription,
          category,
          photo_path: uploadedPath,
          place_label: cleanPlaceLabel,
          status: 'open',
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not post your question.');
    }

    const profileMap = await fetchPublicProfilesMap([authUserId]);
    return mapQuestionRow(data, profileMap);
  } catch (err: any) {
    if (uploadedPath) {
      try {
        await removeAskPhotoPath(uploadedPath);
      } catch {
        // Best-effort cleanup of orphan photo
      }
    }
    console.error('[Ask] createAskQuestion failed:', err);
    throw new Error(err?.message || 'Could not post your question.');
  }
}

/**
 * Allows the question owner to edit title, description, category, and place_label.
 */
export async function updateAskQuestion(
  questionId: string,
  input: AskQuestionUpdateInput
): Promise<AskQuestion> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { cleanTitle, cleanDescription, category, cleanPlaceLabel } =
      validateQuestionFields(input);

    const { data, error } = await supabase
      .from('id_questions')
      .update({
        title: cleanTitle,
        description: cleanDescription,
        category,
        place_label: cleanPlaceLabel,
      })
      .eq('id', questionId)
      .eq('author_id', authUserId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not save your changes.');
    }

    const profileMap = await fetchPublicProfilesMap([authUserId]);
    return mapQuestionRow(data, profileMap);
  } catch (err: any) {
    console.error('[Ask] updateAskQuestion failed:', err);
    throw new Error(err?.message || 'Could not save your changes.');
  }
}

/**
 * Deletes an owner's question from id_questions and removes its photo from the 'asks' bucket.
 */
export async function deleteAskQuestion(question: AskQuestion): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('id_questions')
      .delete()
      .eq('id', question.id)
      .eq('author_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not delete this question.');
    }

    if (question.photoPath) {
      try {
        await removeAskPhotoPath(question.photoPath);
      } catch (storageErr) {
        console.warn('[Ask] Question deleted, but failed to remove photo from asks bucket:', storageErr);
      }
    }
  } catch (err: any) {
    console.error('[Ask] deleteAskQuestion failed:', err);
    throw new Error(err?.message || 'Could not delete this question.');
  }
}

// ==============================================================================
// ANSWERS, VOTES, ACCEPT/REOPEN, AUTOCOMPLETE, REPORTS
// ==============================================================================

export interface AskAnswer {
  id: string;
  questionId: string;
  authorId: string;
  speciesName: string;
  scientificName: string;
  explanation: string;
  helpfulCount: number;
  hasVoted: boolean;
  isAccepted: boolean;
  createdAt: string;
  author: AskAuthor;
}

export interface AskAnswerCreateInput {
  questionId: string;
  speciesName: string;
  scientificName: string;
  explanation: string;
}

export interface AskTaxonSuggestion {
  id: number;
  commonName: string;
  scientificName: string;
  photoUrl?: string;
}

export const ASK_REPORT_REASONS: string[] = [
  'Wrong or unsafe advice',
  'Spam or off-topic',
  'Exact location of sensitive wildlife',
  'Harassment or inappropriate content',
];

function mapAnswerRow(
  row: any,
  profileMap: Map<string, AskAuthor>,
  votedIds: Set<string>,
  acceptedAnswerId: string | null
): AskAnswer {
  const id = String(row?.id || '');
  const authorId = String(row?.author_id || '');
  const fallbackProfile = profileMap.get(authorId);
  const rawHelpful =
    row?.helpful_count ?? row?.votes_count ?? row?.vote_count ?? 0;
  const helpfulCount =
    typeof rawHelpful === 'number'
      ? Math.max(0, rawHelpful)
      : Number.isFinite(Number(rawHelpful))
      ? Math.max(0, Number(rawHelpful))
      : 0;

  const rpcHasVoted =
    typeof row?.has_voted === 'boolean'
      ? row.has_voted
      : typeof row?.is_voted === 'boolean'
      ? row.is_voted
      : typeof row?.user_has_voted === 'boolean'
      ? row.user_has_voted
      : typeof row?.voted_by_me === 'boolean'
      ? row.voted_by_me
      : null;

  const hasVoted = rpcHasVoted !== null ? rpcHasVoted : votedIds.has(id);
  const isAccepted =
    Boolean(row?.is_accepted) ||
    (Boolean(acceptedAnswerId) && id === acceptedAnswerId);

  return {
    id,
    questionId: String(row?.question_id || ''),
    authorId,
    speciesName: typeof row?.species_name === 'string' ? row.species_name : '',
    scientificName:
      typeof row?.scientific_name === 'string' ? row.scientific_name : '',
    explanation: typeof row?.explanation === 'string' ? row.explanation : '',
    helpfulCount,
    hasVoted,
    isAccepted,
    createdAt:
      typeof row?.created_at === 'string'
        ? row.created_at
        : new Date().toISOString(),
    author: normalizeAuthorFromRow(row, fallbackProfile),
  };
}

export function sortAskAnswers(
  answers: AskAnswer[],
  acceptedAnswerId: string | null
): AskAnswer[] {
  return [...answers]
    .map((ans) => ({
      ...ans,
      isAccepted:
        Boolean(acceptedAnswerId) ? ans.id === acceptedAnswerId : ans.isAccepted,
    }))
    .sort((a, b) => {
      if (a.isAccepted !== b.isAccepted) {
        return a.isAccepted ? -1 : 1;
      }
      if (a.helpfulCount !== b.helpfulCount) {
        return b.helpfulCount - a.helpfulCount;
      }
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
}

/**
 * Loads answers with supabase.rpc('list_answers', { p_question }).
 */
export async function listQuestionAnswers(
  questionId: string,
  acceptedAnswerId: string | null
): Promise<AskAnswer[]> {
  try {
    const authUserId = await getAuthenticatedUserId();

    const { data, error } = await supabase.rpc('list_answers', {
      p_question: questionId,
    });

    if (error) {
      throw new Error(error.message || 'Could not load answers.');
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return [];

    const missingAuthorIds = rows
      .filter(
        (r: any) =>
          r?.author_id &&
          !r?.author_username &&
          !r?.username &&
          !r?.author?.username
      )
      .map((r: any) => String(r.author_id));

    const needsVoteLookup = rows.some(
      (r: any) =>
        typeof r?.has_voted !== 'boolean' &&
        typeof r?.is_voted !== 'boolean' &&
        typeof r?.user_has_voted !== 'boolean' &&
        typeof r?.voted_by_me !== 'boolean'
    );

    const answerIds = rows.map((r: any) => String(r?.id || '')).filter(Boolean);

    const [profileMap, votedIds] = await Promise.all([
      missingAuthorIds.length > 0
        ? fetchPublicProfilesMap(missingAuthorIds)
        : Promise.resolve(new Map<string, AskAuthor>()),
      needsVoteLookup && answerIds.length > 0
        ? (async () => {
            const set = new Set<string>();
            try {
              const { data: voteRows } = await supabase
                .from('id_answer_votes')
                .select('answer_id')
                .eq('user_id', authUserId)
                .in('answer_id', answerIds);
              if (Array.isArray(voteRows)) {
                for (const v of voteRows) {
                  if (v?.answer_id) set.add(String(v.answer_id));
                }
              }
            } catch {
              // Soft fallback if direct vote lookup is restricted
            }
            return set;
          })()
        : Promise.resolve(new Set<string>()),
    ]);

    const mapped = rows.map((row: any) =>
      mapAnswerRow(row, profileMap, votedIds, acceptedAnswerId)
    );

    return sortAskAnswers(mapped, acceptedAnswerId);
  } catch (err: any) {
    console.error('[Ask] listQuestionAnswers failed:', err);
    throw new Error(err?.message || 'Could not load answers right now.');
  }
}

/**
 * Searches species using iNaturalist taxa autocomplete.
 */
export async function searchAskSpecies(
  query: string,
  signal?: AbortSignal
): Promise<AskTaxonSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(
      trimmed
    )}&per_page=8`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`Could not search species (${res.status}).`);
    }
    const json = await res.json();
    if (!Array.isArray(json?.results)) return [];

    return json.results.map((taxon: any) => ({
      id: Number(taxon.id),
      commonName: taxon.preferred_common_name || taxon.name || 'Unknown species',
      scientificName: taxon.name || '',
      photoUrl:
        taxon.default_photo?.square_url ||
        taxon.default_photo?.medium_url ||
        undefined,
    }));
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new Error(err?.message || 'Could not search species right now.');
  }
}

/**
 * Inserts a new answer into id_answers with author_id = signed-in user's id.
 */
export async function createAskAnswer(
  input: AskAnswerCreateInput
): Promise<AskAnswer> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const cleanSpeciesName = input.speciesName.trim();
    const cleanScientificName = input.scientificName.trim();
    const cleanExplanation = input.explanation.trim();

    if (!cleanSpeciesName) {
      throw new Error('Please enter or choose a species name.');
    }
    if (cleanSpeciesName.length > 160) {
      throw new Error('Species name must be 160 characters or fewer.');
    }
    if (cleanScientificName.length > 160) {
      throw new Error('Scientific name must be 160 characters or fewer.');
    }
    if (cleanExplanation.length > 800) {
      throw new Error('Explanation must be 800 characters or fewer.');
    }

    const { data, error } = await supabase
      .from('id_answers')
      .insert([
        {
          question_id: input.questionId,
          author_id: authUserId,
          species_name: cleanSpeciesName,
          scientific_name: cleanScientificName,
          explanation: cleanExplanation,
        },
      ])
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Could not post your answer.');
    }

    const profileMap = await fetchPublicProfilesMap([authUserId]);
    return mapAnswerRow(data, profileMap, new Set<string>(), null);
  } catch (err: any) {
    console.error('[Ask] createAskAnswer failed:', err);
    throw new Error(err?.message || 'Could not post your answer.');
  }
}

/**
 * Deletes an owner's answer from id_answers.
 */
export async function deleteAskAnswer(answerId: string): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const { error } = await supabase
      .from('id_answers')
      .delete()
      .eq('id', answerId)
      .eq('author_id', authUserId);

    if (error) {
      throw new Error(error.message || 'Could not delete your answer.');
    }
  } catch (err: any) {
    console.error('[Ask] deleteAskAnswer failed:', err);
    throw new Error(err?.message || 'Could not delete your answer.');
  }
}

/**
 * Inserts or deletes a vote row in id_answer_votes for the signed-in user.
 */
export async function toggleAnswerHelpfulVote(
  answerId: string,
  currentlyVoted: boolean
): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();

    if (currentlyVoted) {
      const { error } = await supabase
        .from('id_answer_votes')
        .delete()
        .eq('answer_id', answerId)
        .eq('user_id', authUserId);

      if (error) {
        throw new Error(error.message || 'Could not remove your vote.');
      }
    } else {
      const { error } = await supabase
        .from('id_answer_votes')
        .insert([
          {
            answer_id: answerId,
            user_id: authUserId,
          },
        ]);

      if (error) {
        throw new Error(error.message || 'Could not mark this answer helpful.');
      }
    }
  } catch (err: any) {
    console.error('[Ask] toggleAnswerHelpfulVote failed:', err);
    throw new Error(err?.message || 'Could not update helpful vote.');
  }
}

/**
 * Asker accepts an answer via supabase.rpc('accept_answer', { p_answer }).
 */
export async function acceptAskAnswer(answerId: string): Promise<void> {
  try {
    await getAuthenticatedUserId();
    const { error } = await supabase.rpc('accept_answer', {
      p_answer: answerId,
    });

    if (error) {
      throw new Error(error.message || 'Could not mark this as the best answer.');
    }
  } catch (err: any) {
    console.error('[Ask] acceptAskAnswer failed:', err);
    throw new Error(err?.message || 'Could not mark this as the best answer.');
  }
}

/**
 * Asker reopens a solved question via supabase.rpc('reopen_question', { p_question }).
 */
export async function reopenAskQuestion(questionId: string): Promise<void> {
  try {
    await getAuthenticatedUserId();
    const { error } = await supabase.rpc('reopen_question', {
      p_question: questionId,
    });

    if (error) {
      throw new Error(error.message || 'Could not reopen this question.');
    }
  } catch (err: any) {
    console.error('[Ask] reopenAskQuestion failed:', err);
    throw new Error(err?.message || 'Could not reopen this question.');
  }
}

/**
 * Submits a report to the reports table for a question or an answer.
 */
export async function submitAskReport(params: {
  targetType: 'question' | 'answer';
  targetId: string;
  reason: string;
}): Promise<void> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const cleanReason = params.reason.trim();
    if (!cleanReason) {
      throw new Error('Please choose a reason for reporting.');
    }

    const payload: Record<string, string> = {
      reporter_id: authUserId,
      reason: cleanReason,
    };
    if (params.targetType === 'question') {
      payload.question_id = params.targetId;
    } else {
      payload.answer_id = params.targetId;
    }

    const { error } = await supabase.from('reports').insert([payload]);

    if (error) {
      throw new Error(error.message || 'Could not submit report.');
    }
  } catch (err: any) {
    console.error('[Ask] submitAskReport failed:', err);
    throw new Error(err?.message || 'Could not submit report.');
  }
}

// ==============================================================================
// PROFILE STATS & TABS, COMMUNITY WIDGET, SCANNER PREFILL, SETTINGS CLEANUP
// ==============================================================================

export interface ProfileAskAnswer {
  id: string;
  questionId: string;
  authorId: string;
  speciesName: string;
  scientificName: string;
  explanation: string;
  createdAt: string;
  questionTitle: string;
  questionPhotoUrl: string;
  questionStatus: AskStatus;
  isAccepted: boolean;
}

/**
 * Maps scanner specimen category strings to AskCategory values.
 */
export function mapScanCategoryToAskCategory(rawCategory?: string | null): AskCategory {
  const value = (rawCategory || '').trim().toLowerCase();
  if (!value) return 'other';
  if (value === 'bird' || value === 'birds') return 'bird';
  if (value === 'insect' || value === 'insects' || value.includes('arthropod') || value.includes('arachnid')) {
    return 'insect';
  }
  if (value === 'reptile' || value === 'reptiles') return 'reptile';
  if (
    value === 'plant' ||
    value === 'plants' ||
    value === 'flora' ||
    value === 'flower' ||
    value === 'flowers' ||
    value === 'tree' ||
    value === 'trees' ||
    value === 'crop' ||
    value === 'crops'
  ) {
    return 'plant';
  }
  if (value === 'fungi' || value === 'mushroom' || value === 'mycota') return 'fungi';
  if (value === 'marine' || value === 'fish' || value === 'aquatic') return 'marine';
  if (
    value === 'animal' ||
    value === 'animals' ||
    value === 'mammal' ||
    value === 'mammals' ||
    value === 'amphibian' ||
    value === 'amphibians' ||
    value === 'wildlife'
  ) {
    return 'animal';
  }
  return 'other';
}

/**
 * Fetches how many times a user's answer was marked as the best answer
 * using supabase.rpc('helper_count', { p_user }).
 */
export async function fetchHelperCount(userId: string): Promise<number> {
  if (!userId || !isSupabaseConfigured) return 0;
  try {
    const { data, error } = await supabase.rpc('helper_count', {
      p_user: userId,
    });

    if (error) {
      throw new Error(error.message || 'Could not load helper count.');
    }

    if (typeof data === 'number' && Number.isFinite(data)) {
      return Math.max(0, data);
    }
    if (typeof data === 'string' && data.trim() && Number.isFinite(Number(data))) {
      return Math.max(0, Number(data));
    }
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const val = first?.helper_count ?? first?.count ?? first;
      if (Number.isFinite(Number(val))) return Math.max(0, Number(val));
    }
    if (data && typeof data === 'object') {
      const val = (data as any).helper_count ?? (data as any).count;
      if (Number.isFinite(Number(val))) return Math.max(0, Number(val));
    }
    return 0;
  } catch (err: any) {
    console.error('[Ask] fetchHelperCount failed:', err);
    throw new Error(err?.message || 'Could not load helper count.');
  }
}

/**
 * Lists questions authored by a specific user, newest first, from id_questions.
 */
export async function listQuestionsByAuthor(
  authorId: string
): Promise<AskQuestion[]> {
  if (!authorId) return [];
  try {
    ensureConfigured();
    const { data, error } = await supabase
      .from('id_questions')
      .select('id, author_id, title, description, category, photo_path, place_label, status, accepted_answer_id, created_at')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Could not load questions.');
    }

    const rows = Array.isArray(data) ? data : [];
    const profileMap = await fetchPublicProfilesMap([authorId]);
    return rows.map((row: any) => mapQuestionRow(row, profileMap));
  } catch (err: any) {
    console.error('[Ask] listQuestionsByAuthor failed:', err);
    throw new Error(err?.message || 'Could not load questions.');
  }
}

/**
 * Lists answers authored by a specific user, newest first, from id_answers,
 * enriched with basic question context when accessible.
 */
export async function listAnswersByAuthor(
  authorId: string
): Promise<ProfileAskAnswer[]> {
  if (!authorId) return [];
  try {
    ensureConfigured();
    const { data, error } = await supabase
      .from('id_answers')
      .select('id, question_id, author_id, species_name, scientific_name, explanation, created_at')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Could not load answers.');
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return [];

    const questionIds = Array.from(
      new Set(rows.map((r: any) => String(r?.question_id || '')).filter(Boolean))
    );

    const questionMap = new Map<
      string,
      { title: string; photoUrl: string; status: AskStatus; acceptedAnswerId: string | null }
    >();

    if (questionIds.length > 0) {
      try {
        const { data: qRows } = await supabase
          .from('id_questions')
          .select('id, title, photo_path, status, accepted_answer_id')
          .in('id', questionIds);

        if (Array.isArray(qRows)) {
          for (const q of qRows) {
            if (!q?.id) continue;
            questionMap.set(String(q.id), {
              title: typeof q.title === 'string' ? q.title : 'Identification question',
              photoUrl: resolveAskPhotoUrl(typeof q.photo_path === 'string' ? q.photo_path : ''),
              status: normalizeStatus(q.status),
              acceptedAnswerId:
                typeof q.accepted_answer_id === 'string' && q.accepted_answer_id
                  ? q.accepted_answer_id
                  : null,
            });
          }
        }
      } catch {
        // Soft fallback if question metadata cannot be fetched
      }
    }

    return rows.map((row: any) => {
      const id = String(row?.id || '');
      const questionId = String(row?.question_id || '');
      const qInfo = questionMap.get(questionId);
      return {
        id,
        questionId,
        authorId: String(row?.author_id || authorId),
        speciesName: typeof row?.species_name === 'string' ? row.species_name : '',
        scientificName: typeof row?.scientific_name === 'string' ? row.scientific_name : '',
        explanation: typeof row?.explanation === 'string' ? row.explanation : '',
        createdAt: typeof row?.created_at === 'string' ? row.created_at : new Date().toISOString(),
        questionTitle: qInfo?.title || 'View question',
        questionPhotoUrl: qInfo?.photoUrl || '',
        questionStatus: qInfo?.status || 'open',
        isAccepted: Boolean(qInfo?.acceptedAnswerId && qInfo.acceptedAnswerId === id),
      };
    });
  } catch (err: any) {
    console.error('[Ask] listAnswersByAuthor failed:', err);
    throw new Error(err?.message || 'Could not load answers.');
  }
}

/**
 * Fetches the newest open questions for the Community "Can you help identify this?" card.
 */
export async function listNewestOpenQuestions(limit = 3): Promise<AskQuestion[]> {
  try {
    if (!isSupabaseConfigured) return [];
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user?.id) return [];

    const { data, error } = await supabase.rpc('list_questions', {
      p_status: 'open',
      p_category: null,
      p_mine: false,
      p_limit: limit,
      p_offset: 0,
    });

    if (error) {
      throw new Error(error.message || 'Could not load open questions.');
    }

    const rows = Array.isArray(data) ? data : [];
    const missingAuthorIds = rows
      .filter(
        (r: any) =>
          r?.author_id &&
          !r?.author_username &&
          !r?.username &&
          !r?.author?.username
      )
      .map((r: any) => String(r.author_id));

    const profileMap =
      missingAuthorIds.length > 0
        ? await fetchPublicProfilesMap(missingAuthorIds)
        : new Map<string, AskAuthor>();

    return rows.slice(0, limit).map((row: any) => mapQuestionRow(row, profileMap));
  } catch (err: any) {
    console.error('[Ask] listNewestOpenQuestions failed:', err);
    throw new Error(err?.message || 'Could not load open questions.');
  }
}

async function listAsksBucketPathsRecursive(prefix: string): Promise<string[]> {
  const collected: string[] = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from('asks')
      .list(prefix, { limit, offset });

    if (error) {
      throw new Error(error.message || 'Could not list stored Ask photos.');
    }

    const items = Array.isArray(data) ? data : [];
    for (const item of items) {
      if (!item?.name || item.name === '.emptyFolderPlaceholder') continue;
      const fullPath = `${prefix}/${item.name}`;
      if (item.id === null) {
        const nested = await listAsksBucketPathsRecursive(fullPath);
        collected.push(...nested);
      } else {
        collected.push(fullPath);
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return collected;
}

/**
 * Deletes all id_answers, all id_questions, and all photos in the 'asks' bucket
 * belonging to the signed-in user.
 */
export async function deleteAllAskData(): Promise<{
  deletedQuestions: number;
  deletedFiles: number;
}> {
  try {
    const authUserId = await getAuthenticatedUserId();
    const pathSet = new Set<string>();

    // 1. Collect photo paths from id_questions
    const { data: questionRows, error: qFetchErr } = await supabase
      .from('id_questions')
      .select('id, photo_path')
      .eq('author_id', authUserId);

    if (qFetchErr) {
      throw new Error(qFetchErr.message || 'Could not read your questions.');
    }

    for (const row of questionRows || []) {
      if (typeof row?.photo_path === 'string' && row.photo_path.trim()) {
        pathSet.add(row.photo_path.trim());
      }
    }

    // 2. Also list the user's folder in the 'asks' storage bucket
    const listedPaths = await listAsksBucketPathsRecursive(authUserId);
    for (const p of listedPaths) {
      pathSet.add(p);
    }

    const cleanPaths = Array.from(pathSet).filter(
      (p) => p.length > 0 && !p.startsWith('http') && !p.startsWith('data:')
    );

    // 3. Remove photos in batches of 100
    for (let i = 0; i < cleanPaths.length; i += 100) {
      const chunk = cleanPaths.slice(i, i + 100);
      const { error: removeErr } = await supabase.storage.from('asks').remove(chunk);
      if (removeErr) {
        throw new Error(removeErr.message || 'Could not delete your Ask photos.');
      }
    }

    // 4. Delete all answers authored by this user
    const { error: deleteAnsErr } = await supabase
      .from('id_answers')
      .delete()
      .eq('author_id', authUserId);

    if (deleteAnsErr) {
      throw new Error(deleteAnsErr.message || 'Could not delete your answers.');
    }

    // 5. Delete all questions authored by this user
    const { error: deleteQErr } = await supabase
      .from('id_questions')
      .delete()
      .eq('author_id', authUserId);

    if (deleteQErr) {
      throw new Error(deleteQErr.message || 'Could not delete your questions.');
    }

    return {
      deletedQuestions: (questionRows || []).length,
      deletedFiles: cleanPaths.length,
    };
  } catch (err: any) {
    console.error('[Ask] deleteAllAskData failed:', err);
    throw new Error(err?.message || 'Could not delete your questions and answers.');
  }
}
