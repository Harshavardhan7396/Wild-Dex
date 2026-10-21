import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CURATED_SPECIES } from '../services/speciesService';

export const SharedCollectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'Editor' | 'Viewer'>('Editor');
  const [toast, setToast] = useState<string | null>(null);

  const [collaborators, setCollaborators] = useState([
    {
      name: 'Maya Brooks',
      role: 'Owner',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ',
      contributions: 24,
    },
    {
      name: 'Leo Brooks',
      role: 'Editor',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ',
      contributions: 16,
    },
    {
      name: 'Dr. Aris Thorne',
      role: 'Editor',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ',
      contributions: 8,
    },
    {
      name: 'Chloe Rivera',
      role: 'Viewer',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ',
      contributions: 0,
    },
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const name = newEmail.split('@')[0];
    setCollaborators((prev) => [
      ...prev,
      {
        name,
        role: newRole,
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ',
        contributions: 0,
      },
    ]);
    setShowAddModal(false);
    setNewEmail('');
    showToast(`Invited ${name} as ${newRole}!`);
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
        <span className="font-headline-sm text-headline-sm text-primary font-bold">Shared Album</span>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center hover:bg-secondary-container/80 transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">person_add</span>
        </button>
      </div>

      {/* Album Title Card */}
      <div className="p-space-md rounded-2xl bg-surface-container-high shadow-sm flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-secondary">
              <span className="material-symbols-outlined text-[16px]">folder_shared</span>
              <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider">
                Shared Collection
              </span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold mt-0.5">
              Olympic Rainforest 2026
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Plants and animals found around the Hoh, Bogachiel, and Quinault rivers.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
            48 Saved
          </span>
        </div>

        {/* Collaborators Strip */}
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
          <div className="flex items-center -space-x-2">
            {collaborators.map((c, i) => (
              <img
                key={i}
                alt={c.name}
                src={c.avatar}
                title={`${c.name} (${c.role})`}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-surface shadow-sm"
              />
            ))}
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-xs ring-2 ring-surface hover:bg-surface-container"
            >
              +
            </button>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {collaborators.length} Members
          </span>
        </div>
      </div>

      {/* Member Management Drawer */}
      <div className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-2.5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Team Members</h3>
        {collaborators.map((c, idx) => (
          <div key={idx} className="flex items-center justify-between py-1.5 border-b border-outline-variant/20 last:border-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img alt={c.name} src={c.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="truncate">
                <p className="font-label-md text-label-md font-bold text-on-surface truncate">{c.name}</p>
                <p className="font-body-sm text-[11px] text-on-surface-variant">{c.contributions} items saved</p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold ${
                c.role === 'Owner'
                  ? 'bg-primary text-on-primary'
                  : c.role === 'Editor'
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {c.role}
            </span>
          </div>
        ))}
      </div>

      {/* Shared Specimens Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Shared Items</h3>
          <span className="font-label-sm text-label-sm text-secondary font-semibold">Synced</span>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          {CURATED_SPECIES.slice(0, 4).map((sp, i) => (
            <Link
              key={sp.id}
              to={`/species/${sp.id}`}
              className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-all group"
            >
              <div className="relative w-full aspect-square bg-surface-container">
                <img alt={sp.commonName} src={sp.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-surface-container-lowest font-medium">
                  {i === 0 ? 'Saved by Leo' : i === 1 ? 'Saved by Dr. Thorne' : 'Saved by Maya'}
                </span>
              </div>
              <div className="p-2.5">
                <h4 className="font-label-md text-label-md font-bold text-on-surface truncate">{sp.commonName}</h4>
                <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  <span className="text-[10px] text-on-surface-variant/70 mr-1">Science name:</span>
                  <span className="italic">{sp.scientificName}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Add Collaborator Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCollaborator}
            className="w-full max-w-sm rounded-3xl bg-surface-container p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Add Member</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Invite a friend to this album. You can choose what they can do.
            </p>

            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">Friend's Email</label>
              <input
                type="email"
                required
                placeholder="colleague@botany.org"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container-lowest text-on-surface font-body-md text-body-md shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface font-semibold">Access Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewRole('Editor')}
                  className={`p-2.5 rounded-xl font-label-md text-label-md text-left transition-all ${
                    newRole === 'Editor'
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  <p>Editor</p>
                  <span className="text-[10px] opacity-80 block">Can add & calibrate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('Viewer')}
                  className={`p-2.5 rounded-xl font-label-md text-label-md text-left transition-all ${
                    newRole === 'Viewer'
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  <p>Viewer</p>
                  <span className="text-[10px] opacity-80 block">Read-only field log</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-full bg-primary text-on-primary font-label-lg text-label-lg font-bold shadow-md active:scale-95 transition-all mt-2"
            >
              Send Field Invitation
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
