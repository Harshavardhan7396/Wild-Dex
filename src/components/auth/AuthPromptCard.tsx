import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface AuthPromptCardProps {
  title: string;
  description: string;
  icon?: string;
}

export const AuthPromptCard: React.FC<AuthPromptCardProps> = ({
  title,
  description,
  icon = 'lock',
}) => {
  const { setAuthModalOpen } = useAuth();

  return (
    <div className="w-full p-8 rounded-3xl bg-surface-container-high border border-outline-variant/30 text-center flex flex-col items-center gap-4 my-6 shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
        <span className="material-symbols-outlined text-[32px]">{icon}</span>
      </div>

      <div className="max-w-md">
        <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
          {title}
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
          {description}
        </p>
      </div>

      <button
        onClick={() => setAuthModalOpen(true)}
        type="button"
        className="px-6 py-3 rounded-full bg-primary text-on-primary font-label-lg font-bold flex items-center gap-2.5 shadow-md hover:opacity-95 active:scale-95 transition-all mt-2"
      >
        <span className="material-symbols-outlined text-[20px]">login</span>
        <span>Sign in with Google</span>
      </button>
    </div>
  );
};
