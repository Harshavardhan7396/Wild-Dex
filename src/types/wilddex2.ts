// WildDex 2.0 Shared Domain & Database Contracts

export type SpeciesRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type VerificationStatus = 'verified_taxonomy' | 'scanner_unverified' | 'unverified';

export type TaxonomySource = 'trusted_catalog' | 'inaturalist_api' | 'ai_unverified' | 'unverified';

export type EcosystemId =
  | 'forest'
  | 'ocean'
  | 'desert'
  | 'mountain'
  | 'grassland'
  | 'freshwater'
  | 'wetlands'
  | 'microscopic';

export type EcologicalRelationshipType =
  | 'predator_prey'
  | 'pollination'
  | 'seed_dispersal'
  | 'habitat_dependency'
  | 'symbiosis'
  | 'parasitism'
  | 'competition';

export interface UserSpeciesEntry {
  id: string;
  userId: string;
  speciesKey: string;
  inatTaxonId: number | null;
  commonName: string;
  scientificName: string;
  category: string;
  rarity: SpeciesRarity;
  verificationStatus: VerificationStatus;
  taxonomySource: TaxonomySource;
  firstCollectionItemId: string | null;
  photoUrl: string;
  sightingCount: number;
  firstDiscoveredAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  createdAt: string;
}

export interface UserProgression {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  uniqueSpeciesCount: number;
  verifiedSpeciesCount: number;
  totalScansCount: number;
}

export interface RecordDiscoveryResponse {
  recorded: boolean;
  eligibleForXp: boolean;
  alreadyProcessed: boolean;
  isNewSpecies: boolean;
  verificationStatus: VerificationStatus;
  taxonomySource: TaxonomySource;
  speciesKey: string;
  inatTaxonId: number | null;
  xpAwarded: number;
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  unlockedAchievements: Array<{
    code: string;
    title: string;
    tier: string;
    xp_reward: number;
  }>;
  message?: string;
}

export type XpSourceType =
  | 'first_scan'
  | 'repeat_scan'
  | 'mission_claim'
  | 'achievement_unlock'
  | 'daily_challenge'
  | 'weekly_challenge'
  | 'streak_bonus';

export interface XpTransaction {
  id: string;
  sourceType: XpSourceType;
  sourceRef: string;
  xpAmount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface QuestMission {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: 'daily' | 'weekly';
  actionType: 'scan_any' | 'scan_category' | 'new_species' | 'community_post' | 'daily_challenge_play';
  targetCategory: string;
  targetCount: number;
  xpReward: number;
  periodKey: string;
  currentCount: number;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface QuestAchievement {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  targetMetric: 'unique_species' | 'total_scans' | 'streak_days' | 'level' | 'posts_count' | 'daily_wins';
  targetValue: number;
  xpReward: number;
  unlockedAt: string | null;
}

export interface QuestStateResponse {
  progression: UserProgression;
  missions: QuestMission[];
  achievements: QuestAchievement[];
  recentXp: XpTransaction[];
}

export interface SpeciesOfTheDayState {
  id: string;
  challengeDate: string;
  category: string;
  ecosystem: EcosystemId;
  difficulty: 'easy' | 'medium' | 'hard';
  imageUrl: string;
  clues: string[];
  sourceCitation: string;
  xpReward: number;
  attemptsUsed: number;
  maxAttempts: number;
  solved: boolean;
  xpEarned: number;
  answerCommonName: string | null;
  answerScientificName: string | null;
  funFact: string | null;
}

export interface DailyGuessResult {
  isCorrect: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  xpAwarded: number;
  answerCommonName: string | null;
  answerScientificName: string | null;
  funFact: string | null;
  unlockedAchievements: Array<{
    code: string;
    title: string;
    tier: string;
    xp_reward: number;
  }>;
}

export interface SpeciesRelationshipEdge {
  id: string;
  sourceSpeciesKey: string;
  sourceCommonName: string;
  sourceScientificName: string;
  targetSpeciesKey: string;
  targetCommonName: string;
  targetScientificName: string;
  relationshipType: EcologicalRelationshipType;
  direction: 'source_to_target' | 'bidirectional';
  ecologicalSummary: string;
  sourceCitation: string;
  sourceUrl: string;
  verified: boolean;
}

export interface PublicMapObservation {
  id: string;
  userId: string;
  speciesKey: string;
  speciesName: string;
  scientificName: string;
  category: string;
  ecosystem: EcosystemId;
  photoUrl: string;
  regionLabel: string;
  roundedLat: number;
  roundedLng: number;
  isPublicMap: boolean;
  observedAt: string;
}

export interface CompanionSpeciesContext {
  commonName?: string;
  scientificName?: string;
  category?: string;
  habitat?: string;
}

export interface CompanionHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompanionRequestPayload {
  message: string;
  history?: CompanionHistoryTurn[];
  speciesContext?: CompanionSpeciesContext;
}

export interface CompanionStructuredResponse {
  answer: string;
  confidenceLevel: 'high' | 'moderate' | 'uncertain';
  verifiedFactsSummary: string;
  uncertaintyNote: string;
  safetyNotice: string;
  followUpTopics: string[];
}

export interface CompanionApiResponse {
  success: boolean;
  model: string;
  data?: CompanionStructuredResponse;
  quota?: {
    remainingWindow: number;
    remainingDaily: number;
    authenticated: boolean;
  };
  error?: string;
  retryAfterSeconds?: number;
}
