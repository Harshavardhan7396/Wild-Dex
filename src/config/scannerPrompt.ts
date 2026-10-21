/**
 * WildDex AI Specimen Scanner Configuration & Prompt Architecture
 * 
 * Model: Single constant defined as requested: gemini-3.8-flash
 */

export const GEMINI_SCANNER_MODEL = 'gemini-3.8-flash';

/**
 * System Instruction for Gemini Vision Model
 * Strictly enforces:
 * 1. Identify only what is clearly visible.
 * 2. Return a low confidence score (< 0.60) for blurry or partial subjects.
 * 3. Prefer genus-level answers over wrong species-level answers.
 * 4. Never fabricate scientific names under any circumstances.
 * 5. Handle non-biological or inanimate objects with notASpecies: true.
 */
export const SCANNER_SYSTEM_INSTRUCTION = `
You are the authoritative, rigorous computer-vision taxonomist and biodiversity identifier for the WildDex naturalist encyclopedia.

Your operational mandate and identification rules are ABSOLUTE:
1. IDENTIFY ONLY WHAT IS CLEARLY VISIBLE:
   - Ground all taxonomic assessments strictly in verifiable visual anatomical traits (e.g., plumage patterns, wing venation, leaf phyllotaxy, scale arrangement, dentition, spore morphology).
   - Never assume, hallucinate, or extrapolate unseen diagnostic features.

2. LOW CONFIDENCE FOR BLURRY, PARTIAL, OR DEGRADED IMAGES:
   - If the subject is out of focus, motion-blurred, silhouetted, partially cropped, heavily shadowed, or at extreme distance, you MUST assign a confidence score below 0.60 (e.g., 0.20 - 0.55).
   - In your reasoning, explicitly explain what optical or physical factors prevent high-confidence identification.

3. PREFER GENUS-LEVEL (OR FAMILY-LEVEL) OVER WRONG SPECIES:
   - If the specimen is recognizable to a genus or family, but lacks the specific diagnostic markers required to separate sibling species (e.g., subtle dorsal patterns, genitalia/spore microscopy, exact tooth formulas, seasonal floral anatomy), you MUST provide a genus-level classification (e.g. "Buteo sp.", "Opuntia sp.", "Amanita sp.", "Canis sp.") rather than a speculative, potentially incorrect species-level guess.
   - Set taxonomicRank to "genus" (or "family") accordingly.

4. NEVER FABRICATE SCIENTIFIC NAMES:
   - Every scientific name must be a real, authentic biological taxon recognized in standard biological taxonomy databases (GBIF, Catalogue of Life, iNaturalist, NCBI Taxonomy, ITIS).
   - Never generate pseudo-Latin, fictional binomials, or invented scientific names. If the species is undetermined, use standard taxonomic notation: "[ValidGenus] sp.".

5. INANIMATE OBJECTS & NON-SPECIES:
   - If the image shows an inanimate object, synthetic artifact, toy, mannequin, building, human, machine, or landscape devoid of a discernible focal organism, you MUST set:
     - "notASpecies": true
     - "confidence": 0.0
     - "commonName": "Not a Living Species"
     - "scientificName": "N/A"

6. SAFETY FLAGS & ALTERNATIVE CANDIDATES:
   - Flag potential hazards objectively: "venomous" (for venom-injecting fangs/stingers like vipers, stonefish, wasps), "toxic" (poisonous upon ingestion/contact like poison frogs, toxic mushrooms, hemlock), "endangered" (IUCN VU/EN/CR), "invasive" (known damaging non-native), and "harmless".
   - Always supply top 3 plausible alternate candidate taxa with explicit distinguishing reasons explaining why the primary candidate was favored or how they differ.

You must respond ONLY with valid JSON conforming to the requested response schema.
`.trim();

/**
 * User prompt sent alongside the specimen image
 */
export const SCANNER_USER_PROMPT = `
Analyze this specimen photo and identify the organism using rigorous biological taxonomy.
Examine visible morphology, coloration, posture, and environmental context.
Adhere strictly to your system instructions:
- If blurry, distant, or partial: confidence MUST be < 0.60.
- If sibling species cannot be verified from visible marks: provide a genus-level answer (e.g., "Genus sp.").
- Never fabricate scientific names.
- If not a living organism: set notASpecies: true with confidence 0.0.

Return structured JSON conforming to the schema.
`.trim();

/**
 * TypeScript interface for structured scanner response
 */
export interface ScanSafetyFlags {
  venomous: boolean;
  toxic: boolean;
  endangered: boolean;
  invasive: boolean;
  harmless: boolean;
}

export interface AlternateMatch {
  commonName: string;
  scientificName: string;
  confidence: number;
  distinctionReason: string;
}

export interface QuickFacts {
  habitat: string;
  diet: string;
  lifespan: string;
  size: string;
}

export interface SpecimenScanResult {
  commonName: string;
  scientificName: string;
  category: 'mammals' | 'birds' | 'reptiles' | 'amphibians' | 'insects' | 'marine' | 'plants' | 'fungi' | 'other';
  confidence: number;
  notASpecies: boolean;
  taxonomicRank: 'species' | 'subspecies' | 'genus' | 'family' | 'order' | 'unknown';
  reasoning: string;
  safetyFlags: ScanSafetyFlags;
  top3AlternateMatches: AlternateMatch[];
  quickFacts: QuickFacts;
}

/**
 * 5 Canonical Test Cases with Expected Outputs
 * Designed to test:
 * 1. High-clarity specimen with distinctive diagnostic markings.
 * 2. Blurry / motion-degraded partial subject (low confidence < 0.60 trigger).
 * 3. Ambiguous specimen requiring genus-level answer over speculative species.
 * 4. Inanimate synthetic object (notASpecies: true, confidence 0.0).
 * 5. Hazardous venomous specimen requiring safety flags and valid taxonomy.
 */
export interface ScannerTestCase {
  id: string;
  title: string;
  scenario: string;
  imageDescription: string;
  testInput: {
    photoSubject: string;
    imageQuality: 'crystal_clear' | 'blurry_distant' | 'partial_vegetative' | 'synthetic_object';
    visibleFieldMarks: string[];
  };
  expectedOutput: SpecimenScanResult;
}

export const SCANNER_TEST_CASES: ScannerTestCase[] = [
  {
    id: 'test-case-1-high-clarity',
    title: 'Test Case 1: High-Clarity Distinctive Specimen (Monarch Butterfly)',
    scenario: 'Sharp, macro image of an adult butterfly resting on milkweed with open wings.',
    imageDescription: 'Sharp focus showing vibrant tawny-orange wings with black veins, double row of white marginal dots, and slender black thorax.',
    testInput: {
      photoSubject: 'Adult Monarch Butterfly on Asclepias leaf',
      imageQuality: 'crystal_clear',
      visibleFieldMarks: [
        'Distinctive black vein lines across tawny-orange dorsal wing surfaces',
        'Double marginal row of white dots on black border',
        'Black abdomen with white thoracic speckles',
      ],
    },
    expectedOutput: {
      commonName: 'Monarch Butterfly',
      scientificName: 'Danaus plexippus',
      category: 'insects',
      confidence: 0.96,
      notASpecies: false,
      taxonomicRank: 'species',
      reasoning: 'Primary diagnostic venation and marginal white spots clearly visible without the black post-median line seen in Viceroy mimic (Limenitis archippus).',
      safetyFlags: {
        venomous: false,
        toxic: true,
        endangered: true,
        invasive: false,
        harmless: true,
      },
      top3AlternateMatches: [
        {
          commonName: 'Viceroy Butterfly',
          scientificName: 'Limenitis archippus',
          confidence: 0.03,
          distinctionReason: 'Lacks the characteristic horizontal post-median black line crossing the hindwing veins present on Viceroys.',
        },
        {
          commonName: 'Queen Butterfly',
          scientificName: 'Danaus gilippus',
          confidence: 0.01,
          distinctionReason: 'Queens have uniform chestnut-brown wings lacking the bright orange-bordered black venation of D. plexippus.',
        },
        {
          commonName: 'Soldier Butterfly',
          scientificName: 'Danaus eresimus',
          confidence: 0.0,
          distinctionReason: 'Soldiers feature distinct white patches on the underside and duskier ground color.',
        },
      ],
      quickFacts: {
        habitat: 'Meadows, prairie corridors, and milkweed patches',
        diet: 'Caterpillar: Asclepias (milkweed); Adult: Flower nectar',
        lifespan: '2 to 6 weeks (summer); up to 8-9 months (migratory generation)',
        size: 'Wingspan 8.9–10.2 cm (3.5–4.0 in)',
      },
    },
  },
  {
    id: 'test-case-2-blurry-low-confidence',
    title: 'Test Case 2: Blurry / Partial Subject (Distant Raptor in Fog)',
    scenario: 'Motion-blurred silhouette of a perched bird of prey on a distant fencepost under low lighting.',
    imageDescription: 'Severe camera shake, distance grain, and backlighting obscuring plumage color, eye color, and fine beak details.',
    testInput: {
      photoSubject: 'Distant raptor silhouette on telephone wire in fog',
      imageQuality: 'blurry_distant',
      visibleFieldMarks: [
        'Stocky raptor profile with broad shoulders',
        'Hooked raptorial bill',
        'Medium-length tail and feathered legs',
      ],
    },
    expectedOutput: {
      commonName: 'Buteo Hawk (Indeterminate)',
      scientificName: 'Buteo sp.',
      category: 'birds',
      confidence: 0.46, // Must be strictly < 0.60
      notASpecies: false,
      taxonomicRank: 'genus',
      reasoning: 'Severe motion blur, backlighting, and optical distance obscure patagial marks, tail banding, and ventral streaking required to confirm species. Low confidence assigned per system instructions.',
      safetyFlags: {
        venomous: false,
        toxic: false,
        endangered: false,
        invasive: false,
        harmless: true,
      },
      top3AlternateMatches: [
        {
          commonName: 'Red-tailed Hawk',
          scientificName: 'Buteo jamaicensis',
          confidence: 0.32,
          distinctionReason: 'Most common stocky Buteo in this habitat range, but patagial bars and belly band cannot be resolved.',
        },
        {
          commonName: 'Red-shouldered Hawk',
          scientificName: 'Buteo lineatus',
          confidence: 0.14,
          distinctionReason: 'Similar perched silhouette, but pale translucent wing crescents and rufous breast cannot be verified due to fog.',
        },
        {
          commonName: 'Rough-legged Hawk',
          scientificName: 'Buteo lagopus',
          confidence: 0.08,
          distinctionReason: 'Winter migrant sharing stocky posture; tarsal feathering cannot be discerned.',
        },
      ],
      quickFacts: {
        habitat: 'Open country, forest edges, and agricultural pastures',
        diet: 'Small rodents, lagomorphs, reptiles, and amphibians',
        lifespan: '10 to 18 years in the wild',
        size: 'Wingspan 110–145 cm (43–57 in)',
      },
    },
  },
  {
    id: 'test-case-3-genus-level-preference',
    title: 'Test Case 3: Prefer Genus-Level Over Wrong Species (Prickly Pear Cactus Pad)',
    scenario: 'Isolated spineless green pad of an unflowered Opuntia cactus.',
    imageDescription: 'A single flat cladode with visible areoles and glochids, but lacking flowers, fruits, or mature spines needed to identify the exact species.',
    testInput: {
      photoSubject: 'Flat jointed cactus cladode pad',
      imageQuality: 'partial_vegetative',
      visibleFieldMarks: [
        'Flattened paddle-shaped stem (cladode)',
        'Spaced circular areoles with tiny glochids',
        'Waxy green cuticle without active bloom or fruit',
      ],
    },
    expectedOutput: {
      commonName: 'Prickly Pear Cactus',
      scientificName: 'Opuntia sp.',
      category: 'plants',
      confidence: 0.78,
      notASpecies: false,
      taxonomicRank: 'genus',
      reasoning: 'Cladode morphology confirms genus Opuntia with certainty. However, definitive species delineation requires flower petal pigmentation, fruit morphology, or spine count, which are absent in this vegetative sample. Genus-level answer returned.',
      safetyFlags: {
        venomous: false,
        toxic: false,
        endangered: false,
        invasive: false,
        harmless: false, // Spines/glochids cause mechanical puncture
      },
      top3AlternateMatches: [
        {
          commonName: 'Eastern Prickly Pear',
          scientificName: 'Opuntia humifusa',
          confidence: 0.35,
          distinctionReason: 'Low-spreading growth habit is plausible, but absence of seasonal yellow flowers prevents confirmation.',
        },
        {
          commonName: 'Barbary Fig / Indian Fig',
          scientificName: 'Opuntia ficus-indica',
          confidence: 0.28,
          distinctionReason: 'Widely cultivated spineless variety, but pad dimensions and mature habit cannot be evaluated from a single segment.',
        },
        {
          commonName: 'Engelmann Prickly Pear',
          scientificName: 'Opuntia engelmannii',
          confidence: 0.15,
          distinctionReason: 'Typically exhibits stout white spines on upper areoles, which are reduced or absent on this specimen.',
        },
      ],
      quickFacts: {
        habitat: 'Arid scrub, coastal bluffs, and rocky slopes',
        diet: 'Autotrophic (Photosynthetic CAM metabolism)',
        lifespan: 'Perennial, 20+ years',
        size: 'Pads 15–40 cm; mature clumps 0.5–2.5 m tall',
      },
    },
  },
  {
    id: 'test-case-4-inanimate-object',
    title: 'Test Case 4: Non-Species / Inanimate Object (Ceramic Garden Frog)',
    scenario: 'A molded ceramic and painted resin frog figurine resting near garden gravel.',
    imageDescription: 'Glossy glazed surface, visible mold seams, lack of moist skin pores or authentic ocular anatomy.',
    testInput: {
      photoSubject: 'Glazed painted ceramic frog ornament',
      imageQuality: 'synthetic_object',
      visibleFieldMarks: [
        'Specular ceramic surface reflections',
        'Painted rigid pupils without natural cornea',
        'Visible casting mold seams along belly and leg joints',
      ],
    },
    expectedOutput: {
      commonName: 'Not a Living Species',
      scientificName: 'N/A',
      category: 'other',
      confidence: 0.0,
      notASpecies: true,
      taxonomicRank: 'unknown',
      reasoning: 'Specimen exhibits synthetic glaze, molded seams, painted unnatural irises, and rigid inorganic texture. It is a manufactured garden ornament, not a living biological organism.',
      safetyFlags: {
        venomous: false,
        toxic: false,
        endangered: false,
        invasive: false,
        harmless: true,
      },
      top3AlternateMatches: [
        {
          commonName: 'American Bullfrog (Visual Resemblance)',
          scientificName: 'Lithobates catesbeianus',
          confidence: 0.0,
          distinctionReason: 'Ceramic paint scheme vaguely mimics bullfrog coloration, but lacks living biological tissue.',
        },
        {
          commonName: 'Green Frog (Visual Resemblance)',
          scientificName: 'Lithobates clamitans',
          confidence: 0.0,
          distinctionReason: 'Lacks dorsolateral ridges and true tympanic membrane.',
        },
        {
          commonName: 'European Common Frog',
          scientificName: 'Rana temporaria',
          confidence: 0.0,
          distinctionReason: 'Superficial ornamental sculpture resemblance only.',
        },
      ],
      quickFacts: {
        habitat: 'Manufactured object / Garden decor',
        diet: 'None (Inorganic / synthetic ceramic)',
        lifespan: 'Indefinite (Non-biological)',
        size: 'Approx. 12 cm length',
      },
    },
  },
  {
    id: 'test-case-5-venomous-safety',
    title: 'Test Case 5: Potentially Hazardous Specimen (Western Diamondback Rattlesnake)',
    scenario: 'Sharp photograph of a coiled pit viper in desert scrub.',
    imageDescription: 'Broad triangular head with heat-sensing pit organs, diamond-patterned dorsal blotches, black-and-white banded tail, and distinct segmented keratin rattle.',
    testInput: {
      photoSubject: 'Coiled Crotalus atrox in Sonoran desert brush',
      imageQuality: 'crystal_clear',
      visibleFieldMarks: [
        'Distinctive brown diamond dorsal blotches bordered by white scales',
        'Black and white alternating tail bands ("coon tail")',
        'Triangular head with loreal pit between eye and nostril',
        'Segmented keratin tail rattle',
      ],
    },
    expectedOutput: {
      commonName: 'Western Diamondback Rattlesnake',
      scientificName: 'Crotalus atrox',
      category: 'reptiles',
      confidence: 0.95,
      notASpecies: false,
      taxonomicRank: 'species',
      reasoning: 'Characteristic dorsal diamond pattern with clean cream borders, paired with distinct black-and-white tail banding and terminal rattle, unambiguously identifies Crotalus atrox. High venom hazard flagged.',
      safetyFlags: {
        venomous: true,
        toxic: false,
        endangered: false,
        invasive: false,
        harmless: false,
      },
      top3AlternateMatches: [
        {
          commonName: 'Mojave Rattlesnake',
          scientificName: 'Crotalus scutulatus',
          confidence: 0.03,
          distinctionReason: 'Mojave has narrower black tail bands and enlarged scales between supraoculars.',
        },
        {
          commonName: 'Timber Rattlesnake',
          scientificName: 'Crotalus horridus',
          confidence: 0.01,
          distinctionReason: 'Timber rattlesnakes exhibit dark chevron crossbands and solid velvety-black tails.',
        },
        {
          commonName: 'Bullsnake (Harmless Mimic)',
          scientificName: 'Pituophis catenifer sayi',
          confidence: 0.01,
          distinctionReason: 'Bullsnakes lack rattles, heat-sensing loreal pits, and have round pupils rather than vertical slits.',
        },
      ],
      quickFacts: {
        habitat: 'Arid desert scrub, rocky canyons, and thorn woodlands',
        diet: 'Small mammals (mice, rats, rabbits), birds, and lizards',
        lifespan: '15 to 20 years in the wild',
        size: 'Total length 1.2–1.5 m (4–5 ft)',
      },
    },
  },
];
