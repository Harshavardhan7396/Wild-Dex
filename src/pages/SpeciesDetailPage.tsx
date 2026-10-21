import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSpeciesById, CURATED_SPECIES } from '../services/speciesService';
import { Species } from '../types/species';
import { SpeciesRangeMap } from '../components/species/SpeciesRangeMap';
import { InfoTooltip } from '../components/common/InfoTooltip';
import { formatConservationStatus, getConservationMeaning } from '../utils/formatters';

export const SpeciesDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [species, setSpecies] = useState<Species | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'habitat' | 'diet' | 'lifecycle' | 'logs'>('overview');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      const data = await getSpeciesById(id || 'bengal-tiger');
      if (isMounted) {
        setSpecies(data || CURATED_SPECIES[0]);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !species) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined text-[36px] text-primary animate-spin">progress_activity</span>
        <p className="font-label-md text-label-md text-on-surface-variant">Loading taxonomy dossier...</p>
      </div>
    );
  }

  const galleryList = [species.photoUrl, ...(species.galleryUrls || [])];

  const handleRoarAudio = () => {
    setAudioPlaying(true);
    showToast(`Playing bio-acoustic recording for ${species.commonName}`);
    setTimeout(() => setAudioPlaying(false), 2200);
  };

  return (
    <div className="flex flex-col w-full relative pb-10">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Main Grid: Single-column on mobile, balanced split layout on desktop (lg:grid lg:grid-cols-12 lg:gap-8) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        
        {/* LEFT COLUMN (Desktop: 5 cols / Mobile: full width) */}
        <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-24">
          {/* 1. Hero Visual Carousel with Tactile Floating Overlays */}
          <div className="relative w-full overflow-hidden bg-surface-container-high rounded-none lg:rounded-3xl aspect-[4/3] max-h-[380px] lg:max-h-[440px] shadow-sm">
            <img
              alt={species.commonName}
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
              src={galleryList[selectedPhotoIdx] || species.photoUrl}
              onClick={() => setGalleryOpen(true)}
            />
            {/* Scrims */}
            <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-black/40 pointer-events-none"></div>

            {/* Floating Top Navigation Actions */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
              <button
                aria-label="Back to Explore"
                className="w-11 h-11 rounded-full bg-surface/80 backdrop-blur-md text-on-surface flex items-center justify-center shadow-md active:scale-95 transition-transform"
                onClick={() => navigate(-1)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="flex items-center gap-space-xs">
                {/* Audio Roar Pronunciation */}
                <button
                  aria-label="Play sound pronunciation"
                  className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center shadow-md active:scale-90 transition-all ${
                    audioPlaying ? 'bg-primary-fixed text-primary scale-110' : 'bg-surface/80 text-primary hover:bg-surface'
                  }`}
                  onClick={handleRoarAudio}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    volume_up
                  </span>
                </button>
                {/* Bookmark */}
                <button
                  aria-label="Save to field journal"
                  className={`w-11 h-11 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center shadow-md active:scale-90 transition-all ${
                    isBookmarked ? 'text-tertiary' : 'text-on-surface-variant hover:text-tertiary'
                  }`}
                  onClick={() => {
                    setIsBookmarked(!isBookmarked);
                    showToast(isBookmarked ? 'Removed from journal' : 'Saved to Field Journal');
                  }}
                  type="button"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    bookmark
                  </span>
                </button>
                {/* Share */}
                <button
                  aria-label="Share specimen dossier"
                  className="w-11 h-11 rounded-full bg-surface/80 backdrop-blur-md text-on-surface-variant flex items-center justify-center shadow-md active:scale-90 transition-all"
                  onClick={() => showToast('Specimen dossier link copied to clipboard')}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">share</span>
                </button>
              </div>
            </div>

            {/* Carousel Metadata: Pagination Pill & Photo Credit */}
            <div className="absolute bottom-3 inset-x-4 flex items-end justify-between z-10">
              <div className="flex flex-col gap-1 max-w-[70%]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-on-surface font-label-sm text-label-sm shadow-sm truncate">
                  <span className="material-symbols-outlined text-[14px] text-primary shrink-0">photo_camera</span>
                  <span className="truncate">Photo: {species.photoCredit || 'iNaturalist Wildlife Repository'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-inverse-surface/75 text-inverse-on-surface backdrop-blur-md font-label-sm text-label-sm shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></span>
                  <span className="ml-1 font-semibold">
                    {selectedPhotoIdx + 1} / {galleryList.length}
                  </span>
                </div>
                <button
                  aria-label="Expand Gallery Fullscreen"
                  className="w-8 h-8 rounded-full bg-inverse-surface/75 text-inverse-on-surface flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform"
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                >
                  <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                </button>
              </div>
            </div>
          </div>

          {/* Thumbnail Strip (especially useful on Desktop) */}
          {galleryList.length > 1 && (
            <div className="px-margin lg:px-0 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {galleryList.map((photo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedPhotoIdx(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                    selectedPhotoIdx === i ? 'border-primary ring-2 ring-primary-fixed' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Family Tree Card (Visible in Left Column on Desktop) */}
          <div className="hidden lg:flex flex-col p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md font-bold text-on-surface">Family Tree</span>
              <span className="material-symbols-outlined text-[18px] text-primary">account_tree</span>
            </div>
            <div className="space-y-1.5 font-label-sm text-label-sm text-on-surface-variant">
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-outline">Kingdom</span>
                <span className="font-semibold text-on-surface">{species.taxonomy.kingdom || 'Animalia'}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-outline">Class</span>
                <span className="font-semibold text-on-surface">{species.taxonomy.class || 'Mammalia'}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-outline">Order</span>
                <span className="font-semibold text-on-surface">{species.taxonomy.order || 'Carnivora'}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/20 pb-1">
                <span className="text-outline">Genus</span>
                <span className="font-semibold text-on-surface italic">{species.taxonomy.genus || species.scientificName.split(' ')[0]}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-outline">Science name</span>
                <span className="font-bold text-primary italic">{species.scientificName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Desktop: 7 cols / Mobile: full width content) */}
        <div className="lg:col-span-7 flex flex-col gap-space-lg px-margin lg:px-0 pt-2 lg:pt-0">
          {/* 2. Family & Identification Section */}
          <div className="flex flex-col gap-space-sm pt-2">
            {/* Breadcrumbs for Mobile */}
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap">
                {species.taxonomy.kingdom || 'Animalia'}
              </span>
              <span className="material-symbols-outlined text-[12px] text-outline">chevron_right</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap">
                {species.taxonomy.class || 'Mammalia'}
              </span>
              <span className="material-symbols-outlined text-[12px] text-outline">chevron_right</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap">
                {species.taxonomy.order || 'Carnivora'}
              </span>
              <span className="material-symbols-outlined text-[12px] text-outline">chevron_right</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container font-label-sm text-label-sm whitespace-nowrap font-medium">
                {species.taxonomy.genus || species.scientificName.split(' ')[0]}
              </span>
            </div>

            {/* Name & Scientific Label */}
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-space-sm">
                <h1 className="font-display-lg-mobile text-display-lg-mobile lg:text-3xl text-primary font-bold tracking-tight">
                  {species.commonName}
                </h1>
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-on-primary shrink-0 shadow-sm"
                  title="WildDex Verified Specimen"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </span>
              </div>
              <div className="flex items-center gap-space-xs mt-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-outline">Science name:</span>
                <span className="italic font-body-lg text-body-lg text-on-surface-variant">
                  {species.scientificName}
                </span>
                <button
                  aria-label="Listen to science name"
                  className="text-secondary hover:text-primary active:scale-95 transition-transform"
                  onClick={handleRoarAudio}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">volume_up</span>
                </button>
              </div>
            </div>

            {/* Safety of the Species Badges */}
            <div className="flex flex-wrap items-center gap-space-xs pt-1">
              <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary shadow-sm">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-ping"></span>
                <span className="font-label-md text-label-md font-bold">{formatConservationStatus(species.conservationStatus || species.statusLabel)}</span>
                <InfoTooltip text={getConservationMeaning(species.conservationStatus)} />
                {species.population && <span className="font-label-sm text-label-sm opacity-90">• {species.population} Wild</span>}
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-tertiary">warning</span>
                <span className="font-label-sm text-label-sm font-semibold">Stay Back Safely</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                <span className="material-symbols-outlined text-[14px]">public</span>
                <span className="font-label-sm text-label-sm font-medium">{species.nativeRegion}</span>
              </div>
            </div>
          </div>

          {/* 3. Interactive Tab Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b-0 pb-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm transition-colors ${
                activeTab === 'overview'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('habitat')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'habitat'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Where It Lives
            </button>
            <button
              onClick={() => setActiveTab('diet')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'diet'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              What It Eats
            </button>
            <button
              onClick={() => setActiveTab('lifecycle')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'lifecycle'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              How It Grows
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeTab === 'logs'
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Community Notes
            </button>
          </div>

          {/* 4. Tab: Overview */}
          {(activeTab === 'overview' || activeTab === 'logs') && (
            <div className="flex flex-col gap-space-md">
              {/* 4-Card Quick Metrics Bento Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                {species.metrics ? (
                  species.metrics.map((m, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span className="font-label-sm text-label-sm uppercase tracking-wide text-outline">{m.label}</span>
                        <span className="material-symbols-outlined text-[18px] text-secondary">{m.icon || 'straighten'}</span>
                      </div>
                      <div className="mt-2">
                        <span className="font-headline-md text-headline-md font-bold text-primary">{m.value}</span>
                        {m.unit && <span className="font-label-sm text-label-sm text-on-surface-variant ml-0.5">{m.unit}</span>}
                      </div>
                      {m.subtext && <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{m.subtext}</span>}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3.5 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between">
                      <span className="font-label-sm text-label-sm uppercase text-outline">Group</span>
                      <span className="font-headline-md text-headline-md font-bold text-primary capitalize">{species.category}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-container-low shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm uppercase text-outline">How Rare</span>
                        <InfoTooltip text="How often this species is found in nature." />
                      </div>
                      <span className="font-headline-md text-headline-md font-bold text-secondary">{species.rarity}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Naturalist Overview Card */}
              <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-xs">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Natural History Summary
                  </h2>
                  <span className="material-symbols-outlined text-[18px] text-secondary">menu_book</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {species.description}
                </p>
                <div className="mt-2 pt-2 flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                    Unique coat pattern ID active
                  </span>
                  <button
                    onClick={() => showToast('Opening Field Biologist field journal notes...')}
                    className="font-label-sm text-label-sm text-secondary font-semibold hover:underline"
                  >
                    Read Field Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. Tab: Where It Lives with Real Interactive Leaflet Range Map */}
          {(activeTab === 'habitat' || activeTab === 'overview') && (
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Where It Lives
                  </h2>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {species.locationName || 'Fragmented river basins & tropical reserves'}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium">
                  Sea Level – 3,000m
                </span>
              </div>

              {/* Real Leaflet Map Component */}
              <SpeciesRangeMap
                coordinates={species.coordinates}
                locationName={species.locationName}
                speciesName={species.commonName}
                nativeRegion={species.nativeRegion}
                biomes={species.biomes}
              />

              {/* Biome Type Badges */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {species.biomes.map((biome, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                    {biome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 6. Tab: What It Eats */}
          {(activeTab === 'diet' || activeTab === 'overview') && species.preyGuild && (
            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">What It Eats</h2>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-sm text-label-sm font-bold">
                      {species.preyGuild.category}
                    </span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {species.preyGuild.description}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[20px] text-tertiary">restaurant</span>
              </div>

              {/* Prey Cards: Responsive Grid on Desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                {species.preyGuild.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2">
                    <div className="relative w-full h-24 rounded-lg overflow-hidden bg-surface-container">
                      <img alt={item.name} className="w-full h-full object-cover" src={item.photoUrl} />
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-primary-container text-on-primary font-label-sm text-label-sm font-bold">
                        {item.percentage}%
                      </span>
                    </div>
                    <div>
                      <h3 className="font-label-md text-label-md font-semibold text-on-surface truncate">{item.name}</h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hunting Strategy Note */}
              {species.preyGuild.strategyNote && (
                <div className="p-3 rounded-lg bg-surface-container-low flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px] text-secondary shrink-0">nights_stay</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {species.preyGuild.strategyNote}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 7. Tab: How It Grows */}
          {(activeTab === 'lifecycle' || activeTab === 'overview') && (
            <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">How It Grows</h2>
                <Link
                  to="/lifecycle"
                  className="font-label-sm text-label-sm text-primary font-semibold flex items-center gap-0.5 hover:underline"
                >
                  <span>Interactive Guide</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
              {/* Mini Timeline Steps */}
              <div className="relative flex items-center justify-between pt-2">
                <div className="absolute left-3 right-3 top-5 h-0.5 bg-outline-variant -z-0"></div>
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-label-sm font-bold shadow-sm">
                    1
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Baby</span>
                  <span className="font-body-sm text-body-sm text-outline">0–6 mo</span>
                </div>
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-label-sm font-bold shadow-sm">
                    2
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Growing</span>
                  <span className="font-body-sm text-body-sm text-outline">1–2 yr</span>
                </div>
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-label-sm text-label-sm font-bold shadow-sm">
                    3
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Young Adult</span>
                  <span className="font-body-sm text-body-sm text-outline">2–3 yr</span>
                </div>
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-6 h-6 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-label-sm text-label-sm font-bold shadow-sm">
                    4
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Full Grown</span>
                  <span className="font-body-sm text-body-sm text-outline">4+ yr</span>
                </div>
              </div>
            </div>
          )}

          {/* 8. Related Animals & Plants & Compare Button */}
          <div className="flex flex-col gap-space-sm mb-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Related Animals & Plants</h2>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Similar animals and plants</span>
              </div>
              <Link
                to={`/compare?a=${species.id}&b=siberian-tiger`}
                className="px-3 py-1.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1 hover:bg-surface-variant transition-colors"
              >
                <span>Compare</span>
                <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <Link
                to="/species/siberian-tiger"
                className="p-3 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between gap-space-sm hover:bg-surface-container transition-colors"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <img
                    alt="Siberian Tiger"
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmKSWwM44CDPkvKFWy8z5EyKpcdle4yew5KstBhbzIQnI-T6MUuBntUjSkPOPg2KYN_IcUHGWISQdw0fVVcpePZ88ENi4rSFF7gb4kq4QyWbn0Xtkh-gYU__R8aTVxhUtU8XzpmX_-O1zbP0k2JnO_50vg-58_F9xy_u5aYGJDif5dKx9aDpYho5oHvgThT6jqxOqOy20Wn7HEqM62KlOW8mHiYhGRVEYRm5JRbCVKVPJU_LxMleXVLw"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-md text-label-md font-semibold text-on-surface truncate">Siberian Tiger</span>
                    <span className="font-body-sm text-body-sm italic text-on-surface-variant truncate">P. t. altaica</span>
                    <span className="font-label-sm text-label-sm text-secondary font-medium">Heavier coat • Far East</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Gallery Modal */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in">
          <div className="flex items-center justify-between text-white max-w-5xl mx-auto w-full">
            <span className="font-label-md text-label-md font-bold">
              {species.commonName} Gallery ({selectedPhotoIdx + 1}/{galleryList.length})
            </span>
            <button
              onClick={() => setGalleryOpen(false)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2">
            <img
              alt={species.commonName}
              src={galleryList[selectedPhotoIdx]}
              className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>

          {/* Thumbnails */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 max-w-5xl mx-auto w-full">
            {galleryList.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPhotoIdx(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden transition-all shrink-0 ${
                  selectedPhotoIdx === idx ? 'ring-3 ring-primary-fixed scale-105' : 'opacity-60'
                }`}
              >
                <img alt="" src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 9. Sticky Bottom Action Dock */}
      <div className="sticky bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-margin py-3 mt-4 border-t border-outline-variant/30">
        <div className="flex items-center gap-space-sm max-w-lg md:max-w-2xl mx-auto">
          <button
            className={`flex-1 h-12 rounded-full font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all ${
              isCollected
                ? 'bg-secondary text-on-secondary'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
            onClick={() => {
              setIsCollected(!isCollected);
              showToast(isCollected ? 'Removed from collection' : 'Saved to My Collection!');
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCollected ? 'check_circle' : 'library_add'}
            </span>
            <span>{isCollected ? 'Saved to Collection!' : 'Save'}</span>
          </button>
          <button
            aria-label="Add observation note"
            className="h-12 px-4 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            onClick={() => showToast('Recorded note in collection')}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
            <span className="inline">Add Note</span>
          </button>
        </div>
      </div>
    </div>
  );
};
