import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('English');
  const [offlineDownloaded, setOfflineDownloaded] = useState(true);
  const [obfuscateGps, setObfuscateGps] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      showToast('Dark mode enabled');
    } else {
      document.documentElement.classList.remove('dark');
      showToast('Light mode restored');
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

      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="font-headline-sm text-headline-sm text-primary font-bold">Settings & Extras</span>
        <div className="w-10"></div>
      </div>

      {/* Appearance Section */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Appearance & Language</h2>

        {/* Dark Mode */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">dark_mode</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Dark Mode</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Optimal for nocturnal field observations</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${darkMode ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </button>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between py-1 border-t border-outline-variant/20 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">translate</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Science Names</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Science names stay in Latin</p>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              showToast(`Language switched to ${e.target.value}`);
            }}
            className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold focus:outline-none"
          >
            <option>English</option>
            <option>Español</option>
            <option>Français</option>
            <option>Deutsch</option>
            <option>日本語</option>
          </select>
        </div>
      </div>

      {/* Offline & Storage Management */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Offline & Cache</h2>

        {/* Regional Pack */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">download_for_offline</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Pacific Northwest Pack</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">120 MB • 3,200 species offline</p>
            </div>
          </div>
          <button
            onClick={() => {
              setOfflineDownloaded(!offlineDownloaded);
              showToast(offlineDownloaded ? 'Offline pack removed' : 'Downloaded PNW offline pack');
            }}
            className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm font-semibold transition-all ${
              offlineDownloaded ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface'
            }`}
          >
            {offlineDownloaded ? 'Installed' : 'Download'}
          </button>
        </div>

        {/* Clear Cache */}
        <div className="flex items-center justify-between py-1 border-t border-outline-variant/20 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">cleaning_services</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Temporary Image Cache</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">34.2 MB cached locally</p>
            </div>
          </div>
          <button
            onClick={() => showToast('Image cache cleared (34.2 MB freed)')}
            className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Privacy & Safety Controls */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Field Privacy & Safety</h2>

        {/* Fuzz Rare GPS */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Protect Rare Species Locations</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Hide exact spot for species in danger</p>
            </div>
          </div>
          <button
            onClick={() => {
              setObfuscateGps(!obfuscateGps);
              showToast(obfuscateGps ? 'Exact location sharing turned on' : 'Location hiding turned on for rare species');
            }}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${obfuscateGps ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${obfuscateGps ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </button>
        </div>

        {/* Public Profile */}
        <div className="flex items-center justify-between py-1 border-t border-outline-variant/20 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">Public Profile Visibility</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Allow other naturalists to discover you</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPublicProfile(!publicProfile);
              showToast(publicProfile ? 'Profile set to private' : 'Profile is now public');
            }}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${publicProfile ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${publicProfile ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </button>
        </div>
      </div>

      {/* Account & Data Management */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Account & Data</h2>

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="font-label-md text-label-md font-bold text-on-surface">Google Sign-In Active</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">bodduharshavardhan41@gmail.com</p>
          </div>
          <span className="material-symbols-outlined text-secondary">verified_user</span>
        </div>

        <button
          onClick={() => showToast('Exporting saved items to JSON file...')}
          className="w-full h-11 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-highest"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>Export Saved Items (JSON)</span>
        </button>

        <Link
          to="/onboarding"
          className="w-full h-11 rounded-full bg-surface-container text-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">menu_book</span>
          <span>Replay Welcome Tour</span>
        </Link>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full h-11 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-bold flex items-center justify-center gap-2 mt-2"
        >
          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
          <span>Delete Account & Saved Items</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-surface-container p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Delete Account & Data?</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                This cannot be undone. All saved items, notes, and photo albums will be deleted permanently.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 h-11 rounded-full bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  showToast('Account data deletion request processed');
                }}
                className="flex-1 h-11 rounded-full bg-error text-on-error font-label-md text-label-md font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
