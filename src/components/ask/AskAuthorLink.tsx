import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AskAuthor } from '../../services/askService';

interface AskAuthorLinkProps {
  author: AskAuthor;
  sizeClass?: string;
}

export const AskAuthorLink: React.FC<AskAuthorLinkProps> = ({
  author,
  sizeClass = 'w-7 h-7',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const label = author.displayName || author.username || 'Explorer';
  const initial = (label.trim().charAt(0) || 'E').toUpperCase();
  const hasProfileRoute = Boolean(author.username && author.username.trim());

  const content = (
    <>
      {author.avatarUrl && !imgFailed ? (
        <img
          src={author.avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${sizeClass} rounded-full object-cover shrink-0 bg-surface-container`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${sizeClass} rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center shrink-0 select-none`}
        >
          {initial}
        </span>
      )}
      <span className="font-label-md text-xs text-on-surface font-medium truncate">
        {label}
      </span>
    </>
  );

  if (!hasProfileRoute) {
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        {content}
      </span>
    );
  }

  return (
    <Link
      to={`/u/${encodeURIComponent(author.username)}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-2 min-w-0 rounded-full hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
    >
      {content}
    </Link>
  );
};
