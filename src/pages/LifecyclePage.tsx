import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

interface StageData {
  name: string;
  badge: string;
  sub: string;
  duration: string;
  desc: string;
  dayRange: string;
  dayVal: number;
  progress: string;
  imageUrl: string;
}

const STAGES: StageData[] = [
  {
    name: 'Egg (Ovum)',
    badge: 'Stage 1 of 4',
    sub: 'Embryonic Cell Division',
    duration: '3 – 5 Days Duration',
    desc: 'Attached with water-insoluble glue to the underside of young milkweed leaves. The pale-yellow ovum bears 20–30 vertical ridges. Developing head capsule darkens just hours prior to hatching.',
    dayRange: 'Day 1 – 4',
    dayVal: 2,
    progress: '0%',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCZ0pCWs8zRJx0ab36YKA4PKPvCRqMLiUxnVkTjx2T1YrHqjPWJ65L9oPoaVnkGYkm_5TDN6BemNUWGVtCT6k6MMcpFrOW5Xg6dl5sqBGViF_BslmESJ1TU6c8t2KFTMb9a-8edLGvwvkcEFFB-eVmOoeOrFOf8j1Q_U-JPC5M0VndalFyiiSo_VXVBYuZa5wsYHbdorDw2X7pMMKP_VsRQeu9j9bx-7a6eLRfutMd3ejyMye78vEW9jQ',
  },
  {
    name: 'Larva / Caterpillar',
    badge: 'Stage 2 of 4',
    sub: '5 Instar Feeding & Toxin Storage',
    duration: '10 – 14 Days Duration',
    desc: 'The ravenous caterpillar molts through five growth stages (instars), shedding its skin repeatedly while consuming leaf biomass and accumulating cardenolide defensive toxins.',
    dayRange: 'Day 5 – 17',
    dayVal: 10,
    progress: '33%',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCZWLBdA6BKIMMVqKsOV9LdAEgGFfttaSSs5KhHoingNft8U6RNXxK_fSGCtIbSxgu6ydfrmYe12m9GY2ezkraDQAZv5N9pCjCJc7JyP31mmjwVJ3LvTts7HPcuUCKyM_-qbHo06BwhNO7jhNnGTudAMalFBpBPGCT6YZQnFflOBNM7Haxxu_xSoWD4-pK4JAI1l1qLG9BVltrA6PAwRo2J9I1RUhjxmn8Y5L1VBdf6iXmRhOQtWkhEDw',
  },
  {
    name: 'Pupa / Chrysalis',
    badge: 'Stage 3 of 4',
    sub: 'Cellular Reorganization & Imaginal Discs',
    duration: '10 – 14 Days Duration',
    desc: 'Inside the emerald-green chrysalis banded with genuine metallic golden specks, juvenile tissues break down into nutrient fluid via digestive enzymes. Dormant clusters of cells called imaginal discs rapidly build wings, compound eyes, long antennae, and reproductive organs.',
    dayRange: 'Day 18 – 31',
    dayVal: 22,
    progress: '66%',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCT5PvBI750x4OiY1okM8YsM3W1pci00TQbpe_d76KzrUiiF4XbMVhf-P5iHHd7ATaZPzINwJ1jNDNVEyLHLyOHmVgdffgQDrsBOP8Ink_WqHjXCegn51FrUo8D0sPT2f9bvF8SM3HKXmC4_mYPLS5rG_2UgjL_J3nXlmAJ9nlmEN_dzR2EUeueSWosfDpD1uu_vE92ln_bZHbasOwQioL7JfnBMLIf3-J4JASCKAL4UHntCYRaY4vxWA',
  },
  {
    name: 'Adult Butterfly (Imago)',
    badge: 'Stage 4 of 4',
    sub: 'Eclosion & Navigational Flight',
    duration: '2–6 Wks / 9 Mo',
    desc: 'Pumping fluid from its swollen abdomen into soft wing veins, the butterfly dries in open air before taking flight. The final summer generation undergoes reproductive diapause to complete the continental migration.',
    dayRange: 'Day 32 – 45+',
    dayVal: 35,
    progress: '100%',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBFGHYaVu5g68f0Q565kctkGMEZTjBKLkC_p2ko_DUM6wKM5Snu-zHokbpEDV8WLU0X0u8AK3WbKhkXfzFPUyzOaCD2Kw7G5LGdt0t5lG8Lh1o6qr3gHGAj5n6rDlTK5wigC3LU-6GNnWfvedSaE_NfdSHZxYCP4Uhy640NYa-7ivy_T3nlYusNlTvEn-2mvONOSCYc_-n7hPQ55yki4RKvVU7Fg7h3wG4Zua8OBEDSurjwrMT6OE7PdA',
  },
];

export const LifecyclePage: React.FC = () => {
  const [currentStageIndex, setCurrentStageIndex] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [toast, setToast] = useState<string | null>(null);

  const activeStage = STAGES[currentStageIndex];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStageIndex((prev) => (prev + 1) % STAGES.length);
      }, 2600 / speed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, speed]);

  const handleScrub = (val: number) => {
    let target = 0;
    if (val >= 32) target = 3;
    else if (val >= 18) target = 2;
    else if (val >= 5) target = 1;
    else target = 0;
    setCurrentStageIndex(target);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-10 space-y-space-lg">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Taxonomy & Breadcrumb Header */}
      <div className="flex flex-col pt-space-xs space-y-space-xs">
        <div className="flex items-center gap-1.5 text-secondary">
          <span className="material-symbols-outlined text-[16px]">all_inclusive</span>
          <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            How It Grows • Lifecycle
          </span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-display-lg-mobile text-display-lg-mobile text-on-surface tracking-tight">
            Monarch Butterfly
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            <span className="text-xs text-on-surface-variant/70 mr-1.5">Science name:</span>
            <span className="italic">Danaus plexippus</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-container/50 text-on-secondary-container w-fit mt-1">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span className="font-label-md text-label-md">Four Growth Steps • 30–45 Days Total</span>
        </div>
      </div>

      {/* Interactive Stage Timeline Controller & Play Bar */}
      <div className="flex flex-col bg-surface-container rounded-2xl p-space-md shadow-sm space-y-space-md">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
            Life Stage Sequence
          </span>
          <span className="font-label-md text-label-md text-secondary font-bold">
            Stage {currentStageIndex + 1} of 4: {activeStage.name.split(' ')[0]}
          </span>
        </div>

        {/* Stepper Visualizer with Progress Line */}
        <div className="relative flex items-center justify-between px-2 py-1">
          <div className="absolute top-1/2 left-6 right-6 h-1 bg-surface-container-highest -translate-y-1/2 rounded-full"></div>
          <div
            className="absolute top-1/2 left-6 h-1 bg-secondary -translate-y-1/2 rounded-full transition-all duration-300"
            style={{ width: activeStage.progress }}
          ></div>

          {STAGES.map((st, i) => {
            const isActive = i === currentStageIndex;
            return (
              <button
                key={i}
                className="relative z-10 flex flex-col items-center group focus:outline-none"
                onClick={() => setCurrentStageIndex(i)}
                type="button"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-label-md text-label-md transition-transform ${
                    isActive
                      ? 'bg-secondary text-on-secondary shadow-md scale-110 font-bold'
                      : 'bg-surface-container-lowest text-on-surface-variant shadow group-hover:scale-105'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`font-label-sm text-label-sm mt-1 ${
                    isActive ? 'text-secondary font-bold' : 'text-on-surface-variant'
                  }`}
                >
                  {st.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrubber Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span className="font-label-md text-label-md font-semibold text-primary">
              {activeStage.dayRange} • {activeStage.name}
            </span>
            <span className="font-label-sm text-label-sm">Total ~45d</span>
          </div>
          <input
            className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
            max={40}
            min={1}
            type="range"
            value={activeStage.dayVal}
            onChange={(e) => handleScrub(Number(e.target.value))}
          />
        </div>

        {/* Media Controls */}
        <div className="flex items-center justify-between pt-1 gap-space-sm">
          <button
            className="flex-1 h-11 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow hover:bg-primary-container active:scale-95 transition-all"
            onClick={() => setIsPlaying(!isPlaying)}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause' : 'Play Progression'}</span>
          </button>
          <div className="flex bg-surface-container-high rounded-full p-1 gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-colors ${
                  speed === s
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Stage Spotlight Card */}
      <div className="relative overflow-hidden bg-surface-container-low rounded-3xl shadow-md p-space-md flex flex-col space-y-space-md">
        <div className="relative w-full h-64 rounded-2xl overflow-hidden shadow-inner bg-surface-container-highest">
          <img
            className="w-full h-full object-cover transition-opacity duration-300"
            alt={activeStage.name}
            src={activeStage.imageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-black/20"></div>

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md text-primary font-label-sm text-label-sm font-semibold shadow-sm">
              {activeStage.duration}
            </span>
            <span className="w-8 h-8 rounded-full bg-surface/90 backdrop-blur-md text-on-surface flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[18px]">biotech</span>
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 text-on-primary">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-bold">
              {activeStage.badge}
            </span>
            <h2 className="font-headline-md text-headline-md font-bold leading-tight">
              {activeStage.name}
            </h2>
            <p className="font-label-md text-label-md text-surface-container-lowest/90">
              {activeStage.sub}
            </p>
          </div>
        </div>

        {/* Micro-Environment Specs */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface shrink-0">
            <span className="material-symbols-outlined text-[18px] text-secondary">thermostat</span>
            <span className="font-label-sm text-label-sm">21°C – 26°C</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface shrink-0">
            <span className="material-symbols-outlined text-[18px] text-secondary">spa</span>
            <span className="font-label-sm text-label-sm">Milkweed Stalk</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface shrink-0">
            <span className="material-symbols-outlined text-[18px] text-secondary">air</span>
            <span className="font-label-sm text-label-sm">Low Agitation</span>
          </div>
        </div>

        {/* Description */}
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          {activeStage.desc}
        </p>

        {/* Key Growth Milestones */}
        <div className="space-y-2 pt-2">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
            Key Growth Milestones
          </span>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container">
            <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Growing New Wings & Legs
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                The caterpillar body transforms inside the shell into wings, eyes, and legs.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-container">
            <div className="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[16px]">check</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Wings Turn Orange and Clear
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                One day before coming out, the shell turns clear so you can see the orange wings.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* All 4 Stages Comparison Grid */}
      <div className="flex flex-col space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">All Growth Steps</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">How the butterfly changes from egg to adult</p>
          </div>
          <span className="font-label-sm text-label-sm text-secondary font-semibold">4 Steps</span>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          {STAGES.map((st, i) => (
            <div
              key={i}
              onClick={() => setCurrentStageIndex(i)}
              className={`cursor-pointer rounded-2xl p-space-sm flex flex-col space-y-2 transition-all shadow-sm active:scale-98 ${
                i === currentStageIndex
                  ? 'bg-surface-container-high ring-2 ring-secondary/50'
                  : 'bg-surface-container hover:bg-surface-container-high'
              }`}
            >
              <div className="relative w-full h-28 rounded-xl overflow-hidden bg-surface-container-highest">
                <img alt={st.name} className="w-full h-full object-cover" src={st.imageUrl} />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-surface-container-lowest/90 font-label-sm text-label-sm text-primary font-bold">
                  Step {i + 1}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-bold truncate">{st.name}</span>
                <span className="font-label-sm text-label-sm text-secondary">{st.duration.split(' ')[0]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Host Plant Symbiosis */}
      <div className="bg-surface-container rounded-3xl p-space-md flex flex-col space-y-space-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-[20px]">psychiatry</span>
          </div>
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight">Favorite Plant</h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Needs milkweed to grow</span>
          </div>
        </div>
        <div className="flex gap-3 bg-surface-container-low p-3 rounded-2xl">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container-highest">
            <img
              alt="Milkweed"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOCjOW6upld2jrzpD8GvGl1pwPpKw3pUMV4GDZWQbsL8f_6LskdKosVdm_EsXYPVOCBhoJFrmbNFriVqFnud5dVI6r4QCr4Ke6lOfieV8AUaWkXekyWuHJAbk09NTDiPMBqSnvvwndonyj1NOFhpI_3XP0bEHiO3mZNIGw_78_mamywJwUu3MmnMiy0SDdW_sfprzjxvAE73HEgc915_b0qNsPtEjqX7XZF8HaDUhWVC033ru-btfumg"
            />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-label-md text-label-md text-on-surface font-bold">Milkweed</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Caterpillars only eat milkweed. The plant makes them taste bad to birds so they stay safe.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-space-sm pt-2">
        <Link
          to="/compare"
          className="flex-1 h-12 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[20px]">compare</span>
          <span>Compare</span>
        </Link>
        <button
          onClick={() => showToast('Saved growth stage!')}
          className="flex-1 h-12 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          <span>Log Metamorphosis</span>
        </button>
      </div>
    </div>
  );
};
