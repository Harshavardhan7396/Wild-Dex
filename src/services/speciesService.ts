import { Species, ObservationLog, SpeciesHealthInfo } from '../types/species';
import { formatConservationStatus } from '../utils/formatters';

// Cache key for local storage
const SPECIES_CACHE_KEY = 'wilddex_species_cache_v2';

export const CURATED_SPECIES: Species[] = [
  {
    id: 'bengal-tiger',
    commonName: 'Bengal Tiger',
    scientificName: 'Panthera tigris tigris',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Carnivora',
      family: 'Felidae',
      genus: 'Panthera',
      species: 'Panthera tigris',
    },
    category: 'mammals',
    conservationStatus: 'EN',
    statusLabel: 'In Danger',
    rarity: 'Very Rare',
    population: '~3,900',
    nativeRegion: 'Indian Subcontinent',
    habitat: 'Tropical Moist Forests',
    biomes: ['Tropical Moist Deciduous', 'Sundarbans Mangrove Deltas', 'Terai Alluvial Grasslands'],
    description:
      'An apex solitary predator crucial for forest canopy health. Known for distinctive black stripes on vibrant reddish-orange fur, currently facing habitat corridor fragmentation.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBNC2KVDG8klLiKhZgH3c4aUWsUv6OFTPdF8KVnHhMl3-qE5NeqmdHCbCivAgZM3T4asa5IXmND8sA1QmqAj_lKfoxPbenLVOONaaTfPSibk_zEec_c4ZXS8yAqQCr-bgVqNodHhkX8acMyE-4Xvpc0VxiWzpe2iczjQPx_d100oxI1vUDCWkjs7k5gFmMJwY4yBbaIwixn1AlVo649pIl6VktNdYDoGiqlQbo7bF_-oBXn5c_3-Y4_gg',
    photoCredit: 'Dr. Aris Thorne • Ranthambore NP',
    galleryUrls: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBT1Vk8-9hUKw4Frw3tpIZzD58styirpv9U3qXgnLraZPAKBmcmeuO20BJuJQ1etsdK9jQ7tSCHyltIyd8RZHPu1tEs_A3m4GwYunaYiA5HBJ7KYfBWPJfHMz3vTVnY2TxJkT21oJjEgBCcVoTMo_YCe7r_V0IDM1W_uA7BiydhIV7S95ERJii4H2NWD1JSgSpkxLyV2OhwmGgmilKxEkqrn98aOmuVh_A4DJ1ANvxQ3MkgH2oRndcH7g',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCJlB23fqR0_f6jXuIIwJaPFvE2zlJc7Fjj3HjnX89XctA02xezKDk5vCm-_ioLyA_ziEQXIW_8bYknTiTcXuDOCMZ6PsUmujInrXDnk81J88ZYgi9L9ruAhrOdovmYqijupZ2eb2YmAfhuLlu8ltg0X6uMoVyEO0bXPhEnr5JCBiWEmY-JA659Rtd4Ojpk0KnAZKd_nY0Njczqx85zoCf9ZxHQ4QuoVvk3K2yv5fdOioQNp7qzH13WFw',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBaQk1pIgtLiRMiXMk_mhF2_mT8vlzD0WqJD4BODkUXQUreOl5OaPqWGwTqZdbHhtskXjSKDrDmrxISsYgY6PxJQN1fjJlV6_g8IscfMSAN5xH43C_DpcXt0cZ5B1mVkQG0nmBvoa5E9tiFP7_rmcCCIbYvGxk_PHBHKkXiVcR1xXTVcIgsuEEyE3fbppGREL_t3Dn43Kt3zxKSDGFaifAvf6hW4LtQSDYJ35HlEYJsZ2n8l3vcz5Z60Q',
    ],
    audioUrl: 'https://actions.google.com/sounds/v1/animals/tiger_growl.ogg',
    locationName: 'Ranthambore National Park, Rajasthan, India',
    coordinates: { latitude: 26.0173, longitude: 76.5026 },
    metrics: [
      { label: 'Mass (Male)', value: '180–260', unit: 'kg', subtext: 'Females: 100–160 kg', icon: 'scale' },
      { label: 'Top Sprint', value: '65', unit: 'km/h', subtext: 'Short ambushing bursts', icon: 'sprint' },
      { label: 'Wild Lifespan', value: '12–15', unit: 'Years', subtext: 'Up to 20 in reserves', icon: 'hourglass_bottom' },
      { label: 'Bite Force', value: '1,050', unit: 'PSI', subtext: 'Can crush vertebrae', icon: 'emergency' },
    ],
    preyGuild: {
      category: 'Carnivore',
      description: 'Consumes 18–40 kg flesh per kill cycle',
      strategyNote: 'Strictly ambush-driven: uses deep forest cover to stalk within 10–20 meters before a suffocating throat grasp.',
      items: [
        {
          name: 'Chital (Spotted Deer)',
          percentage: 52,
          description: 'Primary year-round prey',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA9G727ieRBZNqE9kv-BIBulxkiFyTzprzrh5rFlum-kOVUMnEK0I-H5__UvEVNcL9YFdehfdHGw-9ECiDz3d5I7LnLXXEDRxuz3pVORjUj_AFfKeM89lWPxLiYybIiqr221xNNKFyRDa42TJroconFL5j49fJWZM8P6iGsGmGFmQUda8_ODU8LZN5c-J8qNDmEP8imtV7KnnyCL_qiZUDSTr3tikiaYM_5SB2gGVdKLqhzfimM0KqtxQ',
        },
        {
          name: 'Sambar Deer',
          percentage: 28,
          description: 'High-caloric large ungulate',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjFtynOP0mtauK4LLrjLEhqL6K2ET5FgcPeZK810VDo1GWLVJMINo6cl2zTG2PNB4m3btYGpxOpmp9wM7OCyCEz3EV6U5BICqaM74KBT4QMN2TPVlE-zd2c6UPwqPkAZH1_qnyiVwG1arPjRc8bpAyDmz1IOE8UyG-RNKwpOM6Z252FegMhWvhSNF6joHXbUOMY_troh5AXz0gk673TkpT31fmzH_un0q_SDp3EmDEz42zsNWyOdNuA',
        },
        {
          name: 'Indian Wild Boar',
          percentage: 14,
          description: 'Secondary prey species',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwuBaIp9uJsJgT_3OYBmzg3xIMHWjUzJZ1WYzuWIl0I-x77MTxN_89rzZ5jTY53yuEnOKzfnQRcpwhjbfSYc7yKYPBeGBEZ-Nb-LELFCo11d6EJl1lHNDVyIFq1TS9sr81oYPHHoMYoPWGETjADxE3mNHuIplroH0fDhkl24TXYS_fBEWCUX9SgKu6QxR0Tqq5kXUdbpEL0chA_hGVMMA_4Kdj57gHyVSxX8MJdrNMpVp61uCvlA9CAA',
        },
        {
          name: 'Gaur (Indian Bison)',
          percentage: 6,
          description: 'Opportunistic heavy target',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjkVnlgMSShros4kxion5dtz_q9DLsiKdFqoVIoyYVTEmxPvzPeNtBd1BitsSOFjhtMWDlWeuThEP2XOkOplgMR4A8JI-QykYTJDhCjK6BoT1n8jsrAO9nSch0_4PVB87Eua-TF6ULmWX5_qLi5Hc5wQLa38Q_gl7cAOMrXstk0D6enO_EXM0ugKvRmCJjR-1ijsnsvw7EaA-aib4gZtDG_ufl9ueje6ALshj0uLQkMQmVe7Cg-kFBBQ',
        },
      ],
    },
    healthInfo: {
      vulnerabilityOverview:
        'Wild Bengal Tigers face increasing physiological stress from territorial compression and canine distemper virus (CDV) transmission from feral reservoir populations.',
      commonStressors: [
        'Canine Distemper Virus (CDV)',
        'Sarcoptic mange mite infestations',
        'Territorial puncture abscesses',
        'Corridor dehydration during dry summers',
      ],
      clinicalSigns: [
        {
          sign: 'Myoclonic twitches & head tilt',
          severity: 'Urgent',
          advice: 'Immediate wildlife veterinary quarantine for suspected neuro-tropic viral encephalitis (CDV).',
        },
        {
          sign: 'Extensive fur alopecia & crusting',
          severity: 'Moderate',
          advice: 'Anti-parasitic acaricide darting recommended for sarcoptic mange management.',
        },
        {
          sign: 'Deep claw lacerations on flanks',
          severity: 'Mild',
          advice: 'Monitor for secondary bacterial sepsis; healthy tigers typically self-groom and resolve superficial wounds.',
        },
      ],
      veterinaryNote:
        'Informational only. Emergency veterinarian intervention in reserves must be approved by the National Tiger Conservation Authority.',
    },
    lifeStages: [
      {
        stageNumber: 1,
        name: 'Cub',
        subtitle: 'Maternal Care & Scent Imprinting',
        badge: 'Stage 1 of 4',
        duration: '0–6 Months',
        description: 'Born blind and helpless in secluded dens. Nurse continuously and gain 100g daily under watchful maternal vigilance.',
        keyMilestones: [
          { title: 'Eyes Open & Den Explorations', detail: 'Sensory canals activate around day 12–14.' },
          { title: 'Canine Eruption', detail: 'Deciduous milk teeth emerge by month 2.' },
        ],
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJlB23fqR0_f6jXuIIwJaPFvE2zlJc7Fjj3HjnX89XctA02xezKDk5vCm-_ioLyA_ziEQXIW_8bYknTiTcXuDOCMZ6PsUmujInrXDnk81J88ZYgi9L9ruAhrOdovmYqijupZ2eb2YmAfhuLlu8ltg0X6uMoVyEO0bXPhEnr5JCBiWEmY-JA659Rtd4Ojpk0KnAZKd_nY0Njczqx85zoCf9ZxHQ4QuoVvk3K2yv5fdOioQNp7qzH13WFw',
        imageAlt: 'Young tiger cub in den grass',
      },
      {
        stageNumber: 2,
        name: 'Sub-Adult',
        subtitle: 'Mock Stalking & Cooperative Hunting',
        badge: 'Stage 2 of 4',
        duration: '1–2 Years',
        description: 'Follow the mother on hunting patrols, learning stalking tactics and territorial boundary marking.',
        keyMilestones: [
          { title: 'First Independent Kill', detail: 'Successfully takes down small chital fawns.' },
          { title: 'Permanent Dentition', detail: 'Massive adult canines finish calcification.' },
        ],
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaQk1pIgtLiRMiXMk_mhF2_mT8vlzD0WqJD4BODkUXQUreOl5OaPqWGwTqZdbHhtskXjSKDrDmrxISsYgY6PxJQN1fjJlV6_g8IscfMSAN5xH43C_DpcXt0cZ5B1mVkQG0nmBvoa5E9tiFP7_rmcCCIbYvGxk_PHBHKkXiVcR1xXTVcIgsuEEyE3fbppGREL_t3Dn43Kt3zxKSDGFaifAvf6hW4LtQSDYJ35HlEYJsZ2n8l3vcz5Z60Q',
        imageAlt: 'Sub-adult tiger in forest brush',
      },
      {
        stageNumber: 3,
        name: 'Dispersal',
        subtitle: 'Territorial Nomadism',
        badge: 'Stage 3 of 4',
        duration: '2–3 Years',
        description: 'Leave the natal territory in search of unclaimed territory, frequently traversing buffer corridors.',
        keyMilestones: [
          { title: 'Scent Marking Initiation', detail: 'Begins scraping trees and spraying facial gland oils.' },
          { title: 'Border Skirmishes', detail: 'Tests edges of established dominant male ranges.' },
        ],
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNC2KVDG8klLiKhZgH3c4aUWsUv6OFTPdF8KVnHhMl3-qE5NeqmdHCbCivAgZM3T4asa5IXmND8sA1QmqAj_lKfoxPbenLVOONaaTfPSibk_zEec_c4ZXS8yAqQCr-bgVqNodHhkX8acMyE-4Xvpc0VxiWzpe2iczjQPx_d100oxI1vUDCWkjs7k5gFmMJwY4yBbaIwixn1AlVo649pIl6VktNdYDoGiqlQbo7bF_-oBXn5c_3-Y4_gg',
        imageAlt: 'Dispersing young male tiger roaming',
      },
      {
        stageNumber: 4,
        name: 'Apex Resident',
        subtitle: 'Dominant Territory Guardian',
        badge: 'Stage 4 of 4',
        duration: '4+ Years',
        description: 'Commands 50–200 sq km of prime ungulate habitat, maintaining reproductive access and vocal roaring deterrence.',
        keyMilestones: [
          { title: 'Peak Musculoskeletal Mass', detail: 'Reaches full 220–260kg muscular density.' },
          { title: 'Siring Generations', detail: 'Protects core home range waterbodies for cubs.' },
        ],
        imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBT1Vk8-9hUKw4Frw3tpIZzD58styirpv9U3qXgnLraZPAKBmcmeuO20BJuJQ1etsdK9jQ7tSCHyltIyd8RZHPu1tEs_A3m4GwYunaYiA5HBJ7KYfBWPJfHMz3vTVnY2TxJkT21oJjEgBCcVoTMo_YCe7r_V0IDM1W_uA7BiydhIV7S95ERJii4H2NWD1JSgSpkxLyV2OhwmGgmilKxEkqrn98aOmuVh_A4DJ1ANvxQ3MkgH2oRndcH7g',
        imageAlt: 'Apex adult tiger at waterhole',
      },
    ],
    relatedSpeciesIds: ['siberian-tiger', 'amur-leopard'],
  },
  {
    id: 'javan-rhino',
    commonName: 'Javan Rhinoceros',
    scientificName: 'Rhinoceros sondaicus',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Perissodactyla',
      family: 'Rhinocerotidae',
      genus: 'Rhinoceros',
      species: 'Rhinoceros sondaicus',
    },
    category: 'mammals',
    conservationStatus: 'CR',
    statusLabel: 'In Serious Danger',
    rarity: 'Legendary',
    population: '~76 individuals',
    nativeRegion: 'Java, Indonesia',
    habitat: 'Tropical Lowland Rainforest',
    biomes: ['Ujung Kulon National Park', 'Dense Canopy Mud Wallows'],
    description:
      'One of the rarest large mammals on Earth. Survives in a single isolated reserve on the western tip of Java. Features mosaic armor-like dermal folds and a solitary horn up to 25 cm.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBNC2KVDG8klLiKhZgH3c4aUWsUv6OFTPdF8KVnHhMl3-qE5NeqmdHCbCivAgZM3T4asa5IXmND8sA1QmqAj_lKfoxPbenLVOONaaTfPSibk_zEec_c4ZXS8yAqQCr-bgVqNodHhkX8acMyE-4Xvpc0VxiWzpe2iczjQPx_d100oxI1vUDCWkjs7k5gFmMJwY4yBbaIwixn1AlVo649pIl6VktNdYDoGiqlQbo7bF_-oBXn5c_3-Y4_gg',
    photoCredit: 'World Wildlife Fund • Ujung Kulon Camera Trap',
    galleryUrls: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBaQk1pIgtLiRMiXMk_mhF2_mT8vlzD0WqJD4BODkUXQUreOl5OaPqWGwTqZdbHhtskXjSKDrDmrxISsYgY6PxJQN1fjJlV6_g8IscfMSAN5xH43C_DpcXt0cZ5B1mVkQG0nmBvoa5E9tiFP7_rmcCCIbYvGxk_PHBHKkXiVcR1xXTVcIgsuEEyE3fbppGREL_t3Dn43Kt3zxKSDGFaifAvf6hW4LtQSDYJ35HlEYJsZ2n8l3vcz5Z60Q',
    ],
    coordinates: { latitude: -6.7495, longitude: 105.3341 },
    locationName: 'Ujung Kulon National Park, Banten, Java, Indonesia',
    metrics: [
      { label: 'Wild Pop.', value: '76', unit: 'Total', subtext: 'Single surviving enclave', icon: 'emergency' },
      { label: 'Weight', value: '900–2,300', unit: 'kg', subtext: 'Armored mega-herbivore', icon: 'scale' },
      { label: 'Horn Length', value: '25', unit: 'cm', subtext: 'Single keratin horn (males)', icon: 'straighten' },
      { label: 'Wild Lifespan', value: '35–40', unit: 'Years', subtext: 'Solitary wallower', icon: 'hourglass_bottom' },
    ],
    preyGuild: {
      category: 'Herbivore',
      description: 'Browses 50+ kg pioneer foliage, fallen fruits, and saplings daily',
      strategyNote: 'Uses prehensile upper lip to strip twigs and saplings along dense river mud corridors.',
      items: [
        {
          name: 'Arenga Pinnata Palms',
          percentage: 45,
          description: 'Dominant dietary browse',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA9G727ieRBZNqE9kv-BIBulxkiFyTzprzrh5rFlum-kOVUMnEK0I-H5__UvEVNcL9YFdehfdHGw-9ECiDz3d5I7LnLXXEDRxuz3pVORjUj_AFfKeM89lWPxLiYybIiqr221xNNKFyRDa42TJroconFL5j49fJWZM8P6iGsGmGFmQUda8_ODU8LZN5c-J8qNDmEP8imtV7KnnyCL_qiZUDSTr3tikiaYM_5SB2gGVdKLqhzfimM0KqtxQ',
        },
        {
          name: 'Ficus Saplings',
          percentage: 35,
          description: 'Fallen forest fruits and young shoots',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjFtynOP0mtauK4LLrjLEhqL6K2ET5FgcPeZK810VDo1GWLVJMINo6cl2zTG2PNB4m3btYGpxOpmp9wM7OCyCEz3EV6U5BICqaM74KBT4QMN2TPVlE-zd2c6UPwqPkAZH1_qnyiVwG1arPjRc8bpAyDmz1IOE8UyG-RNKwpOM6Z252FegMhWvhSNF6joHXbUOMY_troh5AXz0gk673TkpT31fmzH_un0q_SDp3EmDEz42zsNWyOdNuA',
        },
      ],
    },
    healthInfo: {
      vulnerabilityOverview:
        'Catastrophic extinction vulnerability due to genetic bottlenecking and proximity to Krakatoa volcanic activity.',
      commonStressors: [
        'Extreme genetic inbreeding',
        'Invasive Arenga palm displacing browse plants',
        'Bovine disease transmission from feral cattle',
      ],
      clinicalSigns: [
        {
          sign: 'Severe corneal opacity & lethargy',
          severity: 'Urgent',
          advice: 'Immediate anti-infective veterinary protocol for infectious keratoconjunctivitis.',
        },
        {
          sign: 'Dermal skin cracking from lack of wallows',
          severity: 'Moderate',
          advice: 'Park rangers must ensure swamp wallow integrity during dry El Niño seasons.',
        },
      ],
      veterinaryNote: 'Informational only. Field diagnostics guided by Indonesian Ministry of Environment.',
    },
  },
  {
    id: 'amur-leopard',
    commonName: 'Amur Leopard',
    scientificName: 'Panthera pardus orientalis',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Carnivora',
      family: 'Felidae',
      genus: 'Panthera',
      species: 'Panthera pardus',
    },
    category: 'mammals',
    conservationStatus: 'CR',
    statusLabel: 'In Serious Danger',
    rarity: 'Legendary',
    population: '~120 in wild',
    nativeRegion: 'Russian Far East & Jilin, China',
    habitat: 'Temperate Coniferous-Deciduous Forests',
    biomes: ['Land of the Leopard National Park', 'Sikhote-Alin Mountains'],
    description:
      'The rarest big cat on Earth, adapted to severe winter snows with thick pale cream coats, long rosettes with thick rings, and extraordinary leaping abilities up to 3 meters vertically.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAmKSWwM44CDPkvKFWy8z5EyKpcdle4yew5KstBhbzIQnI-T6MUuBntUjSkPOPg2KYN_IcUHGWISQdw0fVVcpePZ88ENi4rSFF7gb4kq4QyWbn0Xtkh-gYU__R8aTVxhUtU8XzpmX_-O1zbP0k2JnO_50vg-58_F9xy_u5aYGJDif5dKx9aDpYho5oHvgThT6jqxOqOy20Wn7HEqM62KlOW8mHiYhGRVEYRm5JRbCVKVPJU_LxMleXVLw',
    photoCredit: 'Land of the Leopard National Park Camera Trap',
    galleryUrls: [],
    coordinates: { latitude: 43.15, longitude: 131.55 },
    locationName: 'Land of the Leopard National Park, Primorsky Krai, Russia',
    metrics: [
      { label: 'Wild Pop.', value: '120', unit: 'Total', subtext: 'Rebounding from 30', icon: 'emergency' },
      { label: 'Coat Length', value: '75', unit: 'mm', subtext: 'Winter adaptation', icon: 'straighten' },
      { label: 'Vertical Leap', value: '3.0', unit: 'm', subtext: 'Rock cliff mobility', icon: 'sprint' },
      { label: 'Top Speed', value: '60', unit: 'km/h', subtext: 'Deep snow stalker', icon: 'speed' },
    ],
    preyGuild: {
      category: 'Carnivore',
      description: 'Stalks Siberian roe deer and sika deer across snow corridors',
      strategyNote: 'Ambush predator that uses rocky outcrops for silent visual surveillance before sprinting.',
      items: [
        {
          name: 'Siberian Roe Deer',
          percentage: 60,
          description: 'Primary winter ungulate target',
          photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjFtynOP0mtauK4LLrjLEhqL6K2ET5FgcPeZK810VDo1GWLVJMINo6cl2zTG2PNB4m3btYGpxOpmp9wM7OCyCEz3EV6U5BICqaM74KBT4QMN2TPVlE-zd2c6UPwqPkAZH1_qnyiVwG1arPjRc8bpAyDmz1IOE8UyG-RNKwpOM6Z252FegMhWvhSNF6joHXbUOMY_troh5AXz0gk673TkpT31fmzH_un0q_SDp3EmDEz42zsNWyOdNuA',
        },
      ],
    },
    healthInfo: {
      vulnerabilityOverview:
        'Vulnerable to domestic animal viruses (canine distemper) and poaching snare trauma.',
      commonStressors: ['Canine Distemper Virus (CDV)', 'Forest fires destroying cover', 'Poaching snares'],
      clinicalSigns: [
        {
          sign: 'Severe neurological disorientation',
          severity: 'Urgent',
          advice: 'Immediate veterinary tranquilization and CDV antigen profiling.',
        },
      ],
      veterinaryNote: 'Informational only. Cross-border wildlife protocols overseen by Russian & Chinese biologists.',
    },
  },
  {
    id: 'siberian-tiger',
    commonName: 'Siberian Tiger',
    scientificName: 'Panthera tigris altaica',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Carnivora',
      family: 'Felidae',
      genus: 'Panthera',
      species: 'Panthera tigris',
    },
    category: 'mammals',
    conservationStatus: 'EN',
    statusLabel: 'In Danger',
    rarity: 'Legendary',
    population: '~500',
    nativeRegion: 'Russian Far East',
    habitat: 'Boreal & Temperate Forests',
    biomes: ['Sikhote-Alin Taiga', 'Korean Pine Broadleaf', 'Amur River Basin'],
    description:
      'The largest wild cat on Earth, adapted to severe sub-zero winters with dense pale golden fur, a subcutaneous belly fat shield, and vast home ranges spanning up to 1,000 sq km.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDJBkBIQp1dwc7PfFrara-4OcrJlyF-Aj0m6slLE_d7IUBSX-fywOTpHnHsuX3qc7BdR0W1RsEvqEQOgRgiERS0O9UL9k3aWMV-D7kEG0e6Zocgm7xT13mMxPfc7JLMaSZDxUHOaE_M2nd0wG6Z_yBPkYXuZ4XeX7qXFwZzL6a14LKdyiLmliuQHwTNgyMiM45E3NMzEaSE2246MLuoAouwRowmMisdWf1J5utesKuBXVKNA_KYtLQDFQ',
    galleryUrls: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAmKSWwM44CDPkvKFWy8z5EyKpcdle4yew5KstBhbzIQnI-T6MUuBntUjSkPOPg2KYN_IcUHGWISQdw0fVVcpePZ88ENi4rSFF7gb4kq4QyWbn0Xtkh-gYU__R8aTVxhUtU8XzpmX_-O1zbP0k2JnO_50vg-58_F9xy_u5aYGJDif5dKx9aDpYho5oHvgThT6jqxOqOy20Wn7HEqM62KlOW8mHiYhGRVEYRm5JRbCVKVPJU_LxMleXVLw',
    ],
    locationName: 'Sikhote-Alin Biosphere Reserve, Primorsky Krai, Russia',
    metrics: [
      { label: 'Mass (Male)', value: '260', unit: 'kg', subtext: '+18% heavier than Bengal', icon: 'scale' },
      { label: 'Total Length', value: '3.0m–3.3m', subtext: 'Extended spinal reach', icon: 'straighten' },
      { label: 'Winter Coat', value: '40–105mm', subtext: 'With 50mm fat shield', icon: 'texture' },
      { label: 'Temp Range', value: 'Down to -45°C', subtext: 'Sub-zero Siberian taiga', icon: 'thermostat' },
    ],
  },
  {
    id: 'yellow-banded-poison-frog',
    commonName: 'Yellow-Banded Poison Frog',
    scientificName: 'Dendrobates leucomelas',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Amphibia',
      order: 'Anura',
      family: 'Dendrobatidae',
      genus: 'Dendrobates',
      species: 'Dendrobates leucomelas',
    },
    category: 'amphibians',
    conservationStatus: 'LC',
    statusLabel: 'Common, Not in Danger',
    rarity: 'Rare',
    nativeRegion: 'Guiana Shield & Orinoco Basin',
    habitat: 'Humid Rainforest Floor',
    biomes: ['Neotropical Lowland', 'Amazonian Basin', 'Cloud Forest Understory'],
    description:
      'A diurnal dendrobatid noted for striking black and yellow warning aposematism. Accumulates toxic pumiliotoxin alkaloids from a specialized diet of native formicid ants and mites.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCVwHQkFS0U8H3_S7YeJ3rB9lracVYKKvv2XuW5cgRds_6BaT8ewOz9wI0d5rX2OmMHxLNLbcusyZJnF0M9qUlqAW16SD8xMkJjmZn6FHfI9uwgy80d4abnPGfRZYSOZo2LcbMDNcx88Itd-RbsTPCDFOm6N-xGzcpWPGpyz7Iwlj6BFCazsRmHMCKa4vWw3HfoorFP2YKwWmYqQbO6rVn6n-_lpDQOoYEWxUYbNGei8xgttVlxI_JgdQ',
    galleryUrls: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBirzrueQgLaQPNJIceXM9zMuG8rDiQ8Wp9CddftTntFSLIZawZOa9Ce-qoJXvguh53yh469xUdtIxVkrMsh0BJjqKJnOx1CqgHM5FdRxlCTR3zrbAl7ps8UNdHB8tXIiP5xsySSjTtiQ8n-T6d8WWr7xIqul70T5ReGsmnyjSOYE-5eCnmKwI_SylB8hPNz-POdfLCSVg-ze6EXfrKKTsrNYwRGa7SX2pkiSkg9vqJaq3Y0Yf7lMHRxw',
    ],
    metrics: [
      { label: 'Adult Size', value: '3.1–5.0', unit: 'cm', subtext: 'Compact dart frog', icon: 'straighten' },
      { label: 'Diet', value: 'Formicidae', subtext: 'Ants & Termites', icon: 'restaurant' },
      { label: 'Lifespan', value: '10–15', unit: 'Years', subtext: 'In pristine wild', icon: 'hourglass_bottom' },
      { label: 'Toxicity', value: 'Pumiliotoxin', subtext: 'Warning aposematism', icon: 'warning' },
    ],
  },
  {
    id: 'monarch-butterfly',
    commonName: 'Monarch Butterfly',
    scientificName: 'Danaus plexippus',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Arthropoda',
      class: 'Insecta',
      order: 'Lepidoptera',
      family: 'Nymphalidae',
      genus: 'Danaus',
      species: 'Danaus plexippus',
    },
    category: 'insects',
    conservationStatus: 'VU',
    statusLabel: 'At Risk',
    rarity: 'Uncommon',
    nativeRegion: 'North & Central America',
    habitat: 'Meadows & Waystations',
    biomes: ['Nearctic Grasslands', 'Oyamel Fir Forests', 'Coastal Wildflower Corridors'],
    description:
      'Famous for its multigenerational migration spanning up to 3,000 miles to Mexican overwintering reserves. The caterpillars depend strictly on milkweed (Asclepias), sequestering toxic cardiac glycosides.',
    source: 'iNaturalist',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDDHJsAt2FxmUsO5bKtlpfy0Z1qDVGgaJtnzo2LJzkKiFbkw0vuVKcalGH40n8XMhv1RhW3JMx6BX6unrMSNeTuwjQWdCQY4Pa2AC5CoxL_DDC5nWmQxHhn57CdVSFUgW8YpFQuR4R2rjCLTOGlsQUFhocM5Wkekwklf5wvUp6cVOgO4N2su-ixOPwHudzibzed0YvTupEf3GxaS5V4Mwcj0s9ZC7g1ks3T-2-SoHj6Qkp2WlXZgDogrg',
    galleryUrls: [],
  },
  {
    id: 'blue-whale',
    commonName: 'Blue Whale',
    scientificName: 'Balaenoptera musculus',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Artiodactyla',
      family: 'Balaenopteridae',
      genus: 'Balaenoptera',
      species: 'Balaenoptera musculus',
    },
    category: 'marine',
    conservationStatus: 'EN',
    statusLabel: 'In Danger',
    rarity: 'Legendary',
    nativeRegion: 'Global Oceans',
    habitat: 'Pelagic Ocean Zones',
    biomes: ['Polar Upwelling Zones', 'Deep Pelagic Waters'],
    description:
      'The largest animal ever known to have existed, reaching up to 30 meters and 190 metric tons. Filters huge swarms of Antarctic krill through baleen plates.',
    source: 'Wikipedia',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDtVHyv8BE6hPjSgCLzXbF57ihQ5ZfRFGS1PSIuFJSyAQ6yRwLO8o3uBfcOGuamePQ1hKqDygRP-fgUKNosBNePZJSQ4qhuPKnL5z5ejd3y5KPdi1LcA42GWoB5L7nIRfEAqqAoZE9hcsWIyOS9Vg24s2SsZa7MYrSqYBS15m-MyhnL_V0nJY5UeUkXUCHT6kjG6cBzozzmOzbLxjVp729Wpgs9CjfpAU1bRad5KtYuCt66-miGQnDOHA',
    galleryUrls: [],
  },
];

export const MOCK_FEED_OBSERVATIONS: ObservationLog[] = [
  {
    id: 'obs-1',
    speciesId: 'bengal-tiger',
    speciesName: 'Bengal Tiger',
    scientificName: 'Panthera tigris tigris • Carnivora',
    photoUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBNC2KVDG8klLiKhZgH3c4aUWsUv6OFTPdF8KVnHhMl3-qE5NeqmdHCbCivAgZM3T4asa5IXmND8sA1QmqAj_lKfoxPbenLVOONaaTfPSibk_zEec_c4ZXS8yAqQCr-bgVqNodHhkX8acMyE-4Xvpc0VxiWzpe2iczjQPx_d100oxI1vUDCWkjs7k5gFmMJwY4yBbaIwixn1AlVo649pIl6VktNdYDoGiqlQbo7bF_-oBXn5c_3-Y4_gg',
    userName: 'Dr. Aris Thorne',
    userAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ',
    locationName: 'Ranthambore National Park • 2h ago',
    timeAgo: '2h ago',
    aiMatchScore: 99.2,
    caption:
      '"Female tiger resting in morning mist near lake sector 3. Prime health with clean coat markings."',
    claps: 58,
    commentsCount: 9,
    isWishlisted: true,
    tags: ['Verified Specimen', 'Apex Predator'],
  },
];

/**
 * Deterministic Species of the Day calculation
 */
export function getSpeciesOfTheDay(): Species {
  const today = new Date();
  const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = Math.abs(dateSeed) % CURATED_SPECIES.length;
  return CURATED_SPECIES[index] || CURATED_SPECIES[0];
}

/**
 * Fetch real GBIF taxonomy information
 */
async function fetchGBIFTaxon(scientificName: string): Promise<Partial<Species> | null> {
  try {
    const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.usageKey && !data.species) return null;

    return {
      scientificName: data.species || data.scientificName || scientificName,
      taxonomy: {
        kingdom: data.kingdom || 'Animalia',
        phylum: data.phylum,
        class: data.class,
        order: data.order,
        family: data.family,
        genus: data.genus,
        species: data.species,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Fetch real taxa from iNaturalist API
 */
async function searchINaturalist(query: string): Promise<Species[]> {
  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=8`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];

    return data.results.map((item: any): Species => {
      const defaultPhoto = item.default_photo?.medium_url || item.default_photo?.url || '';
      const status = item.conservation_status?.status_name?.toUpperCase() || 'LC';
      const statusMap: Record<string, 'LC' | 'NT' | 'VU' | 'EN' | 'CR'> = {
        'LEAST CONCERN': 'LC',
        'NEAR THREATENED': 'NT',
        'VULNERABLE': 'VU',
        'ENDANGERED': 'EN',
        'CRITICALLY ENDANGERED': 'CR',
      };

      return {
        id: `inat-${item.id}`,
        commonName: item.preferred_common_name || item.name,
        scientificName: item.name,
        taxonomy: {
          genus: item.name.split(' ')[0],
        },
        category: mapIconicTaxonToCategory(item.iconic_taxon_name),
        conservationStatus: statusMap[status] || 'LC',
        statusLabel: formatConservationStatus(item.conservation_status?.status_name || statusMap[status] || 'LC'),
        rarity: status === 'ENDANGERED' ? 'Very Rare' : 'Common',
        nativeRegion: item.observations_count > 1000 ? 'Global / Widespread' : 'Regional Field',
        habitat: 'Natural Biome',
        biomes: ['Field Observation Site', 'Protected Reserve'],
        description:
          item.wikipedia_summary ||
          `Recorded ${item.observations_count?.toLocaleString() || 1} times by naturalists worldwide on iNaturalist.`,
        source: 'iNaturalist',
        photoUrl: defaultPhoto || CURATED_SPECIES[0].photoUrl,
        photoCredit: item.default_photo?.attribution || 'iNaturalist Naturalist Network',
        galleryUrls: defaultPhoto ? [defaultPhoto] : [],
        coordinates: { latitude: 20.0, longitude: 0.0 },
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch real Wikipedia page summary
 */
async function fetchWikipediaSummary(title: string): Promise<Partial<Species> | null> {
  try {
    const cleanTitle = title.replace(/^(inat-|wiki-)/, '').replace(/-/g, ' ');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.title) return null;

    const photo = data.originalimage?.source || data.thumbnail?.source;

    return {
      commonName: data.title,
      description: data.extract || '',
      photoUrl: photo,
      galleryUrls: photo ? [photo] : [],
      photoCredit: 'Wikimedia Commons Contributors',
    };
  } catch {
    return null;
  }
}

function mapIconicTaxonToCategory(taxon?: string): Species['category'] {
  if (!taxon) return 'mammals';
  const t = taxon.toLowerCase();
  if (t.includes('mammal')) return 'mammals';
  if (t.includes('aves') || t.includes('bird')) return 'birds';
  if (t.includes('reptil')) return 'reptiles';
  if (t.includes('amphibia')) return 'amphibians';
  if (t.includes('insect') || t.includes('arachnid')) return 'insects';
  if (t.includes('actinopterygii') || t.includes('mollusca')) return 'marine';
  if (t.includes('plantae')) return 'plants';
  if (t.includes('fungi')) return 'fungi';
  return 'mammals';
}

/**
 * Get single species by ID (checks cache, then curated list, then queries real APIs)
 */
export async function getSpeciesById(id: string): Promise<Species | null> {
  const cleanId = id.trim().toLowerCase();

  // 1. Check local cache
  const cached = getCachedSpecies(cleanId);
  if (cached) return cached;

  // 2. Check curated collection
  const found = CURATED_SPECIES.find(
    (s) =>
      s.id === cleanId ||
      s.scientificName.toLowerCase() === cleanId ||
      s.commonName.toLowerCase() === cleanId
  );
  if (found) {
    saveSpeciesToCache(found);
    return found;
  }

  // 3. Query real iNaturalist API
  try {
    const iNatResults = await searchINaturalist(cleanId);
    if (iNatResults && iNatResults.length > 0) {
      let candidate = iNatResults[0];

      // Enrich with Wikipedia description & high-res image
      const wiki = await fetchWikipediaSummary(candidate.commonName || candidate.scientificName);
      if (wiki) {
        candidate = {
          ...candidate,
          description: wiki.description || candidate.description,
          photoUrl: wiki.photoUrl || candidate.photoUrl,
          galleryUrls: wiki.galleryUrls?.length ? wiki.galleryUrls : candidate.galleryUrls,
        };
      }

      // Enrich with GBIF hierarchy
      const gbif = await fetchGBIFTaxon(candidate.scientificName);
      if (gbif && gbif.taxonomy) {
        candidate = {
          ...candidate,
          taxonomy: {
            ...candidate.taxonomy,
            ...gbif.taxonomy,
          },
        };
      }

      saveSpeciesToCache(candidate);
      return candidate;
    }
  } catch (err) {
    console.warn('Real API lookup error:', err);
  }

  // Fallback to first species
  return CURATED_SPECIES[0];
}

/**
 * Search species across local curated database and remote iNaturalist API
 */
export async function searchSpecies(
  query: string,
  categoryFilter?: string,
  statusFilter?: string
): Promise<Species[]> {
  const q = query.trim().toLowerCase();

  // Local filtering first
  let localResults = CURATED_SPECIES.filter((s) => {
    const matchQuery =
      !q ||
      s.commonName.toLowerCase().includes(q) ||
      s.scientificName.toLowerCase().includes(q) ||
      s.habitat.toLowerCase().includes(q) ||
      s.biomes.some((b) => b.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q);

    const matchCategory =
      !categoryFilter || categoryFilter === 'all' || s.category === categoryFilter;

    const matchStatus =
      !statusFilter ||
      statusFilter === 'all' ||
      (statusFilter === 'at-risk' && ['VU', 'EN', 'CR'].includes(s.conservationStatus));

    return matchQuery && matchCategory && matchStatus;
  });

  // If query is long enough and not enough local results, query real iNaturalist API
  if (q.length >= 2) {
    try {
      const remoteResults = await searchINaturalist(q);
      const combined = [...localResults];
      for (const rem of remoteResults) {
        if (!combined.some((c) => c.scientificName.toLowerCase() === rem.scientificName.toLowerCase())) {
          combined.push(rem);
        }
      }
      return combined;
    } catch {
      return localResults;
    }
  }

  return localResults;
}

/**
 * Local cache helpers
 */
export function getCachedSpecies(id: string): Species | null {
  try {
    const raw = localStorage.getItem(`${SPECIES_CACHE_KEY}_${id}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveSpeciesToCache(species: Species): void {
  try {
    localStorage.setItem(`${SPECIES_CACHE_KEY}_${species.id}`, JSON.stringify(species));
  } catch {}
}
