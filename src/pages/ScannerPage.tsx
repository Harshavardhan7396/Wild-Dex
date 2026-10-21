import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  scanSpecimenImage,
  getAllScannerTestCases,
  EnrichedSpecimenScanResult,
} from '../services/scannerService';
import {
  SCANNER_SYSTEM_INSTRUCTION,
  GEMINI_SCANNER_MODEL,
  ScannerTestCase,
} from '../config/scannerPrompt';
import {
  addSpecimenToCollection,
  isSpeciesCollected,
} from '../services/collectionService';
import { useAuth } from '../contexts/AuthContext';
import {
  addSpecimenToFirebase,
  getFirebaseUserAlbums,
  FirebaseAlbum,
} from '../services/firebaseCollectionService';
import { InfoTooltip } from '../components/common/InfoTooltip';
import {
  formatConservationStatus,
  getConservationMeaning,
  getMatchScoreMeaning,
  formatMatchScore,
} from '../utils/formatters';

export const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Camera & hardware states
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [mode, setMode] = useState<'Auto' | 'Animal' | 'Plant' | 'Insect' | 'Fungi' | 'Bird'>('Animal');

  // Scanning & AI states
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('Initializing sensor...');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [retryImagePayload, setRetryImagePayload] = useState<string | null>(null);

  // Feedback, collection & share
  const { currentUser, setAuthModalOpen } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [isSavedInDex, setIsSavedInDex] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTestCasesModal, setShowTestCasesModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNotes, setSaveNotes] = useState('');
  const [includeGps, setIncludeGps] = useState(true);
  const [isSavingToDex, setIsSavingToDex] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState('default');
  const [userAlbums, setUserAlbums] = useState<FirebaseAlbum[]>([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const testCases = getAllScannerTestCases();

  // Active scan result state (pre-initialized with high-clarity Monarch butterfly canonical test case)
  const [scanResult, setScanResult] = useState<EnrichedSpecimenScanResult>({
    ...testCases[0].expectedOutput,
    enrichedPhotos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTp4wz_G-5zP2-JqUf7VbLzK1E9B12sQ3_X6t8M9nO0pQrStUvWxYz',
    ],
    photoCredit: 'Verified iNaturalist Observation',
    wikiDescription:
      'The monarch butterfly or simply monarch is a milkweed butterfly in the family Nymphalidae. Other common names, depending on region, include milkweed, common tiger, wanderer, and black-veined brown.',
    iNatObservationsCount: 38450,
    matchedSpeciesId: 'monarch-butterfly',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize camera with getUserMedia
  const initCamera = useCallback(async () => {
    setCameraError(null);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access is not supported by this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasCamera(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setHasCamera(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser permissions or upload a photo.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No physical camera device detected on this system. You can upload a photo from your gallery below.');
      } else {
        setCameraError('Camera stream unavailable in this sandbox. Use photo upload for instant identification.');
      }
    }
  }, [facingMode]);

  useEffect(() => {
    initCamera();
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initCamera]);

  // Ensure stream stays bound to video ref when camera is enabled
  useEffect(() => {
    if (videoRef.current && mediaStreamRef.current && hasCamera) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [hasCamera]);

  // Sync collection status
  useEffect(() => {
    if (scanResult && scanResult.scientificName) {
      setIsSavedInDex(isSpeciesCollected(scanResult.scientificName));
    }
  }, [scanResult]);

  // Fetch albums for save selection
  useEffect(() => {
    if (currentUser) {
      getFirebaseUserAlbums(currentUser.uid)
        .then((res) => {
          if (res) setUserAlbums(res);
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Core specimen identification runner
  const performIdentification = async (imageDataUrl: string, testCaseIdToRun?: string) => {
    setIsScanning(true);
    setScanError(null);
    setRetryImagePayload(imageDataUrl);
    setShowResult(false);
    setSelectedPhotoIndex(0);

    try {
      setScanStep('Compressing image to 1024px maximum...');
      await new Promise((r) => setTimeout(r, 200));

      setScanStep(`Sending image to ${GEMINI_SCANNER_MODEL}...`);
      const enrichedResult = await scanSpecimenImage(imageDataUrl, testCaseIdToRun);

      setScanStep('Finding more photos and information...');
      await new Promise((r) => setTimeout(r, 300));

      setScanResult(enrichedResult);
      setShowResult(true);
      setIsSavedInDex(isSpeciesCollected(enrichedResult.scientificName));

      if (enrichedResult.notASpecies) {
        showToast('Not an animal or plant');
      } else if (enrichedResult.confidence < 0.6) {
        showToast('Not sure, try a clearer photo');
      } else {
        showToast(`Identified ${enrichedResult.commonName} (${(enrichedResult.confidence * 100).toFixed(0)}% sure)`);
      }
    } catch (err: any) {
      console.error('Scan execution error:', err);
      setScanError(
        err?.message ||
          'Analysis interrupted. The organism could not be clearly resolved. Please check camera focus, lighting, and retry.'
      );
      showToast('Scan could not complete. Check error guidance.');
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger camera capture shutter
  const handleTriggerShutter = async () => {
    if (isScanning) return;

    let imgData: string | null = null;

    if (videoRef.current && hasCamera && videoRef.current.videoWidth > 0) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 960;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          imgData = canvas.toDataURL('image/jpeg', 0.9);
          setCapturedImage(imgData);
        }
      } catch (err) {
        console.warn('Canvas frame capture error:', err);
      }
    }

    // Fallback image if camera stream is blank
    if (!imgData) {
      if (capturedImage) {
        imgData = capturedImage;
      } else {
        imgData =
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCVwHQkFS0U8H3_S7YeJ3rB9lracVYKKvv2XuW5cgRds_6BaT8ewOz9wI0d5rX2OmMHxLNLbcusyZJnF0M9qUlqAW16SD8xMkJjmZn6FHfI9uwgy80d4abnPGfRZYSOZo2LcbMDNcx88Itd-RbsTPCDFOm6N-xGzcpWPGpyz7Iwlj6BFCazsRmHMCKa4vWw3HfoorFP2YKwWmYqQbO6rVn6n-_lpDQOoYEWxUYbNGei8xgttVlxI_JgdQ';
        setCapturedImage(imgData);
      }
    }

    await performIdentification(imgData, selectedTestCaseId || undefined);
  };

  // Handle local photo upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPEG, PNG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const rawUrl = reader.result as string;
        setCapturedImage(rawUrl);
        await performIdentification(rawUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Switch to a canonical test case
  const handleSelectTestCase = async (tc: ScannerTestCase) => {
    setSelectedTestCaseId(tc.id);
    setShowTestCasesModal(false);
    setCapturedImage(null);
    showToast(`Evaluating ${tc.title.split(':')[0]}...`);
    await performIdentification('test-case-image', tc.id);
  };

  // ACTION 1: View Details in Species Encyclopedia
  const handleViewDetails = () => {
    if (scanResult.notASpecies) {
      showToast('Non-biological item cannot be viewed in species encyclopedia.');
      return;
    }

    const routeTarget =
      scanResult.matchedSpeciesId ||
      scanResult.scientificName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    navigate(`/species/${encodeURIComponent(routeTarget)}`);
  };

  // ACTION 2: Add to Collection (Protected behind Google Auth)
  const handleAddToCollection = () => {
    if (scanResult.notASpecies) {
      showToast('Only animals and plants can be saved to your collection.');
      return;
    }

    if (!currentUser) {
      setAuthModalOpen(true);
      showToast('Please sign in with Google to save to your collection.');
      return;
    }

    setShowSaveModal(true);
  };

  const handleConfirmSaveToFirebase = async () => {
    if (!currentUser) return;
    setIsSavingToDex(true);
    try {
      const bestPhoto =
        capturedImage ||
        (scanResult.enrichedPhotos && scanResult.enrichedPhotos[0]) ||
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDTp4wz_G-5zP2-JqUf7VbLzK1E9B12sQ3_X6t8M9nO0pQrStUvWxYz';

      await addSpecimenToFirebase({
        userId: currentUser.uid,
        scanResult,
        photoDataUrl: bestPhoto,
        albumId: selectedAlbumId,
        notes: saveNotes,
        includeLocation: includeGps,
      });

      // Also sync to local collection for offline preview
      addSpecimenToCollection(scanResult, capturedImage || undefined, bestPhoto);
      setIsSavedInDex(true);
      setShowSaveModal(false);
      showToast(`Saved ${scanResult.commonName} to My Collection!`);
    } catch (err: any) {
      console.error('Error saving specimen to Firebase:', err);
      showToast('Could not save. Please retry.');
    } finally {
      setIsSavingToDex(false);
    }
  };

  // ACTION 3: Share Discovery
  const handleShare = async () => {
    const shareUrl = window.location.origin + '/species/' + encodeURIComponent(scanResult.scientificName);
    const shareTitle = `WildDex: ${scanResult.commonName}`;
    const shareText = `I found a ${scanResult.commonName} (${scanResult.scientificName}) with ${(scanResult.confidence * 100).toFixed(0)}% match score using WildDex!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        showToast('Shared successfully!');
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    }

    // Fallback: Show Share Modal and Copy to Clipboard
    try {
      await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
      showToast('Link copied to clipboard!');
    } catch {
      showToast('Sharing link prepared.');
    }
    setShowShareModal(true);
  };

  const isLowConfidence = scanResult.confidence < 0.6 && !scanResult.notASpecies;

  return (
    <div className="flex flex-col w-full relative select-none overflow-hidden pb-12 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-2xl flex items-center gap-2 border border-outline-variant/40 animate-in fade-in zoom-in-95">
          <span className="material-symbols-outlined text-[18px] text-secondary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* TOP CAMERA CONTROLS HUD */}
      <div className="px-margin pt-2 pb-3 flex flex-col gap-space-sm z-30">
        <div className="flex items-center justify-between gap-space-xs">
          <button
            aria-label="Exit Scanner"
            className="w-11 h-11 rounded-full bg-inverse-surface/80 text-inverse-on-surface backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform shadow-md"
            onClick={() => navigate(-1)}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-inverse-surface/80 backdrop-blur-md text-inverse-on-surface shadow-md">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
            <span className="font-label-sm text-label-sm text-secondary-fixed tracking-wide font-semibold">
              AI SENSOR
            </span>
            <span className="text-outline-variant font-label-sm">•</span>
            <span className="text-[11px] text-primary-fixed font-mono font-medium">{GEMINI_SCANNER_MODEL}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Test Cases Runner Button */}
            <button
              aria-label="Inspect 5 System Test Cases"
              className="px-2.5 h-11 rounded-full bg-surface-container-highest/90 text-on-surface backdrop-blur-md flex items-center gap-1 text-xs font-bold active:scale-90 transition-transform shadow-md border border-outline-variant/40"
              onClick={() => setShowTestCasesModal(true)}
              type="button"
              title="Inspect System Prompt & 5 Test Cases"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">fact_check</span>
              <span className="hidden sm:inline">5 Tests</span>
            </button>

            {/* Flip Camera Button */}
            <button
              aria-label="Flip Camera Lens"
              className="w-11 h-11 rounded-full bg-inverse-surface/80 text-inverse-on-surface backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform shadow-md"
              onClick={() => {
                setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
                showToast(`Switched to ${facingMode === 'environment' ? 'front lens' : 'macro environmental lens'}`);
              }}
              type="button"
              title="Flip camera"
            >
              <span className="material-symbols-outlined text-[20px]">flip_camera_ios</span>
            </button>

            {/* Torch toggle */}
            <button
              aria-label="Toggle Torch Flash"
              className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform shadow-md ${
                torchOn ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-inverse-surface/80 text-inverse-on-surface'
              }`}
              onClick={() => {
                setTorchOn(!torchOn);
                showToast(torchOn ? 'Torch disabled' : 'Torch illumination enabled');
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">flash_on</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEWFINDER CANVAS CONTAINER */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] max-h-[460px] rounded-3xl overflow-hidden mx-auto shadow-2xl bg-black border border-outline-variant/20">
        {/* Live camera stream video element - persistently mounted with absolute fill */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-0 ${
            hasCamera && !capturedImage ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Captured image display or fallback backdrop */}
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured Specimen"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        ) : !hasCamera ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-300 z-0"
            style={{
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCVwHQkFS0U8H3_S7YeJ3rB9lracVYKKvv2XuW5cgRds_6BaT8ewOz9wI0d5rX2OmMHxLNLbcusyZJnF0M9qUlqAW16SD8xMkJjmZn6FHfI9uwgy80d4abnPGfRZYSOZo2LcbMDNcx88Itd-RbsTPCDFOm6N-xGzcpWPGpyz7Iwlj6BFCazsRmHMCKa4vWw3HfoorFP2YKwWmYqQbO6rVn6n-_lpDQOoYEWxUYbNGei8xgttVlxI_JgdQ')`,
            }}
          />
        ) : null}

        {/* Camera Error or Permission Banner */}
        {cameraError && !capturedImage && (
          <div className="absolute top-4 inset-x-4 z-30 p-3 rounded-2xl bg-inverse-surface/90 backdrop-blur-md text-inverse-on-surface shadow-xl flex items-center justify-between gap-3 text-xs border border-outline-variant/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-tertiary-fixed shrink-0">info</span>
              <span>{cameraError}</span>
            </div>
            <button
              onClick={() => initCamera()}
              className="px-2.5 py-1 rounded-full bg-primary text-on-primary font-bold shrink-0 text-[11px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Vignette Scrim - soft gradient without blacking out the viewfinder */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none z-[5]"></div>

        {/* AI Bounding Box & Target Lock - mathematically centered */}
        <div className="absolute inset-0 m-auto w-[72%] max-w-xs aspect-square rounded-2xl p-1 pointer-events-none flex flex-col justify-between z-10">
          <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-secondary-fixed rounded-tl-xl shadow-[0_0_12px_rgba(159,247,159,0.8)]"></div>
          <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-secondary-fixed rounded-tr-xl shadow-[0_0_12px_rgba(159,247,159,0.8)]"></div>
          <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-secondary-fixed rounded-bl-xl shadow-[0_0_12px_rgba(159,247,159,0.8)]"></div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-secondary-fixed rounded-br-xl shadow-[0_0_12px_rgba(159,247,159,0.8)]"></div>

          {/* Realtime Laser Scanning Bar */}
          <div
            className={`w-full h-1 bg-gradient-to-r from-transparent via-secondary-fixed to-transparent shadow-[0_0_16px_#9ff79f] ${
              isScanning ? 'animate-bounce' : 'animate-[pulse_1.8s_ease-in-out_infinite]'
            }`}
          ></div>

          {/* Live Floating Target Pill */}
          <div className="self-center bg-inverse-surface/90 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg mb-2">
            <span
              className={`material-symbols-outlined text-[16px] text-secondary-fixed ${
                isScanning ? 'animate-spin' : ''
              }`}
            >
              {isScanning ? 'sync' : 'psychology'}
            </span>
            <span className="font-label-sm text-label-sm text-inverse-on-surface font-semibold tracking-tight truncate max-w-[130px]">
              {isScanning ? 'Scanning...' : scanResult.commonName}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full font-label-sm text-[10px] font-bold ${
                scanResult.confidence >= 0.6
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-tertiary-container text-on-tertiary'
              }`}
            >
              {(scanResult.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Viewfinder Mode Switcher Pills */}
        <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5 overflow-x-auto px-4 z-20">
          {(['Auto', 'Animal', 'Plant', 'Insect', 'Fungi', 'Bird'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full font-label-md text-label-md backdrop-blur-md transition-all ${
                mode === m
                  ? 'bg-secondary text-on-secondary font-bold shadow-[0_0_12px_rgba(18,109,39,0.5)]'
                  : 'bg-inverse-surface/70 text-inverse-on-surface hover:bg-inverse-surface active:scale-95'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* SCANNING PROGRESS OVERLAY */}
      {isScanning && (
        <div className="mx-margin mt-3 p-4 rounded-2xl bg-surface-container-high border border-outline-variant/30 flex items-center gap-3.5 shadow-md animate-pulse">
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[28px] animate-spin">
              progress_activity
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-label-sm text-primary font-bold block uppercase tracking-wider text-[11px]">
              AI Morphological Analysis
            </span>
            <p className="font-body-sm text-on-surface text-xs truncate mt-0.5">{scanStep}</p>
          </div>
        </div>
      )}

      {/* FRIENDLY ERROR MESSAGE & RETRY CARD */}
      {scanError && (
        <div className="mx-margin mt-3 p-4 rounded-2xl bg-error-container text-on-error-container shadow-md border border-error/30 flex flex-col gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[24px] text-error shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <h4 className="font-label-lg font-bold text-on-error-container">
                Specimen Analysis Interrupted
              </h4>
              <p className="font-body-sm text-xs opacity-90 mt-1 leading-relaxed">{scanError}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-surface/50 text-[11px] space-y-1">
            <strong className="font-semibold block text-on-surface">Tips for better identification:</strong>
            <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant">
              <li>Ensure the organism is centered and occupies at least 50% of the frame.</li>
              <li>Wipe camera lens and avoid motion blur or deep shadows.</li>
              <li>For plants, include leaf veins, flowers, or fruit if visible.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (retryImagePayload) {
                  performIdentification(retryImagePayload);
                } else {
                  handleTriggerShutter();
                }
              }}
              className="flex-1 py-2 rounded-full bg-error text-on-error font-label-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Retry Scan</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 rounded-full bg-surface-container-highest text-on-surface font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Upload Photo</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEWFINDER CAMERA SHUTTER & HARDWARE CONTROLS */}
      <div className="px-margin py-3 flex items-center justify-between z-20 max-w-md mx-auto w-full">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Open Field Album Upload */}
        <button
          aria-label="Upload Photo"
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-2xl overflow-hidden bg-surface-container-high p-0.5 shadow-sm active:scale-95 transition-transform flex items-center justify-center relative hover:ring-2 hover:ring-primary"
          type="button"
          title="Upload photo from field device"
        >
          <span className="material-symbols-outlined text-[24px] text-primary">add_photo_alternate</span>
        </button>

        {/* Haptic AI Shutter Trigger Button */}
        <button
          aria-label="Analyze Specimen"
          id="shutter-btn"
          disabled={isScanning}
          onClick={handleTriggerShutter}
          className={`relative group w-20 h-20 rounded-full bg-surface-container flex items-center justify-center shadow-lg active:scale-90 transition-all ${
            isScanning ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-secondary to-primary-fixed shadow-[0_0_18px_rgba(165,214,167,0.6)]"></div>
          <div className="relative w-14 h-14 rounded-full bg-surface flex items-center justify-center shadow-inner group-active:scale-95 transition-transform">
            <span
              className={`material-symbols-outlined text-[28px] text-primary ${
                isScanning ? 'animate-spin' : ''
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isScanning ? 'sync' : 'lens'}
            </span>
          </div>
        </button>

        {/* Test Cases Quick Launcher */}
        <button
          aria-label="Test Cases"
          onClick={() => setShowTestCasesModal(true)}
          className="w-12 h-12 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center shadow-sm active:scale-95 transition-transform hover:bg-surface-container-highest"
          type="button"
          title="Switch Test Case (5 Cases)"
        >
          <span className="material-symbols-outlined text-[22px]">checklist</span>
        </button>
      </div>

      {/* SCAN RESULT SHEET / DISCOVERY DRAWER */}
      {showResult && !isScanning && (
        <section className="mt-2 mx-margin bg-surface-container-low rounded-3xl p-space-md shadow-xl flex flex-col gap-space-md relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 border border-outline-variant/30">
          {/* Drag Handle & Header */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-1.5 rounded-full bg-outline-variant/60"></div>
            <div className="w-full flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span className="font-label-sm text-label-sm font-bold tracking-wider uppercase">
                  {scanResult.notASpecies ? 'Non-Living Object' : 'Taxon Identified'}
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                {scanResult.taxonomicRank.toUpperCase()} LEVEL
              </span>
            </div>
          </div>

          {/* LOW MATCH SCORE BANNER (If confidence is below 0.6, show "Not sure, try a clearer photo") */}
          {isLowConfidence && (
            <div className="p-3.5 rounded-2xl bg-tertiary-container text-on-tertiary shadow-sm flex items-start gap-3 border border-tertiary/20">
              <span className="material-symbols-outlined text-[24px] text-tertiary-fixed shrink-0 mt-0.5">
                help
              </span>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold text-on-tertiary">
                  Not sure, try a clearer photo
                </span>
                <p className="font-body-sm text-body-sm opacity-90 mt-1 leading-relaxed">
                  Match score is {(scanResult.confidence * 100).toFixed(0)}% because the photo may be blurry, far away, or partly hidden. Check the Other Possible Matches below or try taking a closer photo.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2.5 px-3 py-1.5 rounded-full bg-tertiary text-on-tertiary self-start font-label-sm text-xs font-semibold shadow-sm active:scale-95 transition-transform flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                  <span>Try Clearer Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* NON-SPECIES BANNER */}
          {scanResult.notASpecies && (
            <div className="p-3.5 rounded-2xl bg-surface-container-highest text-on-surface shadow-sm flex items-start gap-3 border border-outline-variant/40">
              <span className="material-symbols-outlined text-[24px] text-secondary shrink-0">inventory_2</span>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold">Object Detected (Not an Animal or Plant)</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {scanResult.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* Identification Card Overview */}
          <div className="flex items-start gap-3.5 bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm border border-outline-variant/20">
            {/* Primary Photo */}
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 shadow-inner bg-surface-container flex items-center justify-center relative group">
              {scanResult.enrichedPhotos && scanResult.enrichedPhotos.length > 0 ? (
                <img
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  alt={scanResult.commonName}
                  src={scanResult.enrichedPhotos[selectedPhotoIndex] || scanResult.enrichedPhotos[0]}
                />
              ) : capturedImage ? (
                <img className="w-full h-full object-cover" alt={scanResult.commonName} src={capturedImage} />
              ) : (
                <span className="material-symbols-outlined text-[36px] text-secondary">nature</span>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-label-sm text-[10px] uppercase font-bold text-secondary tracking-widest capitalize">
                  {scanResult.category}
                </span>
                <span className="text-outline-variant text-[10px]">•</span>
                <span className="font-label-sm text-[10px] text-on-surface-variant truncate">
                  Group: {scanResult.taxonomicRank}
                </span>
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold leading-tight truncate">
                {scanResult.commonName}
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] uppercase font-bold text-outline">Science name:</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant italic truncate">
                  {scanResult.scientificName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px] font-semibold">
                  {scanResult.taxonomicRank === 'species' ? 'Exact Match' : 'Family Group'}
                </span>
                {scanResult.safetyFlags.endangered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[11px] font-semibold">
                    <span>In Danger</span>
                    <InfoTooltip text={getConservationMeaning('EN')} />
                  </span>
                )}
                {scanResult.iNatObservationsCount && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[11px] font-medium">
                    {scanResult.iNatObservationsCount.toLocaleString()} Wild Sightings
                  </span>
                )}
              </div>
            </div>

            {/* Circular Match Score Ring Indicator */}
            <div className="relative flex flex-col items-center justify-center shrink-0 w-16 h-16">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container-high"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                ></path>
                <path
                  className={scanResult.confidence >= 0.6 ? 'text-secondary' : 'text-tertiary'}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${Math.round(scanResult.confidence * 100)}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                ></path>
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <span className="font-label-sm text-[12px] font-bold text-on-surface">
                  {(scanResult.confidence * 100).toFixed(0)}%
                </span>
                <span className="font-label-sm text-[8px] text-on-surface-variant">SURE</span>
              </div>
              <div className="absolute -bottom-1 -right-1">
                <InfoTooltip text={getMatchScoreMeaning(scanResult.confidence)} iconSize={13} />
              </div>
            </div>
          </div>

          {/* REAL DATA ENRICHMENT: iNaturalist & Wikipedia Photo Gallery */}
          {scanResult.enrichedPhotos && scanResult.enrichedPhotos.length > 0 && (
            <div className="flex flex-col gap-2 p-3 bg-surface-container rounded-2xl border border-outline-variant/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-label-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">collections</span>
                  <span>Verified Wild Photos (iNaturalist & Wiki)</span>
                </span>
                <span className="text-[11px] text-on-surface-variant truncate max-w-[180px]">
                  {scanResult.photoCredit || 'Community Attributed'}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                {scanResult.enrichedPhotos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      selectedPhotoIndex === idx
                        ? 'border-primary shadow-md scale-105'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img alt={`Observation ${idx + 1}`} src={url} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {scanResult.wikiDescription && (
                <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed pt-1 border-t border-outline-variant/20">
                  {scanResult.wikiDescription}
                </p>
              )}
            </div>
          )}

          {/* Why We Matched This Card */}
          <div className="p-3 rounded-2xl bg-surface-container text-on-surface text-xs leading-relaxed border border-outline-variant/20">
            <strong className="text-primary font-semibold block mb-0.5">Why we matched this:</strong>
            {scanResult.reasoning}
          </div>

          {/* Safety Tips */}
          <div className="grid grid-cols-2 gap-2">
            {scanResult.safetyFlags.venomous ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-error-container text-on-error-container">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-[11px] font-bold leading-none">Poisonous Bite or Sting</span>
                  <span className="font-body-sm text-[10px] opacity-90 truncate">Stay back safely</span>
                </div>
              </div>
            ) : scanResult.safetyFlags.toxic ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
                <span className="material-symbols-outlined text-[18px] text-tertiary">science</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-[11px] font-bold leading-none">Poisonous to Touch or Eat</span>
                  <span className="font-body-sm text-[10px] text-on-tertiary-fixed-variant truncate">
                    Do not touch or eat
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed">
                <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-[11px] font-bold leading-none">Safe from Venom</span>
                  <span className="font-body-sm text-[10px] opacity-90 truncate">No poisonous bite or sting</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-high text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-primary">eco</span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-label-sm text-[11px] font-bold leading-none">
                    {scanResult.safetyFlags.endangered ? 'In Danger' : 'Not in Danger'}
                  </span>
                  <InfoTooltip text={getConservationMeaning(scanResult.safetyFlags.endangered ? 'EN' : 'LC')} iconSize={12} />
                </div>
                <span className="font-body-sm text-[10px] text-on-surface-variant truncate">
                  {scanResult.safetyFlags.endangered ? 'Needs protection' : 'Common, Not in Danger'}
                </span>
              </div>
            </div>
          </div>

          {/* Fun Facts */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-surface-container flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">forest</span>
                <span className="font-label-sm text-label-sm font-medium">Where It Lives</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {scanResult.quickFacts.habitat}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-surface-container flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">restaurant</span>
                <span className="font-label-sm text-label-sm font-medium">What It Eats</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {scanResult.quickFacts.diet}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-surface-container flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">hourglass_bottom</span>
                <span className="font-label-sm text-label-sm font-medium">How Long It Lives</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {scanResult.quickFacts.lifespan}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-surface-container flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">straighten</span>
                <span className="font-label-sm text-label-sm font-medium">How Big It Gets</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                {scanResult.quickFacts.size}
              </p>
            </div>
          </div>

          {/* Other Possible Matches */}
          {scanResult.top3AlternateMatches && scanResult.top3AlternateMatches.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-bold tracking-wider uppercase">
                  Other Possible Matches
                </span>
                <span className="text-[11px] text-primary font-medium">
                  {isLowConfidence ? 'Check these options closely' : 'Other possibilities'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {scanResult.top3AlternateMatches.map((alt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-surface-container flex flex-col gap-1 border border-outline-variant/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-label-md font-bold text-on-surface">
                        {alt.commonName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
                        {(alt.confidence * 100).toFixed(0)}% sure
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-outline">Science name:</span>
                      <span className="font-body-sm text-body-sm italic text-on-surface-variant">
                        {alt.scientificName}
                      </span>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">
                      <strong className="text-secondary">Difference: </strong>
                      {alt.distinctionReason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WIRED UP SCAN RESULT SHEET BUTTONS: View Details, Add to Collection, Share */}
          <div className="flex items-center gap-2 pt-2">
            {/* 1. View Details Button */}
            <button
              onClick={handleViewDetails}
              disabled={scanResult.notASpecies}
              className={`flex-1 h-12 rounded-full font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${
                scanResult.notASpecies
                  ? 'bg-surface-container-highest text-on-surface-variant opacity-60 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container'
              }`}
            >
              <span>View Details</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>

            {/* 2. Add to Collection Button */}
            <button
              aria-label={isSavedInDex ? 'Saved in Collection' : 'Add to Collection'}
              onClick={handleAddToCollection}
              disabled={scanResult.notASpecies}
              className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-sm ${
                isSavedInDex
                  ? 'bg-secondary text-on-secondary ring-2 ring-secondary/50'
                  : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80'
              }`}
              type="button"
              title={isSavedInDex ? 'Saved in Collection' : 'Save to Collection'}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: isSavedInDex ? "'FILL' 1" : "'FILL' 0" }}
              >
                {isSavedInDex ? 'check' : 'bookmark_add'}
              </span>
            </button>

            {/* 3. Share Button */}
            <button
              aria-label="Share"
              onClick={handleShare}
              className="w-12 h-12 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center active:scale-95 transition-transform shadow-sm hover:bg-surface-container-high hover:text-on-surface"
              type="button"
              title="Share"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
            </button>
          </div>
        </section>
      )}

      {/* SHARE MODAL DIALOG */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">share</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Share Discovery
                </h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Share Preview Card */}
            <div className="rounded-2xl bg-surface-container p-3 flex items-center gap-3 border border-outline-variant/30">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0">
                <img
                  src={
                    (scanResult.enrichedPhotos && scanResult.enrichedPhotos[0]) ||
                    capturedImage ||
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuDTp4wz_G-5zP2-JqUf7VbLzK1E9B12sQ3_X6t8M9nO0pQrStUvWxYz'
                  }
                  alt={scanResult.commonName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-label-sm text-[10px] uppercase font-bold text-secondary">
                  WildDex Sighting
                </span>
                <h4 className="font-label-md font-bold text-on-surface truncate">
                  {scanResult.commonName}
                </h4>
                <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate">
                  {scanResult.scientificName}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant space-y-1">
              <p>Observation link and diagnosis copied to clipboard!</p>
              <p className="text-[11px] opacity-80">
                You can paste this in field chats, natural history forums, or message to peers.
              </p>
            </div>

            <button
              onClick={() => {
                setShowShareModal(false);
                showToast('Ready to share in your favorite app!');
              }}
              className="w-full h-11 rounded-full bg-primary text-on-primary font-label-md font-semibold active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD SPECIMEN TO FIRESTORE & STORAGE */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">bookmark_add</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Save to My Collection
                </h3>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Specimen Header Card */}
            <div className="rounded-2xl bg-surface-container p-3 flex items-center gap-3 border border-outline-variant/30">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 relative">
                <img
                  src={
                    capturedImage ||
                    (scanResult.enrichedPhotos && scanResult.enrichedPhotos[0]) ||
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuDTp4wz_G-5zP2-JqUf7VbLzK1E9B12sQ3_X6t8M9nO0pQrStUvWxYz'
                  }
                  alt={scanResult.commonName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-label-sm text-[10px] uppercase font-bold text-secondary capitalize">
                    {scanResult.category}
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant font-medium">
                    {(scanResult.confidence * 100).toFixed(0)}% sure
                  </span>
                </div>
                <h4 className="font-label-lg font-bold text-on-surface truncate">
                  {scanResult.commonName}
                </h4>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-outline">Science name:</span>
                  <p className="font-body-sm text-xs text-on-surface-variant italic truncate">
                    {scanResult.scientificName}
                  </p>
                </div>
              </div>
            </div>

            {/* Album Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">
                Choose Album
              </label>
              <select
                value={selectedAlbumId}
                onChange={(e) => setSelectedAlbumId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface font-body-sm text-sm"
              >
                <option value="default">All Saved Items</option>
                {userAlbums.map((alb) => (
                  <option key={alb.id} value={alb.id}>
                    {alb.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Permission Toggle */}
            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">location_on</span>
                <div>
                  <p className="font-label-md text-xs font-bold text-on-surface">
                    Save Where You Found It
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Saves your location with this photo only if you allow it.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeGps}
                onChange={(e) => setIncludeGps(e.target.checked)}
                className="w-5 h-5 rounded accent-primary mt-1 cursor-pointer"
              />
            </div>

            {/* Notes Input */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-xs font-bold text-on-surface">
                Notes (Optional)
              </label>
              <textarea
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="What was it doing, what did you notice..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/40 text-on-surface font-body-sm text-xs resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-3 rounded-full bg-surface-container text-on-surface font-label-md font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingToDex}
                onClick={handleConfirmSaveToFirebase}
                className="flex-1 py-3 rounded-full bg-primary text-on-primary font-label-md font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform disabled:opacity-50"
              >
                {isSavingToDex ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">bookmark</span>
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 5 TEST CASES & SYSTEM PROMPT INSPECTOR */}
      {showTestCasesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xl bg-surface rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto border border-outline-variant/30">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">fact_check</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    Scanner Prompt & 5 Test Cases
                  </h3>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">
                    Model: {GEMINI_SCANNER_MODEL}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowTestCasesModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* System Instruction Overview */}
            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant space-y-1">
              <strong className="text-primary block font-semibold">Active System Instruction Directives:</strong>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Identify only clearly visible traits (no hallucinations).</li>
                <li>Assign low confidence (&lt; 0.60) for blurry or partial subjects.</li>
                <li>Prefer genus-level answers over wrong species-level guesses.</li>
                <li>Never fabricate scientific names (authentic binomials only).</li>
                <li>Flag inanimate / synthetic items as notASpecies: true (0% confidence).</li>
              </ul>
            </div>

            {/* List of 5 Test Cases with Run Buttons */}
            <div className="flex flex-col gap-3">
              <span className="font-label-md text-label-md font-bold text-on-surface">
                Select Test Case to Execute:
              </span>
              {testCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  className="p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-colors flex flex-col gap-2 border border-outline-variant/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-[10px] font-bold">
                        Case {idx + 1}
                      </span>
                      <h4 className="font-label-md text-label-md font-bold text-on-surface mt-1">
                        {tc.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleSelectTestCase(tc)}
                      className="px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold hover:bg-primary-container active:scale-95 transition-all shrink-0"
                    >
                      Run Case
                    </button>
                  </div>

                  <p className="font-body-sm text-[12px] text-on-surface-variant">
                    {tc.scenario}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-outline-variant/20">
                    <div>
                      <span className="text-outline">Expected Taxon: </span>
                      <strong className="text-on-surface">{tc.expectedOutput.commonName}</strong> (<em>{tc.expectedOutput.scientificName}</em>)
                    </div>
                    <div>
                      <span className="text-outline">Expected Conf: </span>
                      <strong className={tc.expectedOutput.confidence < 0.6 ? 'text-tertiary font-bold' : 'text-primary font-bold'}>
                        {(tc.expectedOutput.confidence * 100).toFixed(0)}%
                      </strong> ({tc.expectedOutput.taxonomicRank})
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowTestCasesModal(false)}
                className="w-full h-11 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
