import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InfoTooltip } from '../components/common/InfoTooltip';
import {
  HealthSpeciesPickerModal,
  HealthSubjectChoice,
  HEALTH_CATEGORIES,
} from '../components/health/HealthSpeciesPickerModal';

const STORAGE_KEY = 'wilddex_health_subject';

const DEFAULT_SUBJECT: HealthSubjectChoice = {
  category: 'Pet',
  commonName: 'Dog',
  scientificName: 'Canis familiaris',
  isCustom: false,
};

function readInitialSubject(searchParams: URLSearchParams): HealthSubjectChoice {
  const urlName = searchParams.get('name');
  if (urlName && urlName.trim()) {
    const taxonRaw = searchParams.get('taxonId');
    return {
      category: searchParams.get('cat') || 'Pet',
      commonName: urlName.trim(),
      scientificName: searchParams.get('sci') || undefined,
      photoUrl: searchParams.get('photo') || undefined,
      taxonId: taxonRaw ? Number(taxonRaw) : undefined,
      isCustom: searchParams.get('custom') === '1',
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as HealthSubjectChoice;
      if (parsed && parsed.commonName) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read saved health subject:', err);
  }

  return DEFAULT_SUBJECT;
}

export const HealthCheckerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    'Excessive Paw Licking',
    'Lethargy & Low Energy',
    'Loss of Appetite (24h+)',
  ]);
  const [searchSymptom, setSearchSymptom] = useState('');
  const [activeSubject, setActiveSubject] = useState<HealthSubjectChoice>(() =>
    readInitialSubject(searchParams)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<{ url: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableSymptoms = [
    { label: 'Vomiting', icon: '🤢' },
    { label: 'Coughing / Wheezing', icon: '💨' },
    { label: 'Dull Coat', icon: '✨' },
    { label: 'Joint Stiffness', icon: '🦴' },
    { label: 'Ear Scratching', icon: '👂' },
    { label: 'Excessive Thirst', icon: '💧' },
  ];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const syncSubjectToUrlAndStorage = (choice: HealthSubjectChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (err) {
      console.warn('Could not persist health subject to localStorage:', err);
    }

    const nextParams = new URLSearchParams();
    nextParams.set('cat', choice.category);
    nextParams.set('name', choice.commonName);
    if (choice.scientificName) nextParams.set('sci', choice.scientificName);
    if (choice.photoUrl) nextParams.set('photo', choice.photoUrl);
    if (choice.taxonId) nextParams.set('taxonId', String(choice.taxonId));
    if (choice.isCustom) nextParams.set('custom', '1');
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    // Ensure URL stays in sync if restored from localStorage or default
    if (!searchParams.get('name') && activeSubject.commonName) {
      syncSubjectToUrlAndStorage(activeSubject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedPhoto?.url) {
        URL.revokeObjectURL(uploadedPhoto.url);
      }
    };
  }, [uploadedPhoto]);

  const handleSelectSubject = (choice: HealthSubjectChoice) => {
    setActiveSubject(choice);
    syncSubjectToUrlAndStorage(choice);
    setPickerOpen(false);
    showToast(`Switched to: ${choice.commonName}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedPhoto?.url) {
      URL.revokeObjectURL(uploadedPhoto.url);
    }
    const objectUrl = URL.createObjectURL(file);
    setUploadedPhoto({ url: objectUrl, name: file.name });
    showToast('Photo attached');
  };

  const handleRemovePhoto = () => {
    if (uploadedPhoto?.url) {
      URL.revokeObjectURL(uploadedPhoto.url);
    }
    setUploadedPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const subjectIcon =
    HEALTH_CATEGORIES.find((c) => c.id === activeSubject.category)?.icon || 'pets';
  const subjectDisplayName = activeSubject.scientificName
    ? `${activeSubject.commonName} (${activeSubject.scientificName})`
    : activeSubject.commonName;

  const toggleSymptom = (name: string) => {
    if (selectedSymptoms.includes(name)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== name));
    } else {
      setSelectedSymptoms([...selectedSymptoms, name]);
      showToast(`Added sign: ${name}`);
    }
  };

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Informational Warning Banner */}
      <div className="px-3 sm:px-margin pt-space-sm pb-space-xs">
        <div className="bg-tertiary-container/15 text-tertiary rounded-xl p-3 sm:p-space-md shadow-sm flex items-start gap-space-sm">
          <span
            className="material-symbols-outlined text-[22px] shrink-0 text-tertiary mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md font-semibold text-tertiary uppercase tracking-wider">
              Health Help Notice
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
              For general guidance only. If an animal is badly hurt or sick, contact a licensed vet or wildlife rescuer right away.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnostic Flow Stepper */}
      <div className="px-3 sm:px-margin py-space-sm">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-sm">
          <div className="flex items-start justify-between relative mb-space-sm gap-1">
            <div className="absolute left-6 right-6 top-4 h-1 bg-surface-container-highest z-0"></div>
            <div className="absolute left-6 w-1/2 top-4 h-1 bg-secondary z-0"></div>
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[18px]">check</span>
              </div>
              <span className="font-label-sm text-[10px] sm:text-label-sm font-semibold text-secondary mt-1">Animal or Plant</span>
            </div>
            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center ring-4 ring-primary-fixed-dim/40 shadow-sm">
                <span className="material-symbols-outlined text-[18px]">stethoscope</span>
              </div>
              <span className="font-label-sm text-[10px] sm:text-label-sm font-semibold text-primary mt-1">What You Notice</span>
            </div>
            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center">
                <span className="font-label-md text-label-md">3</span>
              </div>
              <span className="font-label-sm text-[10px] sm:text-label-sm text-on-surface-variant mt-1">How Serious Is It?</span>
            </div>
          </div>

          {/* Current Subject Strip */}
          <div className="bg-surface-container rounded-lg p-space-sm flex flex-wrap sm:flex-nowrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm min-w-0">
              {activeSubject.photoUrl ? (
                <img
                  src={activeSubject.photoUrl}
                  alt={activeSubject.commonName}
                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-outline-variant/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-secondary-container/40 flex items-center justify-center shrink-0 text-secondary">
                  <span className="material-symbols-outlined text-[20px]">{subjectIcon}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Selected {activeSubject.category}
                </p>
                <p className="font-label-lg text-label-lg text-on-surface truncate">
                  {subjectDisplayName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              className="px-space-md py-1.5 min-h-[40px] rounded-full bg-surface-container-highest text-primary font-label-sm text-label-sm hover:bg-surface-container-high transition-colors active:scale-95 shrink-0"
              type="button"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      {/* Full Species Picker Modal */}
      <HealthSpeciesPickerModal
        isOpen={pickerOpen}
        currentChoice={activeSubject}
        onSelect={handleSelectSubject}
        onClose={() => setPickerOpen(false)}
      />

      {/* Symptom Input & Photo Diagnostics */}
      <div className="px-3 sm:px-margin py-space-xs">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-space-sm">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">What You Notice</h2>
              <InfoTooltip text="Pick any signs or behaviors you see so we can suggest possible reasons." />
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-semibold bg-secondary-container/40 px-2.5 py-0.5 rounded-full">
              {selectedSymptoms.length} Selected
            </span>
          </div>

          {/* Search Input */}
          <div className="relative mb-space-sm">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              className="w-full bg-surface-container pl-10 pr-4 py-2.5 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-inner"
              placeholder="Search what you notice, behaviors, signs..."
              type="text"
              value={searchSymptom}
              onChange={(e) => setSearchSymptom(e.target.value)}
            />
          </div>

          {/* Interactive Symptom Chips */}
          <div className="flex flex-wrap gap-1.5 mb-space-md">
            {selectedSymptoms.map((symp) => (
              <button
                key={symp}
                onClick={() => toggleSymptom(symp)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm active:scale-95"
                type="button"
              >
                <span>🐾</span>
                <span>{symp}</span>
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            ))}

            {availableSymptoms
              .filter(
                (s) =>
                  !selectedSymptoms.includes(s.label) &&
                  (!searchSymptom || s.label.toLowerCase().includes(searchSymptom.toLowerCase()))
              )
              .map((s) => (
                <button
                  key={s.label}
                  onClick={() => toggleSymptom(s.label)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high transition-colors active:scale-95"
                  type="button"
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
          </div>

          {/* Optional User Photo Upload */}
          <div className="space-y-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="health-photo-upload"
            />
            {!uploadedPhoto ? (
              <label
                htmlFor="health-photo-upload"
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold cursor-pointer transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">add_a_photo</span>
                <span>Add a photo (optional)</span>
              </label>
            ) : (
              <div className="bg-surface-container rounded-lg p-space-sm flex flex-wrap sm:flex-nowrap items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm min-w-0 flex-1">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 shadow-sm bg-surface-container-high">
                    <img
                      className="w-full h-full object-cover"
                      alt={`Uploaded check photo: ${uploadedPhoto.name}`}
                      src={uploadedPhoto.url}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md font-semibold text-on-surface">
                      Your Photo
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {uploadedPhoto.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-1.5 min-h-[40px] rounded-full bg-surface-container-highest text-on-surface-variant hover:text-error font-label-sm text-label-sm font-semibold shrink-0"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Diagnostic Assessment */}
      <div className="px-3 sm:px-margin py-space-sm">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-md relative overflow-hidden">
          <div className="flex items-start justify-between gap-space-sm mb-space-sm">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase tracking-wider mb-1.5">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Main Possibility
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface leading-tight">
                Seasonal Skin Allergy & Food Sensitivity
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <div className="inline-flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-on-primary shadow-sm relative group">
                <span className="font-headline-sm text-headline-sm leading-none font-bold">88%</span>
                <span className="font-label-sm text-[10px] text-on-primary-container leading-none mt-0.5">MATCH</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              Medium Concern • Not an Emergency
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Started: 2–3 days ago</span>
          </div>

          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Strong match based on paw redness, frequent licking, and lower energy after being outside. Likely caused by outdoor grass pollen or a food ingredient. Breathing looks normal.
          </p>

          <div className="mt-space-md pt-space-md border-t-0 bg-surface-container/60 rounded-lg p-space-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider mb-space-xs">
              Other Possibilities
            </p>
            <div className="flex items-center justify-between py-1.5 px-space-xs hover:bg-surface-container rounded transition-colors">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">drag_indicator</span>
                <div className="truncate">
                  <p className="font-label-md text-label-md text-on-surface truncate">Flea Itch Allergy</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Low risk • Itching mostly around tail</p>
                </div>
              </div>
              <span className="font-label-md text-label-md font-bold text-secondary shrink-0 ml-2">72%</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-space-xs hover:bg-surface-container rounded transition-colors mt-0.5">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[18px] text-tertiary">warning</span>
                <div className="truncate">
                  <p className="font-label-md text-label-md text-on-surface truncate">Skin Mites</p>
                  <p className="font-body-sm text-body-sm text-tertiary">Needs Attention • Vet check suggested</p>
                </div>
              </div>
              <span className="font-label-md text-label-md font-bold text-on-surface-variant shrink-0 ml-2">41%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment & Care Steps */}
      <div className="px-3 sm:px-margin py-space-xs">
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-sm">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Care Steps</h3>
          <div className="space-y-space-sm">
            <div className="bg-surface-container rounded-lg p-space-sm flex items-start gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">healing</span>
              </div>
              <div className="flex-1">
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">Quick Relief</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  1. Gentle oatmeal foot soak for 10 minutes.<br />
                  2. Apply gentle pet-safe soothing spray to red spots.<br />
                  3. Cool, clean damp cloth compress to reduce redness.
                </p>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-space-sm flex items-start gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">shield</span>
              </div>
              <div className="flex-1">
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">Things to Avoid</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  Avoid hot water baths (makes itchiness worse). Keep paws dry from tall wet grass. Watch for small blisters or yellow fluid.
                </p>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-space-sm flex items-start gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">eco</span>
              </div>
              <div className="flex-1">
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">Skin Protection</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  Wipe paws after walks outside. A pet fish-oil supplement can help protect dry skin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Foods & Nutritional Support */}
      <div className="px-3 sm:px-margin py-space-sm">
        <div className="flex items-center justify-between mb-space-sm gap-2">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Helpful Foods</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Foods that help soothe skin irritation</p>
          </div>
          <span className="material-symbols-outlined text-secondary shrink-0">restaurant</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex gap-space-sm md:overflow-x-auto pb-space-xs md:-mx-margin md:px-margin no-scrollbar">
          {/* Card 1 */}
          <div className="bg-surface-container-low rounded-xl w-full md:w-64 md:shrink-0 overflow-hidden shadow-sm flex flex-col">
            <div className="relative h-28 w-full">
              <img
                className="w-full h-full object-cover"
                alt="Wild Salmon & Marine Lipids"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmIKuit9RPlgYpCMQozKgXGckaPIYCO0_nr9IgCM7CsLLc3aXzOuE5GV7PyhzWTkz6OE-UKIRg8N6ct2nWw_1-GCDE6DM_C93HFijMjsEiecdr1sbROQuL0E8EOB4x_-n6hJjZFGnA3PCXfHRD0oPWbWLje3VrlBXiJUcyGVEPK_61h18jrx3sJrwLTphRM7fuA2Xfquu-_lGS2rYoXFCiHOT5J841xiUaiOsNDs2hqMDpJtt9xfzzng"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/80 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
                High EPA/DHA
              </span>
            </div>
            <div className="p-space-sm flex-1 flex flex-col justify-between">
              <div>
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">Wild Salmon & Marine Lipids</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                  Inhibits inflammatory arachidonic cascade and reinforces dermal lipid barrier.
                </p>
              </div>
              <div className="mt-space-sm flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary font-semibold">1,200mg / day</span>
                <button
                  onClick={() => showToast('Added Marine Lipids to Field Nutrition Plan')}
                  className="material-symbols-outlined text-[18px] text-secondary hover:scale-110"
                >
                  add_circle
                </button>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface-container-low rounded-xl w-full md:w-64 md:shrink-0 overflow-hidden shadow-sm flex flex-col">
            <div className="relative h-28 w-full">
              <img
                className="w-full h-full object-cover"
                alt="Steamed Pumpkin Puree"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSkIYSsEhqX4-7iabhMffEepvy_kpCq9FLazZYtBG8uGjUFPUX62Km4gQj9vB_JFyelGrTtvcBLAFpT0gvEEAjeE0pV30brtUxw7dUE2yOTt7Jq62dYyLe83pLLn73EBXrlRiM_G7kWfTZ4-RbShK1NMubY8duE13KSQYcTEGWCHF9DlztcqXacLRPkVOryNV7LMS46mNvlDaSUxjdzsAYzoquHqiR1DlyRssrfTWJ-iiJDWuP8GwOMQ"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/80 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
                Zinc & Prebiotics
              </span>
            </div>
            <div className="p-space-sm flex-1 flex flex-col justify-between">
              <div>
                <p className="font-label-lg text-label-lg text-on-surface font-semibold">Steamed Pumpkin Puree</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                  Soluble fiber optimizes intestinal microbiome, calming secondary histamine flare-ups.
                </p>
              </div>
              <div className="mt-space-sm flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary font-semibold">2 Tbsp / meal</span>
                <button
                  onClick={() => showToast('Added Pumpkin Puree to Field Nutrition Plan')}
                  className="material-symbols-outlined text-[18px] text-secondary hover:scale-110"
                >
                  add_circle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Action & Vet Assistance Locator */}
      <div className="px-3 sm:px-margin pt-space-xs pb-space-lg">
        <div className="bg-primary text-on-primary rounded-xl p-3 sm:p-space-md shadow-lg relative overflow-hidden">
          <div className="flex items-start gap-space-sm mb-space-sm">
            <div className="w-10 h-10 rounded-full bg-on-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px] text-primary-fixed">local_hospital</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-headline-sm text-headline-sm text-on-primary">Need Clinical Care?</h4>
              <p className="font-body-sm text-body-sm text-on-primary-container mt-0.5">
                Connect immediately with regional wildlife rehabilitators or emergency veterinary clinics.
              </p>
            </div>
          </div>

          <div className="bg-on-primary/10 rounded-lg p-space-sm mb-space-md flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-secondary-container shrink-0">near_me</span>
              <span className="font-label-md text-label-md text-on-primary">Pacific Northwest Regional Grid</span>
            </div>
            <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold shrink-0">
              3 Open Nearby (4.2 mi)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href="https://www.google.com/maps/search/emergency+veterinarian+clinic+near+me"
              target="_blank"
              rel="noreferrer noopener"
              className="w-full min-h-[48px] rounded-full bg-tertiary-container text-on-tertiary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md hover:bg-tertiary transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">location_on</span>
              <span>Find Nearby Certified Clinics</span>
            </a>
            <button
              onClick={() => showToast('Generated Diagnostic Dossier PDF for veterinarian review')}
              className="w-full min-h-[44px] rounded-full bg-on-primary/15 text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-on-primary/25 transition-colors active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
              <span>Export Diagnostic PDF to Vet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
