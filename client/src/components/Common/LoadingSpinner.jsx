import React from 'react';

export default function LoadingSpinner({ size = 'medium', fullScreen = false }) {
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    medium: 'w-12 h-12 border-3',
    large: 'w-16 h-16 border-4',
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-slate-950/90 z-50 backdrop-blur-sm'
    : 'flex items-center justify-center p-8 w-full';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        <div
          className={`${sizeClasses[size]} border-t-indigo-500 border-r-indigo-500 border-b-slate-800 border-l-slate-800 rounded-full animate-spin`}
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
        {fullScreen && (
          <span className="text-slate-400 font-medium animate-pulse tracking-wide text-sm">
            Syncing workspace...
          </span>
        )}
      </div>
    </div>
  );
}
