export interface SymptomOption {
  label: string;
  icon: string;
}

export type HealthSubjectType =
  | 'Pet'
  | 'Farm animal'
  | 'Wild animal'
  | 'Bird'
  | 'Fish'
  | 'Reptile'
  | 'Insect'
  | 'Plant'
  | 'Tree'
  | 'Crop'
  | 'Fungi';

const PET_AND_FARM_SYMPTOMS: SymptomOption[] = [
  { label: 'Vomiting', icon: '🤢' },
  { label: 'Diarrhea', icon: '💧' },
  { label: 'Coughing', icon: '💨' },
  { label: 'Limping', icon: '🦴' },
  { label: 'Not eating', icon: '🍽️' },
  { label: 'Excessive thirst', icon: '🥤' },
  { label: 'Itching or scratching', icon: '🐾' },
  { label: 'Hair loss', icon: '✨' },
  { label: 'Skin redness', icon: '🔴' },
  { label: 'Swollen belly', icon: '🫧' },
  { label: 'Eye or ear discharge', icon: '👂' },
  { label: 'Low energy', icon: '😴' },
  { label: 'Breathing fast', icon: '🫁' },
];

const WILD_ANIMAL_SYMPTOMS: SymptomOption[] = [
  { label: 'Limping', icon: '🦴' },
  { label: 'Not eating', icon: '🍽️' },
  { label: 'Low energy', icon: '😴' },
  { label: 'Breathing fast', icon: '🫁' },
  { label: 'Hair loss', icon: '✨' },
  { label: 'Skin redness', icon: '🔴' },
  { label: 'Eye or ear discharge', icon: '👁️' },
  { label: 'Swollen belly', icon: '🫧' },
  { label: 'Diarrhea', icon: '💧' },
  { label: 'Open wound or bleeding', icon: '🩹' },
  { label: 'Walking in circles', icon: '🌀' },
  { label: 'Shaking or trembling', icon: '〰️' },
  { label: 'Trouble standing up', icon: '⚠️' },
];

const BIRD_SYMPTOMS: SymptomOption[] = [
  { label: 'Fluffed feathers', icon: '🪶' },
  { label: 'Feather loss', icon: '✨' },
  { label: 'Tail bobbing', icon: '🐦' },
  { label: 'Sneezing', icon: '💨' },
  { label: 'Watery droppings', icon: '💧' },
  { label: 'Not eating', icon: '🍽️' },
  { label: 'Limping', icon: '🦴' },
  { label: 'Drooping wings', icon: '🪽' },
  { label: 'Sitting on cage floor', icon: '😴' },
  { label: 'Open-mouth breathing', icon: '🫁' },
  { label: 'Swollen or watery eyes', icon: '👁️' },
  { label: 'Crusty beak or feet', icon: '🩺' },
];

const FISH_SYMPTOMS: SymptomOption[] = [
  { label: 'Gasping at the surface', icon: '🫧' },
  { label: 'White spots', icon: '⚪' },
  { label: 'Torn fins', icon: '🐟' },
  { label: 'Floating sideways', icon: '🔄' },
  { label: 'Not eating', icon: '🍽️' },
  { label: 'Hiding', icon: '🪨' },
  { label: 'Rubbing on rocks or glass', icon: '〰️' },
  { label: 'Swollen belly', icon: '🎈' },
  { label: 'Cloudy eyes', icon: '👁️' },
  { label: 'Red or swollen gills', icon: '🔴' },
  { label: 'Cotton-like fuzz', icon: '☁️' },
  { label: 'Sitting on the bottom', icon: '⬇️' },
];

const REPTILE_SYMPTOMS: SymptomOption[] = [
  { label: 'Not shedding', icon: '🦎' },
  { label: 'Swollen eyes', icon: '👁️' },
  { label: 'Soft shell', icon: '🐢' },
  { label: 'Not eating', icon: '🍽️' },
  { label: 'Mouth bubbles', icon: '🫧' },
  { label: 'Low energy', icon: '😴' },
  { label: 'Limping', icon: '🦴' },
  { label: 'Dark skin color', icon: '🌑' },
  { label: 'Weight loss', icon: '📉' },
  { label: 'Runny droppings', icon: '💧' },
  { label: 'Swollen jaw or toes', icon: '🩹' },
  { label: 'Wheezing sound', icon: '💨' },
];

const INSECT_SYMPTOMS: SymptomOption[] = [
  { label: 'Not moving', icon: '🐛' },
  { label: 'Discolored body', icon: '🎨' },
  { label: 'Mold or white fuzz', icon: '☁️' },
  { label: 'Not eating', icon: '🍃' },
  { label: 'Torn or bent wings', icon: '🦋' },
  { label: 'Twitching legs', icon: '〰️' },
  { label: 'Swollen body', icon: '🫧' },
  { label: 'Tiny mites on body', icon: '🔍' },
  { label: 'Falling over often', icon: '🔄' },
  { label: 'Sticky fluid on body', icon: '💧' },
  { label: 'Dried or shriveled look', icon: '🍂' },
  { label: 'Weak flight or walking', icon: '😴' },
];

const PLANT_TREE_CROP_SYMPTOMS: SymptomOption[] = [
  { label: 'Yellow leaves', icon: '💛' },
  { label: 'Brown tips', icon: '🍂' },
  { label: 'Spots on leaves', icon: '🟤' },
  { label: 'Wilting', icon: '🥀' },
  { label: 'White powder', icon: '🤍' },
  { label: 'Holes in leaves', icon: '🕳️' },
  { label: 'Sticky leaves', icon: '🍯' },
  { label: 'Root rot smell', icon: '👃' },
  { label: 'Stunted growth', icon: '🌱' },
  { label: 'Fruit dropping', icon: '🍎' },
  { label: 'Curled leaves', icon: '🌀' },
  { label: 'Visible bugs or webbing', icon: '🕸️' },
];

const TREE_SYMPTOMS: SymptomOption[] = [
  ...PLANT_TREE_CROP_SYMPTOMS.slice(0, 10),
  { label: 'Peeling or cracked bark', icon: '🪵' },
  { label: 'Sap oozing from trunk', icon: '💧' },
];

const CROP_SYMPTOMS: SymptomOption[] = [
  ...PLANT_TREE_CROP_SYMPTOMS.slice(0, 10),
  { label: 'Flowers falling off', icon: '🌸' },
  { label: 'Mold on fruit or pods', icon: '☁️' },
];

const FUNGI_SYMPTOMS: SymptomOption[] = [
  { label: 'Odd color', icon: '🎨' },
  { label: 'Slimy texture', icon: '💧' },
  { label: 'Insect damage', icon: '🐛' },
  { label: 'Bad smell', icon: '👃' },
  { label: 'White mold growing on it', icon: '☁️' },
  { label: 'Dry or cracked cap', icon: '🍄' },
  { label: 'Mushy or soft stem', icon: '🫧' },
  { label: 'Dark black spots', icon: '⚫' },
  { label: 'Yellow liquid drops', icon: '💛' },
  { label: 'Falling over early', icon: '🥀' },
  { label: 'Stunted or twisted cap', icon: '🌀' },
  { label: 'Splitting edges', icon: '✂️' },
];

export const SYMPTOMS_BY_TYPE: Record<HealthSubjectType, SymptomOption[]> = {
  Pet: PET_AND_FARM_SYMPTOMS,
  'Farm animal': PET_AND_FARM_SYMPTOMS,
  'Wild animal': WILD_ANIMAL_SYMPTOMS,
  Bird: BIRD_SYMPTOMS,
  Fish: FISH_SYMPTOMS,
  Reptile: REPTILE_SYMPTOMS,
  Insect: INSECT_SYMPTOMS,
  Plant: PLANT_TREE_CROP_SYMPTOMS,
  Tree: TREE_SYMPTOMS,
  Crop: CROP_SYMPTOMS,
  Fungi: FUNGI_SYMPTOMS,
};

export function getSymptomsForType(type: string): SymptomOption[] {
  return SYMPTOMS_BY_TYPE[type as HealthSubjectType] ?? SYMPTOMS_BY_TYPE.Pet;
}
