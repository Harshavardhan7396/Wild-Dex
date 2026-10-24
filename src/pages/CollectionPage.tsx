import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthPromptCard } from '../components/auth/AuthPromptCard';
import { InfoTooltip } from '../components/common/InfoTooltip';
import {
  FirebaseCollectionItem,
  FirebaseAlbum,
  subscribeToFirebaseUserCollection,
  subscribeToFirebaseUserAlbums,
  deleteSpecimenFromFirebase,
  moveSpecimenToAlbum,
  createFirebaseAlbum,
  deleteFirebaseAlbum,
  ensureDefaultAlbum,
} from '../services/supabaseCollectionService';
import { CURATED_SPECIES } from '../services/speciesService';

export const CollectionPage: React.FC = () => {
  const { currentUser, setAuthModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'grid' | 'albums' | 'badges'>('grid');
  const [toast, setToast] = useState<string | null>(null);

  // Data states
  const [specimens, setSpecimens] = useState<FirebaseCollectionItem[]>([]);
  const [albums, setAlbums] = useState<FirebaseAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & selection
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string>('all');
  const [selectedRarityFilter, setSelectedRarityFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal states
  const [itemToMove, setItemToMove] = useState<FirebaseCollectionItem | null>(null);
  const [targetAlbumId, setTargetAlbumId] = useState<string>('default');
  const [itemToDelete, setItemToDelete] = useState<FirebaseCollectionItem | null>(null);
  const [detailItem, setDetailItem] = useState<FirebaseCollectionItem | null>(null);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [albumToDelete, setAlbumToDelete] = useState<FirebaseAlbum | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Setup real-time listeners to Firestore
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setSpecimens([]);
      setAlbums([]);
      return;
    }

    setLoading(true);
    setError(null);

    ensureDefaultAlbum(currentUser.uid).catch(() => {});

    let unsubCollection: (() => void) | null = null;
    let unsubAlbums: (() => void) | null = null;

    try {
      unsubCollection = subscribeToFirebaseUserCollection(
        currentUser.uid,
        (items) => {
          setSpecimens(items);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Subscription collection error:', err);
          setError('Could not sync collection data. Please check connection and retry.');
          setLoading(false);
        }
      );

      unsubAlbums = subscribeToFirebaseUserAlbums(
        currentUser.uid,
        (albumList) => {
          setAlbums(albumList);
        },
        (err) => {
          console.error('Subscription albums error:', err);
        }
      );
    } catch (e: any) {
      setError(e.message || 'Failed to initialize collection sync.');
      setLoading(false);
    }

    return () => {
      if (unsubCollection) unsubCollection();
      if (unsubAlbums) unsubAlbums();
    };
  }, [currentUser]);

  // Handle retry
  const handleRetry = useCallback(() => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    ensureDefaultAlbum(currentUser.uid).catch(() => {});
  }, [currentUser]);

  // Move specimen action
  const handleExecuteMove = async () => {
    if (!currentUser || !itemToMove) return;
    setActionLoading(true);
    try {
      await moveSpecimenToAlbum(currentUser.uid, itemToMove.id, targetAlbumId);
      showToast(`Moved ${itemToMove.commonName} to album.`);
      setItemToMove(null);
    } catch (err: any) {
      showToast('Failed to move item. Please retry.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete specimen action
  const handleExecuteDelete = async () => {
    if (!currentUser || !itemToDelete) return;
    setActionLoading(true);
    try {
      await deleteSpecimenFromFirebase(
        currentUser.uid,
        itemToDelete.id,
        itemToDelete.storagePath
      );
      showToast(`Removed ${itemToDelete.commonName} from My Collection.`);
      setItemToDelete(null);
    } catch (err: any) {
      showToast('Could not delete item. Please retry.');
    } finally {
      setActionLoading(false);
    }
  };

  // Create album action
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newAlbumName.trim()) return;
    setActionLoading(true);
    try {
      await createFirebaseAlbum({
        userId: currentUser.uid,
        name: newAlbumName.trim(),
        description: newAlbumDesc.trim(),
      });
      showToast(`Created album "${newAlbumName.trim()}"`);
      setNewAlbumName('');
      setNewAlbumDesc('');
      setShowCreateAlbumModal(false);
    } catch (err) {
      showToast('Failed to create album.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete album action
  const handleExecuteDeleteAlbum = async () => {
    if (!currentUser || !albumToDelete) return;
    setActionLoading(true);
    try {
      await deleteFirebaseAlbum(currentUser.uid, albumToDelete.id);
      showToast(`Deleted album "${albumToDelete.name}"`);
      setAlbumToDelete(null);
      if (selectedAlbumFilter === albumToDelete.id) {
        setSelectedAlbumFilter('all');
      }
    } catch {
      showToast('Could not delete album.');
    } finally {
      setActionLoading(false);
    }
  };

  // Progress metrics
  const uniqueSpecies = Array.from(new Set(specimens.map((s) => s.scientificName.toLowerCase())));
  const totalUnique = uniqueSpecies.length;
  const explorationTarget = 50;
  const progressPercent = Math.min(100, Math.round((totalUnique / explorationTarget) * 100));

  const legendaryCount = specimens.filter((s) => s.rarity === 'Legendary').length;
  const rareCount = specimens.filter((s) => s.rarity === 'Rare').length;
  const commonCount = specimens.filter((s) => s.rarity === 'Common').length;

  // Filtered specimens
  const filteredSpecimens = specimens.filter((item) => {
    if (selectedAlbumFilter !== 'all' && item.albumId !== selectedAlbumFilter) {
      return false;
    }
    if (selectedRarityFilter !== 'all' && item.rarity !== selectedRarityFilter) {
      return false;
    }
    if (
      selectedCategoryFilter !== 'all' &&
      item.category.toLowerCase() !== selectedCategoryFilter.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  // Dynamic badges earned from user's real specimens
  const dynamicBadges = [
    {
      name: 'First Discovery',
      desc: 'Saved your first plant or animal to your collection',
      icon: 'camera_alt',
      unlocked: specimens.length >= 1,
    },
    {
      name: 'Rare Sighting',
      desc: 'Found at least 1 Rare or In Danger species',
      icon: 'military_tech',
      unlocked: rareCount + legendaryCount >= 1,
    },
    {
      name: 'Legendary Tracker',
      desc: 'Found a species In Serious Danger',
      icon: 'star',
      unlocked: legendaryCount >= 1,
    },
    {
      name: 'Album Creator',
      desc: 'Created your own photo album',
      icon: 'folder_special',
      unlocked: albums.length > 1,
    },
    {
      name: 'Nature Explorer',
      desc: 'Saved 10+ animals or plants to your collection',
      icon: 'emoji_events',
      unlocked: specimens.length >= 10,
    },
    {
      name: 'All-Around Naturalist',
      desc: 'Saved items across 3+ different groups',
      icon: 'eco',
      unlocked: new Set(specimens.map((s) => s.category)).size >= 3,
    },
  ];

  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-2 space-y-space-md">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-2xl flex items-center gap-2 border border-outline-variant/40 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-secondary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="p-space-md rounded-3xl bg-surface-container-high shadow-sm flex flex-col gap-3 border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold">My Collection</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Your Saved Animals & Plants
            </p>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold shadow-sm">
              <span className="material-symbols-outlined text-[16px]">cloud_done</span>
              <span>{specimens.length} Saved</span>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>Sign in</span>
            </button>
          )}
        </div>

        {/* Discovery Progress Meter */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between font-label-sm text-label-sm text-on-surface">
            <span className="font-medium">Animals & Plants Found</span>
            <span className="font-bold text-primary">
              {totalUnique} / {explorationTarget} Found ({progressPercent}%)
            </span>
          </div>
          <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden flex p-0.5 border border-outline-variant/30">
            <div
              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            ></div>
          </div>
        </div>

        {/* How Rare & Stats Strip */}
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">How Rare</span>
            <InfoTooltip text="Common means easily seen. Rare means seen less often. Legendary means in serious danger and hard to find." />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-center">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                {specimens.length}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">Total</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-center">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                {commonCount}
              </span>
              <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">Common</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-center">
              <span className="font-headline-sm text-headline-sm text-secondary font-bold">
                {rareCount}
              </span>
              <p className="font-label-sm text-[10px] text-secondary uppercase font-bold">Rare</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-center border border-amber-500/30 bg-amber-500/5">
              <span className="font-headline-sm text-headline-sm text-amber-600 font-bold">
                {legendaryCount}
              </span>
              <p className="font-label-sm text-[10px] text-amber-700 uppercase font-bold">Legendary</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Protection Prompt if not signed in */}
      {!currentUser && (
        <AuthPromptCard
          title="Sign in with Google to Access Your Collection"
          description="Your collection is safely saved to your account. Sign in to view your saved animals and plants, photo albums, and badges."
          icon="folder_shared"
        />
      )}

      {/* View Segmented Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-full shadow-inner">
        <button
          onClick={() => setActiveTab('grid')}
          className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
            activeTab === 'grid'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          Saved Items ({currentUser ? specimens.length : 'Preview'})
        </button>
        <button
          onClick={() => setActiveTab('albums')}
          className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
            activeTab === 'albums'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          Albums ({albums.length})
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex-1 py-2 rounded-full font-label-md text-label-md transition-all ${
            activeTab === 'badges'
              ? 'bg-surface-container-lowest text-primary font-bold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          type="button"
        >
          Badges ({dynamicBadges.filter((b) => b.unlocked).length})
        </button>
      </div>

      {/* ERROR STATE WITH RETRY */}
      {error && (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error">error</span>
            <span className="text-xs">{error}</span>
          </div>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 rounded-full bg-error text-on-error text-xs font-bold shrink-0 shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && currentUser && (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-full bg-surface-container-high"></div>
            <div className="h-9 w-24 rounded-full bg-surface-container-high"></div>
            <div className="h-9 w-24 rounded-full bg-surface-container-high"></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="rounded-2xl bg-surface-container-low overflow-hidden h-56 flex flex-col">
                <div className="w-full aspect-square bg-surface-container-high"></div>
                <div className="p-2.5 space-y-2">
                  <div className="h-4 bg-surface-container-high rounded w-3/4"></div>
                  <div className="h-3 bg-surface-container-high rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: SPECIMEN GRID */}
      {activeTab === 'grid' && !loading && (
        <div className="flex flex-col gap-4">
          {currentUser && (
            /* Filtering Row */
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {/* Rarity filter */}
              <div className="flex items-center gap-1 bg-surface-container p-1 rounded-full shrink-0">
                {(['all', 'Common', 'Rare', 'Legendary'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRarityFilter(r)}
                    className={`px-3 py-1 rounded-full transition-all capitalize font-medium ${
                      selectedRarityFilter === r
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Album filter */}
              {albums.length > 0 && (
                <select
                  value={selectedAlbumFilter}
                  onChange={(e) => setSelectedAlbumFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface font-label-sm text-xs"
                >
                  <option value="all">All Albums</option>
                  <option value="default">All Saved Items</option>
                  {albums.map((alb) => (
                    <option key={alb.id} value={alb.id}>
                      {alb.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* EMPTY STATE */}
          {currentUser && specimens.length === 0 && (
            <div className="p-8 rounded-3xl bg-surface-container-low border border-dashed border-outline-variant text-center flex flex-col items-center gap-3 my-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[32px]">photo_camera</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                Your Collection is Ready
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm leading-relaxed">
                You haven't saved any animals or plants yet. Use the AI Scanner to discover and save what you find!
              </p>
              <Link
                to="/scan"
                className="mt-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
                <span>Open Scanner</span>
              </Link>
            </div>
          )}

          {/* User's Cloud Firestore Specimen Grid */}
          {currentUser && filteredSpecimens.length > 0 && (
            <div className="grid grid-cols-2 gap-space-sm">
              {filteredSpecimens.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all group border border-outline-variant/20 relative"
                >
                  {/* Photo Container */}
                  <div
                    onClick={() => setDetailItem(item)}
                    className="relative w-full aspect-square bg-surface-container cursor-pointer overflow-hidden"
                  >
                    <img
                      alt={item.commonName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      src={item.photoUrl}
                    />

                    {/* Rarity Tier Badge */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full font-label-sm text-[10px] font-bold shadow-sm flex items-center gap-1 ${
                        item.rarity === 'Legendary'
                          ? 'bg-amber-500 text-amber-950 ring-1 ring-amber-300'
                          : item.rarity === 'Rare'
                          ? 'bg-secondary-container text-on-secondary-container ring-1 ring-secondary'
                          : 'bg-surface/90 text-on-surface backdrop-blur-sm'
                      }`}
                    >
                      {item.rarity === 'Legendary' && (
                        <span className="material-symbols-outlined text-[12px]">star</span>
                      )}
                      <span>{item.rarity}</span>
                    </span>

                    {/* Category & Location Badges */}
                    <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-white">
                      <span className="font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm capitalize">
                        {item.category}
                      </span>
                      {item.location && (
                        <span
                          title="GPS Coordinates Recorded"
                          className="font-label-sm text-[10px] px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm flex items-center"
                        >
                          <span className="material-symbols-outlined text-[12px]">location_on</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Info & Actions */}
                  <div className="p-2.5 flex flex-col justify-between flex-1 bg-surface-container-low">
                    <div onClick={() => setDetailItem(item)} className="cursor-pointer">
                      <h3 className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {item.commonName}
                      </h3>
                      <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                        {item.scientificName}
                      </p>
                    </div>

                    {/* Item Management Toolbar */}
                    <div className="mt-2.5 pt-2 border-t border-outline-variant/30 flex items-center justify-between text-on-surface-variant">
                      <span className="font-label-sm text-[10px] text-outline font-mono">
                        {(item.confidence * 100).toFixed(0)}% sure
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          title="Move to Album"
                          onClick={() => {
                            setItemToMove(item);
                            setTargetAlbumId(item.albumId || 'default');
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-container hover:text-primary transition-colors"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                        </button>

                        <button
                          title="Delete Item"
                          onClick={() => setItemToDelete(item)}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-error-container hover:text-error transition-colors"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Curated Field Encyclopedia Section */}
          <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/30">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Regional Verified Records ({CURATED_SPECIES.length})
              </span>
              <span className="text-[11px] text-outline">Reference Database</span>
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              {CURATED_SPECIES.map((sp) => (
                <Link
                  key={sp.id}
                  to={`/species/${sp.id}`}
                  className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all group border border-outline-variant/20"
                >
                  <div className="relative w-full aspect-square bg-surface-container">
                    <img
                      alt={sp.commonName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      src={sp.photoUrl}
                    />
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full font-label-sm text-[10px] font-bold ${
                        sp.rarity === 'Legendary'
                          ? 'bg-amber-500 text-amber-950'
                          : sp.rarity === 'Rare' || sp.rarity === 'Very Rare'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface/90 text-on-surface'
                      }`}
                    >
                      {sp.rarity}
                    </span>
                    <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-white">
                      <span className="font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                        {sp.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {sp.commonName}
                      </h3>
                      <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                        <span className="text-[10px] text-on-surface-variant/70 mr-1">Science name:</span>
                        <span className="italic">{sp.scientificName}</span>
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-secondary font-label-sm text-[11px] font-semibold">
                      <span>Learn More</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FIELD ALBUMS */}
      {activeTab === 'albums' && (
        <div className="flex flex-col gap-3">
          {/* Create New Album Button */}
          {currentUser && (
            <button
              onClick={() => setShowCreateAlbumModal(true)}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-primary/40 text-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-surface-container transition-colors shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
              <span>New Album</span>
            </button>
          )}

          {/* Default General Album Card */}
          <div className="p-3.5 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[24px]">forest</span>
              </div>
              <div>
                <h3 className="font-label-lg font-bold text-on-surface">All Saved Items</h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Main collection •{' '}
                  {specimens.filter((s) => s.albumId === 'default' || !s.albumId).length} Items
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedAlbumFilter('default');
                setActiveTab('grid');
              }}
              className="px-3 py-1.5 rounded-full bg-surface-container text-primary font-label-sm text-xs font-bold hover:bg-surface-container-highest"
            >
              View
            </button>
          </div>

          {/* User Custom Albums */}
          {albums.map((alb) => {
            const count = specimens.filter((s) => s.albumId === alb.id).length;
            return (
              <div
                key={alb.id}
                className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/30 flex items-center justify-between shadow-sm hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-[24px]">folder</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-label-lg font-bold text-on-surface truncate">{alb.name}</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant truncate">
                      {alb.description || 'Custom Album'} • {count} Observations
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setSelectedAlbumFilter(alb.id);
                      setActiveTab('grid');
                    }}
                    className="px-3 py-1.5 rounded-full bg-surface-container-highest text-primary font-label-sm text-xs font-bold"
                  >
                    View
                  </button>
                  <button
                    onClick={() => setAlbumToDelete(alb)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Shared Collection Link */}
          <Link
            to="/shared-collection"
            className="p-3.5 rounded-2xl bg-surface-container flex items-center justify-between hover:bg-surface-container-high transition-colors border border-outline-variant/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[24px]">group</span>
              </div>
              <div>
                <h3 className="font-label-lg font-bold text-on-surface">Regional Shared Dossiers</h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Collaborative squad findings with fellow naturalists
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline">chevron_right</span>
          </Link>
        </div>
      )}

      {/* TAB 3: BADGES */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-2 gap-space-sm">
          {dynamicBadges.map((b) => (
            <div
              key={b.name}
              className={`p-3.5 rounded-2xl flex flex-col gap-2 transition-all ${
                b.unlocked
                  ? 'bg-surface-container-low border border-primary/20 shadow-sm ring-1 ring-primary/10'
                  : 'bg-surface-container-lowest opacity-50 border border-outline-variant/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    b.unlocked
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'bg-surface-container text-outline'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{b.icon}</span>
                </div>
                {b.unlocked ? (
                  <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold">
                    Earned
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-outline">Locked</span>
                )}
              </div>
              <div>
                <h4 className="font-label-md text-label-md font-bold text-on-surface">{b.name}</h4>
                <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5 leading-tight">
                  {b.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: MOVE SPECIMEN TO ALBUM */}
      {itemToMove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Move Item
              </h3>
              <button
                onClick={() => setItemToMove(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Move <strong>{itemToMove.commonName}</strong> to an album:
            </p>

            <div className="space-y-2">
              <label
                onClick={() => setTargetAlbumId('default')}
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer ${
                  targetAlbumId === 'default'
                    ? 'border-primary bg-primary-container/20 ring-1 ring-primary'
                    : 'border-outline-variant/30 bg-surface-container'
                }`}
              >
                <span className="font-label-md text-sm font-semibold">All Saved Items</span>
                {targetAlbumId === 'default' && (
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                )}
              </label>

              {albums.map((alb) => (
                <label
                  key={alb.id}
                  onClick={() => setTargetAlbumId(alb.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer ${
                    targetAlbumId === alb.id
                      ? 'border-primary bg-primary-container/20 ring-1 ring-primary'
                      : 'border-outline-variant/30 bg-surface-container'
                  }`}
                >
                  <span className="font-label-md text-sm font-semibold">{alb.name}</span>
                  {targetAlbumId === alb.id && (
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToMove(null)}
                className="flex-1 py-2.5 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteMove}
                className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold shadow-md"
              >
                {actionLoading ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE SPECIMEN CONFIRMATION */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-error">delete_forever</span>
            </div>

            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Delete Item?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
                Are you sure you want to delete <strong>{itemToDelete.commonName}</strong>? This cannot be undone.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteDelete}
                className="flex-1 py-2.5 rounded-full bg-error text-on-error font-label-md font-bold shadow-md"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ALBUM */}
      {showCreateAlbumModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateAlbum}
            className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30"
          >
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Create Field Album
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateAlbumModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Album Name *</label>
              <input
                type="text"
                required
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="e.g. Olympic Peninsula Rainforest"
                className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface font-body-sm text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">Description (Optional)</label>
              <textarea
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                placeholder="Species recorded along the Hoh River trail..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface font-body-sm text-xs resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateAlbumModal(false)}
                className="flex-1 py-2.5 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newAlbumName.trim()}
                className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Album'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DELETE ALBUM CONFIRMATION */}
      {albumToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-error">folder_delete</span>
            </div>

            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Delete Album?
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
                Delete <strong>{albumToDelete.name}</strong>? Any items inside will remain safe in your All Saved Items.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAlbumToDelete(null)}
                className="flex-1 py-2.5 rounded-full bg-surface-container text-on-surface font-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteDeleteAlbum}
                className="flex-1 py-2.5 rounded-full bg-error text-on-error font-label-md font-bold shadow-md"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ITEM DETAILS & OBSERVATION */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">visibility</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Saved Details
                </h3>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* High-res Photo */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-inner">
              <img
                src={detailItem.photoUrl}
                alt={detailItem.commonName}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full font-label-sm text-xs font-bold ${
                  detailItem.rarity === 'Legendary'
                    ? 'bg-amber-500 text-amber-950'
                    : detailItem.rarity === 'Rare'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface/90 text-on-surface'
                }`}
              >
                How Rare: {detailItem.rarity}
              </span>
            </div>

            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                {detailItem.commonName}
              </h2>
              <p className="font-body-sm text-sm text-on-surface-variant">
                <span className="text-[11px] font-medium text-on-surface-variant/70 mr-1.5">Science name:</span>
                <span className="italic">{detailItem.scientificName}</span>
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-surface-container">
                <span className="text-outline uppercase text-[10px] font-bold block">Group</span>
                <span className="font-semibold text-on-surface capitalize">{detailItem.category}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container">
                <span className="text-outline uppercase text-[10px] font-bold block">Match Score</span>
                <span className="font-semibold text-primary">{(detailItem.confidence * 100).toFixed(0)}% sure</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container">
                <span className="text-outline uppercase text-[10px] font-bold block">Date Saved</span>
                <span className="font-semibold text-on-surface">
                  {new Date(detailItem.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-container">
                <span className="text-outline uppercase text-[10px] font-bold block">Conservation</span>
                <span className="font-semibold text-secondary">{detailItem.conservationStatus}</span>
              </div>
            </div>

            {/* Location Telemetry */}
            {detailItem.location && (
              <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center gap-2.5 text-xs">
                <span className="material-symbols-outlined text-secondary text-[20px]">my_location</span>
                <div>
                  <span className="font-bold text-on-surface block">GPS Telemetry Logged</span>
                  <span className="text-on-surface-variant font-mono">
                    {detailItem.location.latitude}°, {detailItem.location.longitude}°
                  </span>
                </div>
              </div>
            )}

            {/* User Notes */}
            {detailItem.notes && (
              <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs">
                <span className="font-bold text-on-surface block mb-1">Field Notes:</span>
                <p className="text-on-surface-variant leading-relaxed italic">{detailItem.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Link
                to={`/species/${detailItem.speciesId}`}
                onClick={() => setDetailItem(null)}
                className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-label-md font-bold text-center shadow-md"
              >
                Encyclopedia Dossier
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
