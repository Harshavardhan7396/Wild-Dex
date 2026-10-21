import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CURATED_SPECIES, getSpeciesById } from '../services/speciesService';
import { Species } from '../types/species';
import { formatConservationStatus } from '../utils/formatters';

export const ComparisonPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramA = searchParams.get('a') || 'bengal-tiger';
  const paramB = searchParams.get('b') || 'siberian-tiger';

  const [specimenA, setSpecimenA] = useState<Species>(() => CURATED_SPECIES[0]);
  const [specimenB, setSpecimenB] = useState<Species>(() => CURATED_SPECIES[1] || CURATED_SPECIES[0]);
  const [swapped, setSwapped] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'biometrics' | 'biome' | 'dentition' | 'hunting'>('all');
  const [pickingFor, setPickingFor] = useState<'A' | 'B' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const loadSpecs = async () => {
      const foundA = await getSpeciesById(paramA);
      if (foundA) setSpecimenA(foundA);

      const foundB = await getSpeciesById(paramB);
      if (foundB) setSpecimenB(foundB);
    };
    loadSpecs();
  }, [paramA, paramB]);

  const leftSpecimen = swapped ? specimenB : specimenA;
  const rightSpecimen = swapped ? specimenA : specimenB;

  const handleSelectSpecies = (sp: Species) => {
    if (pickingFor === 'A') {
      if (swapped) setSpecimenB(sp);
      else setSpecimenA(sp);
      setSearchParams({ a: sp.id, b: rightSpecimen.id });
    } else {
      if (swapped) setSpecimenA(sp);
      else setSpecimenB(sp);
      setSearchParams({ a: leftSpecimen.id, b: sp.id });
    }
    setPickingFor(null);
    showToast(`Loaded ${sp.commonName} for comparison`);
  };

  return (
    <div className="flex flex-col w-full px-margin pb-28 pt-2 space-y-space-md select-none">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm shadow-sm">
          <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            balance
          </span>
          <span>Compare Animals</span>
        </div>
        <button
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md active:scale-95 transition-transform shadow-sm"
          type="button"
          onClick={() => {
            setSwapped(!swapped);
            showToast('Swapped order');
          }}
        >
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
          <span>Swap</span>
        </button>
      </div>

      {/* Specimen Dual Header Cards */}
      <div className="grid grid-cols-2 gap-space-sm items-stretch">
        {/* Left Specimen */}
        <div className="flex flex-col rounded-xl bg-surface-container-lowest overflow-hidden shadow-sm">
          <div className="relative w-full aspect-[4/3] bg-surface-container overflow-hidden group">
            <img className="w-full h-full object-cover" alt={leftSpecimen.commonName} src={leftSpecimen.photoUrl} />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-transparent to-black/20 pointer-events-none"></div>
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-semibold tracking-wider uppercase shadow">
              {formatConservationStatus(leftSpecimen.conservationStatus)}
            </span>
            <button
              onClick={() => setPickingFor('A')}
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-inverse-surface/70 backdrop-blur-md text-surface text-[10px] font-bold hover:bg-inverse-surface"
            >
              Change
            </button>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-inverse-on-surface opacity-90 truncate">
                {swapped ? 'Animal 2' : 'Animal 1'}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-secondary-container"></span>
            </div>
          </div>
          <div className="p-3 flex flex-col flex-1 justify-between bg-surface-container-low">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight leading-tight">
                {leftSpecimen.commonName}
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                <span className="text-[10px] font-medium text-on-surface-variant/70 mr-1">Science name:</span>
                <span className="italic">{leftSpecimen.scientificName}</span>
              </p>
            </div>
            <div className="mt-2.5 pt-2 flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">pin_drop</span>
                <span className="truncate">{leftSpecimen.nativeRegion}</span>
              </span>
              <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                {leftSpecimen.biomes[0] || leftSpecimen.habitat}
              </span>
            </div>
          </div>
        </div>

        {/* Right Specimen */}
        <div className="flex flex-col rounded-xl bg-surface-container-lowest overflow-hidden shadow-sm">
          <div className="relative w-full aspect-[4/3] bg-surface-container overflow-hidden group">
            <img className="w-full h-full object-cover" alt={rightSpecimen.commonName} src={rightSpecimen.photoUrl} />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-transparent to-black/20 pointer-events-none"></div>
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-semibold tracking-wider uppercase shadow">
              {formatConservationStatus(rightSpecimen.conservationStatus)}
            </span>
            <button
              onClick={() => setPickingFor('B')}
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-inverse-surface/70 backdrop-blur-md text-surface text-[10px] font-bold hover:bg-inverse-surface"
            >
              Change
            </button>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-inverse-on-surface opacity-90 truncate">
                {swapped ? 'Animal 1' : 'Animal 2'}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-primary-fixed"></span>
            </div>
          </div>
          <div className="p-3 flex flex-col flex-1 justify-between bg-surface-container-low">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight leading-tight">
                {rightSpecimen.commonName}
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant truncate">
                <span className="text-[10px] font-medium text-on-surface-variant/70 mr-1">Science name:</span>
                <span className="italic">{rightSpecimen.scientificName}</span>
              </p>
            </div>
            <div className="mt-2.5 pt-2 flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">ac_unit</span>
                <span className="truncate">{rightSpecimen.nativeRegion}</span>
              </span>
              <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                {rightSpecimen.biomes[0] || rightSpecimen.habitat}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Filter Scroll Strip */}
      <div className="relative -mx-margin px-margin">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'All Info' },
            { id: 'biometrics', label: 'Body Size' },
            { id: 'biome', label: 'Where It Lives' },
            { id: 'dentition', label: 'Teeth & Bite' },
            { id: 'hunting', label: 'What It Eats' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md shadow-sm active:scale-95 transition-all ${
                activeFilter === f.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparative Matrix Cards List */}
      <div className="flex flex-col space-y-3">
        {/* 1. Average Male Weight */}
        {(activeFilter === 'all' || activeFilter === 'biometrics') && (
          <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[15px]">scale</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Average Adult Weight</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                Biometrics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col justify-center">
                <span className="font-display-lg-mobile text-display-lg-mobile text-on-surface tracking-tight">
                  {leftSpecimen.metrics?.find((m) => m.label.includes('Mass'))?.value || '220'}{' '}
                  <span className="font-label-md text-label-md text-on-surface-variant font-normal">kg</span>
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  {leftSpecimen.commonName} standard
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary-container/40 flex flex-col justify-center relative overflow-hidden">
                <span className="font-display-lg-mobile text-display-lg-mobile text-secondary font-bold tracking-tight">
                  {rightSpecimen.metrics?.find((m) => m.label.includes('Mass'))?.value || '260'}{' '}
                  <span className="font-label-md text-label-md text-secondary font-normal">kg</span>
                </span>
                <span className="font-label-sm text-label-sm text-on-secondary-container mt-0.5">
                  {rightSpecimen.commonName} standard
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Total Body Length / Size */}
        {(activeFilter === 'all' || activeFilter === 'biometrics') && (
          <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[15px]">straighten</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Total Body Size</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Head to Tail Tip</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center justify-center">
                <span className="font-headline-md text-headline-md text-primary font-bold">
                  {leftSpecimen.id.includes('siberian') ? '3.0m – 3.3m' : '2.8m – 3.1m'}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  {leftSpecimen.habitat}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center justify-center">
                <span className="font-headline-md text-headline-md text-secondary font-bold">
                  {rightSpecimen.id.includes('siberian') ? '3.0m – 3.3m' : '2.8m – 3.1m'}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  {rightSpecimen.habitat}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Bite Force */}
        {(activeFilter === 'all' || activeFilter === 'dentition') && (
          <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[15px]">dentistry</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Bite Force & Canines</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                Dentition
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col justify-center">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  {leftSpecimen.metrics?.find((m) => m.label.includes('Bite'))?.value || '1,050'} PSI
                </span>
                <span className="font-label-sm text-label-sm text-primary font-semibold mt-0.5">7.5 cm canine crown</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Throat compression arch</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col justify-center">
                <span className="font-headline-md text-headline-md text-on-surface font-bold">
                  {rightSpecimen.metrics?.find((m) => m.label.includes('Bite'))?.value || '1,000'} PSI
                </span>
                <span className="font-label-sm text-label-sm text-secondary font-semibold mt-0.5">7.8 cm canine crown</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Heavy bone fracturing</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Top Burst Sprint */}
        {(activeFilter === 'all' || activeFilter === 'hunting') && (
          <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[15px]">speed</span>
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Top Burst Sprint</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Ambush Velocity</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center">
                <span className="font-headline-md text-headline-md text-primary font-bold">65 km/h</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Short burst in forest understory</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low flex flex-col items-center">
                <span className="font-headline-md text-headline-md text-secondary font-bold">60 km/h</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Traction stride through rough terrain</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ecological Takeaways & Naturalist Synthesis */}
      <div className="rounded-xl bg-surface-container-high p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            menu_book
          </span>
          <h3 className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
            What We Learn
          </h3>
        </div>
        <p className="font-body-md text-body-md text-on-surface leading-relaxed">
          Comparing these two animals shows key rules of nature:
        </p>
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <div className="p-3 rounded-lg bg-surface-container-lowest/80 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">school</span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-primary font-bold">Bergmann's Rule (Body Size)</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Animals that live in colder, snowy places grow larger bodies to hold on to their warmth.
              </span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-lowest/80 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-tertiary shrink-0 mt-0.5">straighten</span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-tertiary font-bold">Allen's Rule (Body Shape)</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Cold-climate animals often have shorter ears, tails, and paws to protect against freezing winds.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Species Modal Picker */}
      {pickingFor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface p-5 shadow-2xl flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Pick Specimen {pickingFor}
              </h3>
              <button
                onClick={() => setPickingFor(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {CURATED_SPECIES.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => handleSelectSpecies(sp)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors text-left"
                >
                  <img alt={sp.commonName} src={sp.photoUrl} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md font-bold text-on-surface truncate">{sp.commonName}</p>
                    <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">{sp.scientificName}</p>
                    <span className="text-[10px] text-secondary font-semibold">{sp.nativeRegion}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Sticky Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl px-margin py-3 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.06)] border-t border-outline-variant/30">
        <div className="max-w-md mx-auto flex items-center gap-space-sm">
          <button
            className="flex-1 h-12 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            onClick={() => showToast('Generating comparative field report PDF...')}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
            <span>Export Report (PDF)</span>
          </button>
          <button
            aria-label="Share comparison"
            className="h-12 w-12 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center active:scale-90 transition-transform shadow-sm"
            onClick={() => showToast('Comparison matrix pinned to Field Journal')}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">bookmark_add</span>
          </button>
        </div>
      </div>
    </div>
  );
};
