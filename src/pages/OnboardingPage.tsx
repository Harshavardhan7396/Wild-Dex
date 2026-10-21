import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, signInWithGoogle, updateUserProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [experience, setExperience] = useState<'novice' | 'enthusiast' | 'researcher'>(
    userProfile?.experienceLevel || 'enthusiast'
  );
  const [favoriteTaxa, setFavoriteTaxa] = useState(
    userProfile?.favoriteTaxa || 'Birds & Avian'
  );
  const [saving, setSaving] = useState(false);

  const steps = [
    {
      num: 1,
      tag: 'Feature 01 of 03 • Fast Camera Scanner',
      title: 'Fast AI Scanner with Great Accuracy',
      desc: 'Point your camera at any plant, animal, bug or mushroom. Fast AI tells you what it is right away.',
      chip: 'AI Scanner',
      sub: 'Fast photo match',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVwHQkFS0U8H3_S7YeJ3rB9lracVYKKvv2XuW5cgRds_6BaT8ewOz9wI0d5rX2OmMHxLNLbcusyZJnF0M9qUlqAW16SD8xMkJjmZn6FHfI9uwgy80d4abnPGfRZYSOZo2LcbMDNcx88Itd-RbsTPCDFOm6N-xGzcpWPGpyz7Iwlj6BFCazsRmHMCKa4vWw3HfoorFP2YKwWmYqQbO6rVn6n-_lpDQOoYEWxUYbNGei8xgttVlxI_JgdQ',
    },
    {
      num: 2,
      tag: 'Feature 02 of 03 • Animals & Plants Guide',
      title: 'See How It Grows and Where It Lives',
      desc: 'Watch life cycles step by step, see what each animal eats, and explore maps of where it lives.',
      chip: 'How It Grows',
      sub: 'Where It Lives',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALhhnkqC-TqGtZdXiPugPBb4pidzZYuFw3Qwk4f--jKsebaEitu9TfXLjcRPXK7VVgE_HBWfleWPOmpD3-XnjZqBT2EukANn8E15OyIO-u-V5JWg-Fd7xxRWh8WoON-bsNAIDa3OuQiXDzWxxLvV-bbFTK_G57NYiPDtc9EY0ifMhi_3FHRgSn5S6-9ZWk2_skbiDsim6awjk-1aeTPlBBiZSnCKxAH1hGlNPC8lb-xD_HyL5sbVQhTQ',
    },
    {
      num: 3,
      tag: 'Feature 03 of 03 • Nature Community',
      title: 'Share Discoveries with Friends',
      desc: 'Connect with nature lovers, see photos from friends, and create custom photo albums for your trips.',
      chip: 'Community',
      sub: 'Group discoveries',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDU0JDWRLzy8ntcDNfpJFWsQG2o69z_9_EMlLhjFXsxC0O5596bTlXKNKOC8pWAamTK44Vm1YN_uxdZAZYWp84dfKipiQob1Y5KPIvHi-roeWmY778XcuoBQMEek9iYLWzFzD6E0LAVbhvsJXaxWACE66-uhZSRhT7ntdigDavcq8BYhzUuGBX-0NoNeyKvBuBsy70TeQdNNLNTWKuID6u1Oc_apm-6nS9oJTRwQrp-xwWrOeBP47Cyaw',
    },
  ];

  const current = steps[Math.min(currentStep - 1, 2)];

  const handleComplete = async () => {
    setSaving(true);
    try {
      if (currentUser) {
        await updateUserProfile({
          experienceLevel: experience,
          favoriteTaxa,
          onboardingCompleted: true,
        });
      }
      navigate('/collection');
    } catch (e) {
      console.error('Error completing onboarding:', e);
      navigate('/collection');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Progress Stepper Segment */}
      <div className="px-margin pt-3 pb-2 w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="font-label-md text-label-md text-primary font-semibold tracking-wider uppercase">
            Field Onboarding
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant font-medium">
            Stage 0{currentStep} of 04
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 w-full">
          <div className={`h-1.5 rounded-full ${currentStep >= 1 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
          <div className={`h-1.5 rounded-full ${currentStep >= 2 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
          <div className={`h-1.5 rounded-full ${currentStep >= 3 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
          <div className={`h-1.5 rounded-full ${currentStep >= 4 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
        </div>
      </div>

      {currentStep <= 3 ? (
        <>
          {/* Main Slide Feature Visual Card */}
          <div className="px-margin pt-2 pb-4">
            <div className="relative w-full rounded-xl bg-surface-container-low shadow-md overflow-hidden">
              <div className="relative w-full h-56 overflow-hidden">
                <img className="w-full h-full object-cover" alt={current.title} src={current.img} />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/20 to-transparent"></div>
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md shadow-sm text-primary font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      menu_book
                    </span>
                    Bio-Encyclopedia
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container/90 backdrop-blur-md text-on-secondary-container font-label-sm text-label-sm font-bold">
                    <span className="material-symbols-outlined text-[13px]">view_in_ar</span>
                    3D Metamorphosis
                  </div>
                </div>
              </div>

              <div className="p-space-md -mt-8 relative z-10">
                <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">cycle</span>
                      <div>
                        <p className="font-headline-sm text-headline-sm text-on-surface leading-tight">Monarch Butterfly</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant italic">Danaus plexippus</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase">
                      Vulnerable (IUCN)
                    </span>
                  </div>

                  {/* Metamorphosis Stage Rail */}
                  <div className="bg-surface-container-low rounded-lg p-2.5 mb-3">
                    <div className="flex items-center justify-between text-center relative">
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-label-sm font-semibold">
                          1
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Egg</span>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant text-[16px] -mt-4">trending_flat</span>
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-label-sm font-semibold">
                          2
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Larva</span>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant text-[16px] -mt-4">trending_flat</span>
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-sm font-bold shadow-sm ring-2 ring-secondary-container">
                          3
                        </div>
                        <span className="font-label-sm text-label-sm text-primary font-bold mt-1">Pupa</span>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant text-[16px] -mt-4">trending_flat</span>
                      <div className="flex-1 flex flex-col items-center">
                        <div className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-label-sm font-semibold">
                          4
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">Adult</span>
                      </div>
                    </div>
                  </div>

                  {/* Food Web & Territory Preview Chips */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                      <span className="material-symbols-outlined text-primary text-[18px]">forest</span>
                      <div className="min-w-0">
                        <p className="font-label-sm text-label-sm text-on-surface-variant truncate">Host Flora</p>
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">Asclepias (Milkweed)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low">
                      <span className="material-symbols-outlined text-secondary text-[18px]">travel_explore</span>
                      <div className="min-w-0">
                        <p className="font-label-sm text-label-sm text-on-surface-variant truncate">Migration Path</p>
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">Nearctic → Michoacán</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Narrative Header & Description */}
          <div className="px-margin py-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md mb-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              {current.tag}
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight mb-2">
              {current.title}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {current.desc}
            </p>
          </div>

          {/* Slide Carousel Thumbnails Selector */}
          <div className="px-margin pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                Walkthrough Modules
              </span>
              <span className="font-label-sm text-label-sm text-primary font-medium">Stage {currentStep}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {steps.map((st) => (
                <button
                  key={st.num}
                  onClick={() => setCurrentStep(st.num)}
                  className={`flex flex-col text-left p-2.5 rounded-xl transition-all active:scale-95 ${
                    currentStep === st.num
                      ? 'bg-surface-container-highest shadow-sm ring-2 ring-primary text-on-surface'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                  type="button"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">0{st.num}</span>
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      {st.num === 1 ? 'camera' : st.num === 2 ? 'eco' : 'groups'}
                    </span>
                  </div>
                  <p className="font-label-md text-label-md font-semibold text-on-surface truncate">{st.chip}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{st.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Step 4: Explorer Identity & Profile Setup */
        <div className="px-margin py-4 flex flex-col gap-5">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm mb-3">
              <span className="material-symbols-outlined text-[32px]">badge</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-primary font-bold">
              Set Up Your Collection
            </h2>
            <p className="font-body-sm text-sm text-on-surface-variant mt-1">
              Pick what you like so we can show you the animals and plants you care about most.
            </p>
          </div>

          {/* Account Status */}
          <div className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <p className="font-label-md font-bold text-on-surface">
                  {currentUser ? currentUser.displayName || currentUser.email : 'Guest Explorer'}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {currentUser ? 'Signed in with Google' : 'Connect to save discoveries'}
                </p>
              </div>
            </div>

            {!currentUser && (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="px-4 py-2 rounded-full bg-primary text-on-primary font-label-md text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Naturalist Experience Level */}
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-sm font-bold text-on-surface">
              How Much Experience Do You Have?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'novice', label: 'Beginner', sub: 'Just starting out' },
                { id: 'enthusiast', label: 'Explorer', sub: 'Frequent walker' },
                { id: 'researcher', label: 'Expert', sub: 'Nature guide or expert' },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setExperience(tier.id as any)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    experience === tier.id
                      ? 'border-primary bg-primary-container/20 ring-1 ring-primary'
                      : 'border-outline-variant/40 bg-surface-container hover:bg-surface-container-high'
                  }`}
                >
                  <p className="font-label-md font-bold text-on-surface">{tier.label}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{tier.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Taxonomic Focus */}
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-sm font-bold text-on-surface">
              What Do You Like to Find Most?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Birds',
                'Insects & Bugs',
                'Plants & Trees',
                'Ocean & Water Life',
                'Frogs & Reptiles',
                'Mushrooms & Fungi',
              ].map((taxa) => (
                <button
                  key={taxa}
                  type="button"
                  onClick={() => setFavoriteTaxa(taxa)}
                  className={`p-3 rounded-2xl text-left border flex items-center justify-between transition-all ${
                    favoriteTaxa === taxa
                      ? 'border-secondary bg-secondary-container/30 ring-1 ring-secondary'
                      : 'border-outline-variant/40 bg-surface-container hover:bg-surface-container-high'
                  }`}
                >
                  <span className="font-label-md text-xs font-semibold text-on-surface">{taxa}</span>
                  {favoriteTaxa === taxa && (
                    <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Interactive CTA Panel */}
      <div className="px-margin pt-4 mt-auto">
        <div className="flex items-center gap-3">
          <button
            aria-label="Previous slide"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            className="w-12 h-12 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface active:scale-95 transition-all shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 h-12 rounded-full bg-primary-container hover:bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all px-6 disabled:opacity-50"
            type="button"
          >
            {saving ? (
              <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            ) : (
              <>
                <span>
                  {currentStep === 4 ? 'Start Exploring' : 'Next'}
                </span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
