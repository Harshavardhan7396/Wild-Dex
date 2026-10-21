export type ConservationStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface TaxonomyHierarchy {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
}

export interface SpeciesMetric {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  icon?: string;
}

export interface PreyItem {
  name: string;
  scientificName?: string;
  percentage: number;
  description: string;
  photoUrl: string;
}

export interface LifeStage {
  stageNumber: number;
  name: string;
  subtitle: string;
  badge: string;
  duration: string;
  description: string;
  keyMilestones: { title: string; detail: string }[];
  environmentalRequirements?: { label: string; value: string; icon: string }[];
  imageUrl: string;
  imageAlt: string;
  isAiGeneratedImage?: boolean;
}

export interface SpeciesHealthInfo {
  vulnerabilityOverview: string;
  commonStressors: string[];
  clinicalSigns: { sign: string; severity: 'Mild' | 'Moderate' | 'Urgent'; advice: string }[];
  veterinaryNote?: string;
}

export interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  taxonomy: TaxonomyHierarchy;
  category: 'mammals' | 'birds' | 'reptiles' | 'amphibians' | 'insects' | 'marine' | 'plants' | 'fungi';
  conservationStatus: ConservationStatus;
  statusLabel: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary';
  population?: string;
  nativeRegion: string;
  habitat: string;
  biomes: string[];
  description: string;
  source: 'iNaturalist' | 'Wikipedia' | 'GBIF' | 'Curated' | 'AI-generated';
  isAiGeneratedDescription?: boolean;
  photoUrl: string;
  photoCredit?: string;
  galleryUrls: string[];
  audioUrl?: string;
  locationName?: string;
  coordinates?: { latitude: number; longitude: number };
  metrics?: SpeciesMetric[];
  preyGuild?: {
    category: string;
    description: string;
    items: PreyItem[];
    strategyNote?: string;
  };
  lifeStages?: LifeStage[];
  healthInfo?: SpeciesHealthInfo;
  relatedSpeciesIds?: string[];
  threats?: string[];
}

export interface ObservationLog {
  id: string;
  speciesId: string;
  speciesName: string;
  scientificName: string;
  photoUrl: string;
  userName: string;
  userAvatar: string;
  locationName: string;
  timeAgo: string;
  aiMatchScore: number;
  caption: string;
  claps: number;
  commentsCount: number;
  isWishlisted?: boolean;
  tags?: string[];
}
