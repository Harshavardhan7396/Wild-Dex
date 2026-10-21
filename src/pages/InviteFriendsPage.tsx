import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const InviteFriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const inviteLink = 'https://wilddex.app/join/maya-pnw-782';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast('Unique invite link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Explore Nature With Me on WildDex',
          text: 'Discover plants and animals with me on WildDex!',
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="flex flex-col w-full px-margin pb-12 pt-2 space-y-space-md">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="font-headline-sm text-headline-sm text-primary font-bold">Invite Friends</span>
        <div className="w-10"></div>
      </div>

      {/* Hero Invitation Banner */}
      <div className="p-space-md rounded-2xl bg-surface-container-high shadow-sm flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shadow-sm">
          <span className="material-symbols-outlined text-[32px]">group_add</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">
            Invite Friends
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mt-1">
            Invite friends to explore nature with you, share your discoveries, and complete fun challenges together.
          </p>
        </div>
      </div>

      {/* Tactile QR Code Card */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col items-center gap-4">
        <div className="p-4 rounded-2xl bg-white shadow-inner flex flex-col items-center justify-center">
          {/* Simulated QR Code with SVG */}
          <svg className="w-44 h-44 text-primary" viewBox="0 0 100 100" fill="currentColor">
            {/* Top Left Marker */}
            <rect x="5" y="5" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="13" y="13" width="12" height="12" rx="2" fill="currentColor" />
            {/* Top Right Marker */}
            <rect x="67" y="5" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="75" y="13" width="12" height="12" rx="2" fill="currentColor" />
            {/* Bottom Left Marker */}
            <rect x="5" y="67" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="13" y="75" width="12" height="12" rx="2" fill="currentColor" />
            {/* Field Matrix Patterns */}
            <rect x="40" y="8" width="6" height="6" />
            <rect x="50" y="16" width="6" height="12" />
            <rect x="40" y="24" width="8" height="6" />
            <rect x="8" y="42" width="16" height="6" />
            <rect x="30" y="40" width="8" height="8" />
            <rect x="44" y="44" width="12" height="12" />
            <rect x="62" y="38" width="8" height="6" />
            <rect x="76" y="44" width="16" height="8" />
            <rect x="40" y="64" width="6" height="16" />
            <rect x="52" y="68" width="14" height="6" />
            <rect x="70" y="62" width="6" height="8" />
            <rect x="82" y="76" width="10" height="10" />
            <rect x="58" y="82" width="12" height="6" />
          </svg>
          <div className="flex items-center gap-1.5 mt-2 text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[15px] text-secondary">qr_code_scanner</span>
            <span>Scan in field for instant squad pairing</span>
          </div>
        </div>

        {/* Link Box */}
        <div className="w-full flex items-center gap-2 p-2 rounded-xl bg-surface-container">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="flex-1 bg-transparent px-2 font-body-sm text-body-sm text-on-surface-variant truncate focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm font-semibold transition-all shrink-0 ${
              copied
                ? 'bg-secondary text-on-secondary'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* Web Share API Action */}
        <button
          onClick={handleWebShare}
          className="w-full h-12 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">share</span>
          <span>Share via Messenger, Email, or Airdrop</span>
        </button>
      </div>

      {/* Referral Milestone Rewards */}
      <div className="p-space-md rounded-2xl bg-tertiary-container/15 text-tertiary flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-label-md text-label-md font-bold">
            <span className="material-symbols-outlined text-[20px]">military_tech</span>
            <span>Squad Bonus Progress</span>
          </div>
          <span className="font-label-sm text-label-sm bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full font-bold">
            2 / 3 Naturalists
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Invite 1 more friend to unlock the <strong>Trail Pioneer Badge</strong> and offline 3D LiDAR terrain scans.
        </p>
      </div>

      {/* Friends Already Joined */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Your Joined Circle (2)</h3>
        <div className="flex items-center justify-between py-1 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5">
            <img
              alt="Leo Brooks"
              className="w-10 h-10 rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ"
            />
            <div>
              <p className="font-label-md text-label-md font-bold text-on-surface">Leo Brooks</p>
              <p className="font-body-sm text-[11px] text-on-surface-variant">Joined via QR • 42 species logged</p>
            </div>
          </div>
          <span className="font-label-sm text-[11px] text-secondary font-bold">Active now</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <img
              alt="Dr. Aris"
              className="w-10 h-10 rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ"
            />
            <div>
              <p className="font-label-md text-label-md font-bold text-on-surface">Dr. Aris Thorne</p>
              <p className="font-body-sm text-[11px] text-on-surface-variant">Joined via Invite Link • 89 species logged</p>
            </div>
          </div>
          <span className="font-label-sm text-[11px] text-on-surface-variant">2h ago</span>
        </div>
      </div>
    </div>
  );
};
