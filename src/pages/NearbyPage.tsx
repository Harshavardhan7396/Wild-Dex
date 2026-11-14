import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useAuth } from '../contexts/AuthContext';
import {
  NearbyCategory,
  NearbyPlace,
  NominatimCityResult,
  fetchNearbyWildlifePlaces,
  searchCityNominatim,
  haversineKm,
  formatDistanceKm,
} from '../services/nearbyService';

// Fix default Leaflet marker icons for Vite asset bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

interface CategoryMeta {
  id: NearbyCategory;
  label: string;
  color: string;
  bgClass: string;
  icon: string;
}

const CATEGORY_CONFIG: Record<NearbyCategory, CategoryMeta> = {
  reserve: {
    id: 'reserve',
    label: 'Sanctuaries and reserves',
    color: '#15803d',
    bgClass: 'bg-[#15803d]',
    icon: 'park',
  },
  zoo: {
    id: 'zoo',
    label: 'Zoos and aquariums',
    color: '#d97706',
    bgClass: 'bg-[#d97706]',
    icon: 'pets',
  },
  shelter: {
    id: 'shelter',
    label: 'Animal shelters',
    color: '#7c3aed',
    bgClass: 'bg-[#7c3aed]',
    icon: 'home',
  },
  vet: {
    id: 'vet',
    label: 'Vets',
    color: '#dc2626',
    bgClass: 'bg-[#dc2626]',
    icon: 'medical_services',
  },
};

const ALL_CATEGORIES: CategoryMeta[] = [
  CATEGORY_CONFIG.reserve,
  CATEGORY_CONFIG.zoo,
  CATEGORY_CONFIG.shelter,
  CATEGORY_CONFIG.vet,
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  if (radiusKm <= 25) return 11;
  return 10;
}

function buildDirectionsUrl(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number }
): string {
  if (from) {
    return `https://www.openstreetmap.org/directions?from=${from.lat.toFixed(
      5
    )},${from.lng.toFixed(5)}&to=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  }
  return `https://www.openstreetmap.org/directions?to=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

export const NearbyPage: React.FC = () => {
  const { userProfile } = useAuth();

  const savedHomeCenter = useMemo(() => {
    if (
      userProfile?.locationConsent &&
      userProfile?.homeLat !== null &&
      userProfile?.homeLat !== undefined &&
      userProfile?.homeLng !== null &&
      userProfile?.homeLng !== undefined
    ) {
      return { lat: userProfile.homeLat, lng: userProfile.homeLng };
    }
    return null;
  }, [userProfile?.locationConsent, userProfile?.homeLat, userProfile?.homeLng]);

  // Location states
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMode, setLocationMode] = useState<'detecting' | 'live' | 'home' | 'city' | 'prompt'>(
    'detecting'
  );
  const [geoStatusText, setGeoStatusText] = useState<string>('Checking your location...');
  const [showCitySearch, setShowCitySearch] = useState(false);

  // Nominatim city search state
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<NominatimCityResult[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [cityLabel, setCityLabel] = useState<string>('');
  const lastNominatimAtRef = useRef<number>(0);

  // Overpass search state
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [selectedCategories, setSelectedCategories] = useState<Set<NearbyCategory>>(
    () => new Set(['reserve', 'zoo', 'shelter', 'vet'])
  );
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const forceRefreshRef = useRef(false);

  // Track last Overpass fetch coordinates + radius so we only re-query on >= 1 km move or radius change
  const lastQueriedRef = useRef<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const locationModeRef = useRef(locationMode);
  locationModeRef.current = locationMode;

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const blueDotMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const placeMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByPlaceIdRef = useRef<Map<string, L.Marker>>(new Map());
  const hasCenteredMapOnceRef = useRef(false);

  // 1. Ask for geolocation ONLY when Nearby page opens, start watchPosition for live blue dot, and stop on close
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (savedHomeCenter) {
        setSearchCenter(savedHomeCenter);
        setLocationMode('home');
        setGeoStatusText('Using your saved home area (GPS unavailable).');
      } else {
        setLocationMode('prompt');
        setShowCitySearch(true);
        setGeoStatusText('GPS is unavailable here. Search your city or area below.');
      }
      return;
    }

    let cancelled = false;
    let watchId: number | null = null;

    const applyDeniedFallback = (reasonText: string) => {
      if (cancelled) return;
      if (savedHomeCenter) {
        setSearchCenter((prev) => prev || savedHomeCenter);
        setLocationMode('home');
        setGeoStatusText(`${reasonText} Using your saved home area instead.`);
      } else {
        setLocationMode('prompt');
        setShowCitySearch(true);
        setGeoStatusText(`${reasonText} Search a city or area below.`);
      }
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLivePos(next);
          if (locationModeRef.current !== 'city') {
            setSearchCenter(next);
            setLocationMode('live');
            setGeoStatusText('Live location active');
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            applyDeniedFallback('Location permission declined.');
          } else {
            applyDeniedFallback('Could not get GPS location.');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLivePos(next);
          if (locationModeRef.current === 'live' || locationModeRef.current === 'detecting') {
            setLocationMode('live');
            setGeoStatusText('Live location active');
            setSearchCenter(next);
          }
        },
        (err) => {
          console.warn('watchPosition warning:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 15000 }
      );
    } catch (err) {
      console.error('Geolocation setup error:', err);
      applyDeniedFallback('Could not start location check.');
    }

    return () => {
      cancelled = true;
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [savedHomeCenter]);

  // 2. Debounced Nominatim city search (max 1 req/sec)
  useEffect(() => {
    const trimmed = cityQuery.trim();
    if (!showCitySearch || trimmed.length < 2) {
      setCityResults([]);
      setCityLoading(false);
      setCityError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const elapsed = Date.now() - lastNominatimAtRef.current;
    const waitMs = Math.max(400, 1000 - elapsed);

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setCityLoading(true);
      setCityError(null);
      lastNominatimAtRef.current = Date.now();

      try {
        const results = await searchCityNominatim(trimmed, controller.signal);
        if (!cancelled) {
          setCityResults(results);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || cancelled) return;
        setCityError(err?.message || 'Could not search cities right now.');
        setCityResults([]);
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setCityLoading(false);
        }
      }
    }, waitMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [cityQuery, showCitySearch]);

  // 3. Query Overpass API with debounce ONLY when moving >= ~1 km or changing radius
  useEffect(() => {
    if (!searchCenter) return;

    const prev = lastQueriedRef.current;
    const movedKm = prev ? haversineKm(prev.lat, prev.lng, searchCenter.lat, searchCenter.lng) : Infinity;
    const radiusChanged = !prev || prev.radiusKm !== radiusKm;

    const shouldForce = forceRefreshRef.current;

    if (!shouldForce && prev && !radiusChanged && movedKm < 1.0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoadingPlaces(true);
      setPlacesError(null);

      try {
        const results = await fetchNearbyWildlifePlaces({
          lat: searchCenter.lat,
          lng: searchCenter.lng,
          radiusKm,
          forceRefresh: shouldForce,
          signal: controller.signal,
        });

        if (!cancelled) {
          lastQueriedRef.current = {
            lat: searchCenter.lat,
            lng: searchCenter.lng,
            radiusKm,
          };
          setPlaces(results);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || cancelled) return;
        setPlacesError(err?.message || 'Could not load nearby wildlife places.');
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setLoadingPlaces(false);
          forceRefreshRef.current = false;
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchCenter, radiusKm, retryTick]);

  // Recompute distance from user live position (or active search center) and sort
  const referencePoint = livePos || searchCenter;
  const sortedPlaces = useMemo(() => {
    const filtered = places.filter((p) => selectedCategories.has(p.category));
    if (!referencePoint) return filtered;
    return filtered
      .map((p) => ({
        ...p,
        distanceKm: haversineKm(referencePoint.lat, referencePoint.lng, p.lat, p.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [places, selectedCategories, referencePoint]);

  const categoryCounts = useMemo(() => {
    const counts: Record<NearbyCategory, number> = {
      reserve: 0,
      zoo: 0,
      shelter: 0,
      vet: 0,
    };
    for (const p of places) {
      counts[p.category] += 1;
    }
    return counts;
  }, [places]);

  // 4. Initialize Leaflet Map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = searchCenter || savedHomeCenter || { lat: 37.77, lng: -122.42 };
    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: searchCenter || savedHomeCenter ? getZoomForRadius(radiusKm) : 3,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    placeMarkersLayerRef.current = markersGroup;
    mapRef.current = map;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      blueDotMarkerRef.current = null;
      radiusCircleRef.current = null;
      placeMarkersLayerRef.current = null;
    };
  }, []);

  // Center map smoothly when searchCenter first resolves or radius changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchCenter) return;

    if (!hasCenteredMapOnceRef.current) {
      hasCenteredMapOnceRef.current = true;
      map.setView([searchCenter.lat, searchCenter.lng], getZoomForRadius(radiusKm), {
        animate: true,
      });
    } else {
      map.setView([searchCenter.lat, searchCenter.lng], getZoomForRadius(radiusKm), {
        animate: true,
      });
    }

    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([searchCenter.lat, searchCenter.lng]);
      radiusCircleRef.current.setRadius(radiusKm * 1000);
    } else {
      radiusCircleRef.current = L.circle([searchCenter.lat, searchCenter.lng], {
        radius: radiusKm * 1000,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: '6, 6',
      }).addTo(map);
    }
  }, [searchCenter, radiusKm]);

  // Update Blue Dot live whenever watchPosition emits
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !livePos) return;

    if (blueDotMarkerRef.current) {
      blueDotMarkerRef.current.setLatLng([livePos.lat, livePos.lng]);
    } else {
      const blueDotIcon = L.divIcon({
        className: 'wilddex-user-blue-dot',
        html: `
          <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
            <span style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(37,99,235,0.22);"></span>
            <span style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></span>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([livePos.lat, livePos.lng], {
        icon: blueDotIcon,
        zIndexOffset: 1000,
      }).addTo(map);
      marker.bindPopup('<strong>You are here</strong>');
      blueDotMarkerRef.current = marker;
    }
  }, [livePos]);

  // Update Colored Place Markers whenever filtered places change
  useEffect(() => {
    const layer = placeMarkersLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    markerByPlaceIdRef.current.clear();

    for (const place of sortedPlaces) {
      const meta = CATEGORY_CONFIG[place.category];
      const markerIconHtml = `
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          background: ${meta.color};
          border: 2.5px solid #ffffff;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 10px rgba(0,0,0,0.28);
        ">
          <span class="material-symbols-outlined" style="font-size: 18px; line-height: 1;">${meta.icon}</span>
        </div>
      `;

      const icon = L.divIcon({
        className: 'wilddex-nearby-pin',
        html: markerIconHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16],
      });

      const directionsUrl = buildDirectionsUrl(referencePoint, {
        lat: place.lat,
        lng: place.lng,
      });

      const websiteHtml = place.website
        ? `<div style="margin-top:4px;"><a href="${escapeHtml(
            place.website
          )}" target="_blank" rel="noopener noreferrer" style="color:#005313;font-weight:600;text-decoration:underline;word-break:break-all;">Website</a></div>`
        : '';

      const phoneHtml = place.phone
        ? `<div style="margin-top:3px;"><a href="tel:${escapeHtml(
            place.phone
          )}" style="color:#1b1c1a;text-decoration:underline;">${escapeHtml(place.phone)}</a></div>`
        : '';

      const popupContent = `
        <div style="font-family:inherit;font-size:13px;line-height:1.4;min-width:170px;max-width:230px;">
          <div style="font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(place.name)}</div>
          <div style="font-size:11px;font-weight:600;color:${meta.color};margin-bottom:4px;">${escapeHtml(
            place.typeLabel
          )}</div>
          <div style="font-size:12px;color:#4b5563;">${escapeHtml(
            formatDistanceKm(place.distanceKm)
          )}</div>
          ${phoneHtml}
          ${websiteHtml}
          <div style="margin-top:8px;">
            <a href="${escapeHtml(
              directionsUrl
            )}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:9999px;background:#005313;color:#ffffff;font-weight:700;font-size:12px;text-decoration:none;">
              Directions
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([place.lat, place.lng], { icon }).addTo(layer);
      marker.bindPopup(popupContent, { maxWidth: 245 });
      markerByPlaceIdRef.current.set(place.id, marker);
    }
  }, [sortedPlaces, referencePoint]);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const target = livePos || searchCenter;
    if (!target) {
      setShowCitySearch(true);
      return;
    }

    if (livePos && locationMode !== 'live') {
      setSearchCenter(livePos);
      setLocationMode('live');
      setCityLabel('');
      setGeoStatusText('Live location active');
      lastQueriedRef.current = null;
    }

    map.invalidateSize();
    map.setView([target.lat, target.lng], getZoomForRadius(radiusKm), { animate: true });
  }, [livePos, searchCenter, locationMode, radiusKm]);

  const handleSelectCity = (place: NominatimCityResult) => {
    const shortName = place.display_name.split(',').slice(0, 2).join(', ');
    const nextCenter = { lat: place.lat, lng: place.lng };
    lastQueriedRef.current = null; // Force Overpass refresh for newly chosen city
    setCityLabel(shortName);
    setLocationMode('city');
    setGeoStatusText(`Showing places near ${shortName}`);
    setSearchCenter(nextCenter);
    setCityResults([]);
    setCityQuery('');
    setShowCitySearch(false);
  };

  const toggleCategory = (cat: NearbyCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) {
          next.delete(cat);
        } else {
          // Clicking the sole active chip restores all 4
          return new Set(['reserve', 'zoo', 'shelter', 'vet']);
        }
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleFocusPlaceOnMap = (place: NearbyPlace) => {
    const map = mapRef.current;
    const marker = markerByPlaceIdRef.current.get(place.id);
    if (map) {
      map.setView([place.lat, place.lng], Math.max(map.getZoom(), 13), { animate: true });
      if (marker) {
        setTimeout(() => marker.openPopup(), 250);
      }
    }
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleTryBiggerRadius = () => {
    const nextRadius =
      RADIUS_OPTIONS.find((r) => r > radiusKm) || 50;
    setRadiusKm(nextRadius);
  };

  return (
    <div className="flex flex-col w-full px-3 sm:px-margin pb-12 pt-2 space-y-4">
      {/* Page Title & Location Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-headline-md text-headline-md text-primary font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[24px] text-secondary">near_me</span>
            <span>Nearby Wildlife Places</span>
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {geoStatusText}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCitySearch((prev) => !prev)}
          className="px-3.5 min-h-[44px] rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">
            edit_location_alt
          </span>
          <span>{showCitySearch ? 'Hide city search' : cityLabel ? 'Change city' : 'Search city'}</span>
        </button>
      </div>

      {/* Non-blocking Nominatim City Search Fallback */}
      {showCitySearch && (
        <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="nearby-city-search"
              className="font-label-md text-label-md font-bold text-on-surface"
            >
              Find a city or area
            </label>
            {livePos && locationMode === 'city' && (
              <button
                type="button"
                onClick={handleRecenter}
                className="font-label-sm text-label-sm text-primary font-semibold hover:underline"
              >
                Use my live GPS
              </button>
            )}
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              id="nearby-city-search"
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Type a city, town, or park area..."
              className="w-full min-w-0 min-h-[46px] bg-surface-container pl-10 pr-10 py-2 rounded-full font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {cityQuery && (
              <button
                type="button"
                onClick={() => setCityQuery('')}
                aria-label="Clear city search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {cityLoading && (
            <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[18px] animate-spin text-primary">
                progress_activity
              </span>
              <span>Searching places...</span>
            </div>
          )}

          {!cityLoading && cityError && (
            <p className="font-body-sm text-body-sm text-error">{cityError}</p>
          )}

          {!cityLoading && !cityError && cityQuery.trim().length >= 2 && (
            <div className="space-y-1.5">
              {cityResults.length === 0 ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  No matching city found. Try another name.
                </p>
              ) : (
                cityResults.map((place) => (
                  <button
                    key={place.place_id}
                    type="button"
                    onClick={() => handleSelectCity(place)}
                    className="w-full p-2.5 min-h-[44px] rounded-xl bg-surface-container hover:bg-surface-container-high text-left flex items-start gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                      location_on
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface break-words">
                      {place.display_name}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Radius Selector & Filter Chips */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label-sm text-label-sm font-bold text-on-surface-variant mr-1">
            Radius:
          </span>
          {RADIUS_OPTIONS.map((r) => {
            const active = radiusKm === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                className={`px-3.5 min-h-[40px] rounded-full font-label-md text-label-md font-bold transition-all active:scale-95 ${
                  active
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {r} km
              </button>
            );
          })}
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setSelectedCategories(new Set(['reserve', 'zoo', 'shelter', 'vet']))
            }
            className={`px-3 min-h-[40px] rounded-full font-label-sm text-label-sm font-bold transition-colors ${
              selectedCategories.size === 4
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All ({places.length})
          </button>

          {ALL_CATEGORIES.map((cat) => {
            const active = selectedCategories.has(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 min-h-[40px] rounded-full font-label-sm text-label-sm font-semibold inline-flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-surface-container-highest text-on-surface ring-1 ring-outline-variant shadow-xs'
                    : 'bg-surface-container text-on-surface-variant opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${cat.bgClass}`}
                  aria-hidden="true"
                />
                <span>{cat.label}</span>
                <span className="text-[11px] opacity-80">({categoryCounts[cat.id]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Leaflet Map Container */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-md border border-outline-variant/30 bg-surface-container-high">
        <div ref={mapContainerRef} className="w-full h-[320px] sm:h-[420px] z-0" />

        {/* Loading Badge over Map */}
        {loadingPlaces && (
          <div className="absolute top-3 left-3 z-[400] px-3 py-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur-md shadow-md flex items-center gap-2 text-primary font-label-sm text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[16px] animate-spin">
              progress_activity
            </span>
            <span>Finding places...</span>
          </div>
        )}

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-3 right-3 z-[400] px-3.5 min-h-[44px] rounded-full bg-surface-container-lowest/95 hover:bg-surface text-primary font-label-md text-label-md font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all border border-outline-variant/30"
        >
          <span className="material-symbols-outlined text-[18px]">my_location</span>
          <span>Recenter</span>
        </button>
      </div>

      {/* Map Color & Icon Legend */}
      <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-[#2563eb] ring-2 ring-white shadow-xs shrink-0" />
          <span className="font-label-sm text-label-sm text-on-surface font-semibold">
            You (live)
          </span>
        </div>
        {ALL_CATEGORIES.map((cat) => (
          <div key={cat.id} className="inline-flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full ${cat.bgClass} text-white inline-flex items-center justify-center shrink-0`}
            >
              <span className="material-symbols-outlined text-[12px]">{cat.icon}</span>
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {cat.label}
            </span>
          </div>
        ))}
      </div>

      {/* OpenStreetMap completeness & opening hours disclaimer */}
      <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1.5 px-1">
        <span className="material-symbols-outlined text-[16px] text-secondary shrink-0 mt-0.5">
          info
        </span>
        <span>
          Places come from OpenStreetMap and may be incomplete. Check opening hours before you go.
        </span>
      </p>

      {/* Error State with Retry */}
      {!loadingPlaces && placesError && (
        <div className="p-4 rounded-2xl bg-error-container/25 border border-error/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
              error
            </span>
            <p className="font-body-sm text-body-sm text-error">{placesError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              lastQueriedRef.current = null;
              forceRefreshRef.current = true;
              setRetryTick((t) => t + 1);
            }}
            className="px-4 min-h-[44px] rounded-full bg-error text-on-error font-label-md text-label-md font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Places List View Sorted by Distance */}
      <section className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            Places near {cityLabel ? cityLabel : locationMode === 'home' ? 'your home area' : 'you'}
          </h2>
          {!loadingPlaces && searchCenter && (
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {sortedPlaces.length} {sortedPlaces.length === 1 ? 'place' : 'places'} within {radiusKm} km
            </span>
          )}
        </div>

        {/* Loading Skeleton List */}
        {loadingPlaces && (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 animate-pulse flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-full bg-surface-container-high shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-3 w-1/3 rounded bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Waiting for city selection (if GPS denied & no saved home) */}
        {!loadingPlaces && !searchCenter && (
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-2">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Search a city or area above to see wildlife reserves, zoos, shelters, and vets nearby.
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loadingPlaces && !placesError && searchCenter && sortedPlaces.length === 0 && (
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary-container/40 text-secondary mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">search_off</span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface font-bold">
              No places found, try a bigger radius
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {radiusKm < 50 && (
                <button
                  type="button"
                  onClick={handleTryBiggerRadius}
                  className="px-4 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-label-md font-bold"
                >
                  Try {RADIUS_OPTIONS.find((r) => r > radiusKm) || 50} km
                </button>
              )}
              {selectedCategories.size < 4 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategories(new Set(['reserve', 'zoo', 'shelter', 'vet']))
                  }
                  className="px-4 min-h-[44px] rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold"
                >
                  Show all categories
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sorted Place Cards */}
        {!loadingPlaces && !placesError && sortedPlaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedPlaces.map((place) => {
              const meta = CATEGORY_CONFIG[place.category];
              const directionsUrl = buildDirectionsUrl(referencePoint, {
                lat: place.lat,
                lng: place.lng,
              });

              return (
                <article
                  key={place.id}
                  className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 shadow-xs flex flex-col justify-between gap-3 min-w-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleFocusPlaceOnMap(place)}
                      aria-label={`Show ${place.name} on map`}
                      className={`w-11 h-11 rounded-full ${meta.bgClass} text-white flex items-center justify-center shrink-0 shadow-sm hover:opacity-90 active:scale-95 transition-all`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleFocusPlaceOnMap(place)}
                        className="text-left w-full group"
                      >
                        <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold break-words group-hover:text-primary transition-colors">
                          {place.name}
                        </h3>
                      </button>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="font-label-sm text-label-sm font-semibold text-secondary">
                          {place.typeLabel}
                        </span>
                        <span className="text-on-surface-variant text-xs">•</span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {formatDistanceKm(place.distanceKm)}
                        </span>
                      </div>

                      {(place.phone || place.website) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                          {place.phone && (
                            <a
                              href={`tel:${place.phone}`}
                              className="inline-flex items-center gap-1 text-on-surface hover:text-primary font-medium break-all"
                            >
                              <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">
                                call
                              </span>
                              <span>{place.phone}</span>
                            </a>
                          )}
                          {place.website && (
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                            >
                              <span className="material-symbols-outlined text-[15px] shrink-0">
                                language
                              </span>
                              <span>Website</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => handleFocusPlaceOnMap(place)}
                      className="flex-1 min-w-[110px] min-h-[42px] px-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                      <span>Show on map</span>
                    </button>

                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[110px] min-h-[42px] px-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">directions</span>
                      <span>Directions</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
