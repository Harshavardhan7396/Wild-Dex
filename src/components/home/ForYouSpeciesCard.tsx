import React from 'react';
import { Link } from 'react-router-dom';
import { ForYouSpeciesItem } from '../../services/forYouService';
import { formatConservationStatus } from '../../utils/formatters';

interface ForYouSpeciesCardProps {
  item: ForYouSpeciesItem;
  isAdded: boolean;
  isAdding: boolean;
  onAddToCollection: (item: ForYouSpeciesItem) => void;
  onNotInterested: (item: ForYouSpeciesItem) => void;
  layout?: 'grid' | 'row';
}

export const ForYouSpeciesCard: React.FC<ForYouSpeciesCardProps> = ({
  item,
  isAdded,
  isAdding,
  onAddToCollection,
  onNotInterested,
  layout = 'grid',
}) => {
  const detailPath = `/species/${encodeURIComponent(item.scientificName || item.commonName)}`;
  const conservationText =
    item.isEndangered ? formatConservationStatus(item.conservationCode) : null;

  return (
    <article
      className={`${
        layout === 'row' ? 'w-full md:w-72 md:shrink-0' : 'w-full'
      } rounded-2xl bg-surface-container-low border border-outline-variant/25 overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow min-w-0`}
    >
      {/* Photo */}
      <Link to={detailPath} className="relative block w-full h-40 bg-surface-container overflow-hidden group">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.commonName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary bg-secondary-container/30">
            <span className="material-symbols-outlined text-[40px]">eco</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/75 via-transparent to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-2 inset-x-2 flex flex-wrap items-center justify-between gap-1">
          {item.isEndangered ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-[11px] font-bold shadow-sm">
              <span className="material-symbols-outlined text-[13px]">shield</span>
              <span>{conservationText || 'Protected'}</span>
            </span>
          ) : item.relationLabel ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface/90 text-primary font-label-sm text-[11px] font-bold shadow-sm backdrop-blur-sm max-w-full truncate">
              <span className="material-symbols-outlined text-[13px] shrink-0">account_tree</span>
              <span className="truncate">{item.relationLabel}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface/90 text-primary font-label-sm text-[11px] font-semibold shadow-sm backdrop-blur-sm">
              <span className="material-symbols-outlined text-[13px]">public</span>
              <span>Popular worldwide</span>
            </span>
          )}
        </div>

        {/* Bottom badge for endangered spot privacy or observation count */}
        <div className="absolute bottom-2 inset-x-2.5 flex items-center justify-between gap-2 text-surface-container-lowest">
          {item.isEndangered ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-inverse-surface/75 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <span className="material-symbols-outlined text-[13px] text-tertiary-fixed">visibility_off</span>
              <span>Exact spot hidden</span>
            </span>
          ) : item.observationCount > 0 ? (
            <span className="text-[11px] font-semibold opacity-95 drop-shadow-sm">
              {item.observationCount.toLocaleString()} sightings
            </span>
          ) : (
            <span />
          )}
        </div>
      </Link>

      {/* Details & Actions */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <Link to={detailPath} className="block group">
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate group-hover:text-primary transition-colors">
              {item.commonName}
            </h4>
          </Link>
          <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
            {item.scientificName}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            disabled={isAdding || isAdded}
            onClick={() => onAddToCollection(item)}
            className={`w-full min-h-[44px] px-3 rounded-full font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
              isAdded
                ? 'bg-secondary-container text-on-secondary-container cursor-default'
                : 'bg-primary text-on-primary hover:bg-primary-container disabled:opacity-60'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                isAdding ? 'animate-spin' : ''
              }`}
            >
              {isAdding ? 'progress_activity' : isAdded ? 'check_circle' : 'library_add'}
            </span>
            <span>
              {isAdding ? 'Saving...' : isAdded ? 'Added to Collection' : 'Add to Collection'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNotInterested(item)}
            className="w-full min-h-[40px] px-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">thumb_down</span>
            <span>Not interested</span>
          </button>
        </div>
      </div>
    </article>
  );
};
