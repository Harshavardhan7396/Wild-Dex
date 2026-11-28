import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ASK_CATEGORIES,
  AskCategory,
  AskQuestion,
  createAskQuestion,
  updateAskQuestion,
} from '../../services/askService';
import { containsExactCoordinates } from '../../services/communityService';
import { AskSafetyNotice } from './AskSafetyNotice';

export interface AskQuestionPrefill {
  photoSourceUrl?: string;
  title?: string;
  category?: AskCategory;
  description?: string;
  placeLabel?: string;
}

interface AskQuestionFormModalProps {
  isOpen: boolean;
  questionToEdit: AskQuestion | null;
  prefill?: AskQuestionPrefill | null;
  onClose: () => void;
  onSaved: (question: AskQuestion, mode: 'create' | 'edit') => void;
}

export const AskQuestionFormModal: React.FC<AskQuestionFormModalProps> = ({
  isOpen,
  questionToEdit,
  prefill = null,
  onClose,
  onSaved,
}) => {
  const navigate = useNavigate();
  const isEditing = Boolean(questionToEdit);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [prefillPhotoUrl, setPrefillPhotoUrl] = useState<string>('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AskCategory>('animal');
  const [placeLabel, setPlaceLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSubmitting(false);

    if (questionToEdit) {
      setPhotoFile(null);
      setPrefillPhotoUrl('');
      setPhotoPreviewUrl(questionToEdit.photoUrl || '');
      setTitle(questionToEdit.title || '');
      setDescription(questionToEdit.description || '');
      setCategory(questionToEdit.category || 'animal');
      setPlaceLabel(questionToEdit.placeLabel || '');
    } else if (prefill) {
      setPhotoFile(null);
      const nextPhoto = prefill.photoSourceUrl || '';
      setPrefillPhotoUrl(nextPhoto);
      setPhotoPreviewUrl(nextPhoto);
      setTitle(prefill.title || '');
      setDescription(prefill.description || '');
      setCategory(prefill.category || 'animal');
      setPlaceLabel(prefill.placeLabel || '');
    } else {
      setPhotoFile(null);
      setPrefillPhotoUrl('');
      setPhotoPreviewUrl('');
      setTitle('');
      setDescription('');
      setCategory('animal');
      setPlaceLabel('');
    }
  }, [isOpen, questionToEdit, prefill]);

  // Revoke local object URLs on change or unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    const nextPreview = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreviewUrl(nextPreview);
    e.target.value = '';
  };

  const handleTryScanner = () => {
    if (submitting) return;
    onClose();
    navigate('/scan');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
      setError('Please enter a title between 3 and 120 characters.');
      return;
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 1000) {
      setError('Description must be 1000 characters or fewer.');
      return;
    }

    const trimmedPlace = placeLabel.trim();
    if (containsExactCoordinates(trimmedPlace)) {
      setError(
        'Please use a general place name (like a town or park), never exact coordinates.'
      );
      return;
    }

    if (!isEditing && !photoFile && !prefillPhotoUrl) {
      setError('Please add a photo before posting your question.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && questionToEdit) {
        const updated = await updateAskQuestion(questionToEdit.id, {
          title: trimmedTitle,
          description: trimmedDescription,
          category,
          placeLabel: trimmedPlace,
        });
        onSaved(updated, 'edit');
        onClose();
      } else {
        const source: File | string | null = photoFile || prefillPhotoUrl || null;
        if (!source) {
          setError('Please add a photo before posting your question.');
          return;
        }
        const created = await createAskQuestion({
          photoSource: source,
          title: trimmedTitle,
          description: trimmedDescription,
          category,
          placeLabel: trimmedPlace,
        });
        onSaved(created, 'create');
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save your question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit question' : 'Ask a question'}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] bg-surface rounded-t-3xl sm:rounded-3xl border border-outline-variant/30 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
            {isEditing ? 'Edit question' : 'Ask a question'}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close form"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {!isEditing && !prefill && (
            <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-2.5 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-label-md text-xs text-on-surface font-semibold">
                  Want an instant guess first?
                </p>
                <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">
                  Check what it might be with the scanner before asking.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTryScanner}
                className="px-3.5 py-2 min-h-[40px] rounded-full bg-tertiary text-on-tertiary font-label-md text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 shrink-0 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  document_scanner
                </span>
                <span>Try the AI scanner first</span>
              </button>
            </div>
          )}

          {/* Photo picker / preview */}
          <div className="space-y-1.5">
            <label className="block font-label-md text-xs text-on-surface font-semibold">
              Photo {!isEditing && <span className="text-error">*</span>}
            </label>

            {!isEditing && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            )}

            {photoPreviewUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container">
                <img
                  src={photoPreviewUrl}
                  alt="Selected sighting preview"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-60 object-cover block"
                />
                {!isEditing && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2.5 right-2.5 px-3.5 py-2 min-h-[40px] rounded-full bg-surface/90 backdrop-blur-sm text-on-surface font-label-md text-xs font-semibold shadow-md border border-outline-variant/30 inline-flex items-center gap-1.5 hover:bg-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      photo_camera
                    </span>
                    <span>Change photo</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-outline-variant/60 bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex flex-col items-center justify-center gap-2 transition-colors min-h-[140px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-container/15 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                    add_a_photo
                  </span>
                </div>
                <span className="font-label-md text-sm text-on-surface font-semibold">
                  Choose a photo
                </span>
                <span className="font-body-sm text-xs text-on-surface-variant text-center">
                  Clear, close-up photos help people identify it faster
                </span>
              </button>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ask-question-title"
                className="font-label-md text-xs text-on-surface font-semibold"
              >
                Question title <span className="text-error">*</span>
              </label>
              <span className="font-body-sm text-[11px] text-on-surface-variant tabular-nums">
                {title.length}/120
              </span>
            </div>
            <input
              id="ask-question-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              placeholder="What bird is this?"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-lowest border border-outline-variant/50 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <span className="block font-label-md text-xs text-on-surface font-semibold">
              Category <span className="text-error">*</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ASK_CATEGORIES.map((cat) => {
                const selected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategory(cat.id)}
                    className={`px-2.5 py-2 min-h-[42px] rounded-xl font-label-md text-xs flex items-center justify-center gap-1.5 transition-colors border ${
                      selected
                        ? 'bg-primary text-on-primary border-primary font-semibold shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">
                      {cat.icon}
                    </span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Yellow safety notice for Fungi, Reptile, or Plant */}
          <AskSafetyNotice category={category} />

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ask-question-description"
                className="font-label-md text-xs text-on-surface font-semibold"
              >
                Details (optional)
              </label>
              <span className="font-body-sm text-[11px] text-on-surface-variant tabular-nums">
                {description.length}/1000
              </span>
            </div>
            <textarea
              id="ask-question-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Share size, colors, behavior, or what it was growing on..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/50 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>

          {/* Place label */}
          <div className="space-y-1.5">
            <label
              htmlFor="ask-question-place"
              className="block font-label-md text-xs text-on-surface font-semibold"
            >
              General place name (optional)
            </label>
            <input
              id="ask-question-place"
              type="text"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              maxLength={120}
              placeholder="e.g., Seattle, WA or city park"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-surface-container-lowest border border-outline-variant/50 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="font-body-sm text-[11px] text-on-surface-variant">
              Use a general area only — never post exact coordinates.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-error-container/30 border border-error/30 text-xs text-on-error-container font-medium flex items-start gap-2"
            >
              <span className="material-symbols-outlined text-[18px] text-error shrink-0" aria-hidden="true">
                error_outline
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 pb-safe flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-full border border-outline-variant/50 text-on-surface font-label-md text-sm font-semibold hover:bg-surface-container disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 min-h-[44px] rounded-full bg-primary text-on-primary font-label-md text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {submitting && (
                <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">
                  progress_activity
                </span>
              )}
              <span>
                {submitting
                  ? isEditing
                    ? 'Saving...'
                    : 'Posting...'
                  : isEditing
                  ? 'Save changes'
                  : 'Post question'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
