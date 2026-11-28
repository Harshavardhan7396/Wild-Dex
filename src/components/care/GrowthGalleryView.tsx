import React, { useState, useEffect } from 'react';
import { CareEntry, formatEntryDate } from '../../services/careService';

interface GrowthGalleryViewProps {
  entries: CareEntry[];
  onEnlargePhoto: (entry: CareEntry) => void;
}

export const GrowthGalleryView: React.FC<GrowthGalleryViewProps> = ({
  entries,
  onEnlargePhoto,
}) => {
  const photoEntries = entries.filter((e) => Boolean(e.photoUrl));
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(
    Math.max(0, photoEntries.length - 1)
  );
  const [sliderPercent, setSliderPercent] = useState(50);

  useEffect(() => {
    setBeforeIndex(0);
    setAfterIndex(Math.max(0, photoEntries.length - 1));
  }, [photoEntries.length]);

  if (photoEntries.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-1.5">
        <span
          className="material-symbols-outlined text-[28px] text-primary"
          aria-hidden="true"
        >
          photo_camera
        </span>
        <p className="font-body-md text-sm text-on-surface font-medium">
          No growth photos yet
        </p>
        <p className="text-xs text-on-surface-variant">
          Add a Growth photo entry with a picture to compare progress over time.
        </p>
      </div>
    );
  }

  const safeBefore = photoEntries[Math.min(beforeIndex, photoEntries.length - 1)];
  const safeAfter = photoEntries[Math.min(afterIndex, photoEntries.length - 1)];

  return (
    <section
      aria-label="Growth gallery"
      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/25 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary-container/50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              compare
            </span>
          </div>
          <div>
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface">
              Growth gallery
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              {photoEntries.length}{' '}
              {photoEntries.length === 1 ? 'photo' : 'photos'} in date order
            </p>
          </div>
        </div>
      </div>

      {/* Before / After Comparison Slider */}
      {photoEntries.length >= 2 && safeBefore && safeAfter ? (
        <div className="space-y-2.5">
          <div className="relative w-full aspect-[4/3] max-h-80 rounded-2xl overflow-hidden bg-surface-container select-none border border-outline-variant/25">
            {/* After image (base layer) */}
            <img
              src={safeAfter.photoUrl}
              alt={`After: ${safeAfter.title}`}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Before image (clipped left side by sliderPercent) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` }}
            >
              <img
                src={safeBefore.photoUrl}
                alt={`Before: ${safeBefore.title}`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Divider Line & Handle */}
            <div
              className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.45)] pointer-events-none"
              style={{ left: `${sliderPercent}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-white text-primary shadow-md flex items-center justify-center absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  drag_indicator
                </span>
              </div>
            </div>

            {/* Corner Date Badges */}
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] font-medium backdrop-blur-sm">
              Before · {formatEntryDate(safeBefore.entryDate)}
            </div>
            <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/65 text-white text-[11px] font-medium backdrop-blur-sm">
              After · {formatEntryDate(safeAfter.entryDate)}
            </div>

            {/* Invisible interactive range overlay for touch & mouse */}
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPercent}
              onChange={(e) => setSliderPercent(Number(e.target.value))}
              aria-label="Before and after comparison slider"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            />
          </div>

          {/* Photo pair selectors when 3+ photos exist */}
          {photoEntries.length > 2 && (
            <div className="grid grid-cols-2 gap-2 no-print">
              <label className="text-xs text-on-surface-variant flex flex-col gap-1">
                <span>Before</span>
                <select
                  value={beforeIndex}
                  onChange={(e) => setBeforeIndex(Number(e.target.value))}
                  className="px-2.5 py-2 min-h-[40px] rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs"
                >
                  {photoEntries.map((item, idx) => (
                    <option key={item.id} value={idx}>
                      {formatEntryDate(item.entryDate)} — {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-on-surface-variant flex flex-col gap-1">
                <span>After</span>
                <select
                  value={afterIndex}
                  onChange={(e) => setAfterIndex(Number(e.target.value))}
                  className="px-2.5 py-2 min-h-[40px] rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs"
                >
                  {photoEntries.map((item, idx) => (
                    <option key={item.id} value={idx}>
                      {formatEntryDate(item.entryDate)} — {item.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          Add one more growth photo to unlock the before/after comparison slider.
        </p>
      )}

      {/* Chronological Growth Photos Grid (oldest -> newest) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {photoEntries.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onEnlargePhoto(item)}
            className="group text-left rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-all"
          >
            <div className="aspect-square w-full overflow-hidden bg-surface-container">
              <img
                src={item.photoUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold text-on-surface truncate">
                {formatEntryDate(item.entryDate)}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                {item.value !== null && item.unit
                  ? `${item.value} ${item.unit}`
                  : item.title}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
