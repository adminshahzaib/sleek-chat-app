import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 select-none animate-pulse">
      {/* 1. Received Message Skeleton */}
      <div className="flex items-end gap-2.5 justify-start">
        <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-800/60 shrink-0" />
        <div className="flex flex-col gap-1.5 w-1/2">
          <div className="w-16 h-2 bg-slate-800 dark:bg-slate-800/40 rounded-full" />
          <div className="px-3.5 py-3 bg-slate-900 dark:bg-slate-900/40 border border-slate-800 rounded-2xl rounded-bl-none space-y-2">
            <div className="w-full h-2.5 bg-slate-800 dark:bg-slate-800/50 rounded-full" />
            <div className="w-3/4 h-2 bg-slate-800 dark:bg-slate-800/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* 2. Sent Message Skeleton */}
      <div className="flex items-end gap-2.5 justify-end">
        <div className="flex flex-col gap-1.5 w-1/3 items-end">
          <div className="w-12 h-2 bg-slate-800 dark:bg-slate-800/40 rounded-full" />
          <div className="px-3.5 py-3 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl rounded-br-none space-y-2 w-full">
            <div className="w-full h-2.5 bg-indigo-900/25 rounded-full" />
          </div>
        </div>
        <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-800/60 shrink-0" />
      </div>

      {/* 3. Received Message Skeleton */}
      <div className="flex items-end gap-2.5 justify-start">
        <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-800/60 shrink-0" />
        <div className="flex flex-col gap-1.5 w-2/3">
          <div className="w-24 h-2 bg-slate-800 dark:bg-slate-800/40 rounded-full" />
          <div className="px-3.5 py-3 bg-slate-900 dark:bg-slate-900/40 border border-slate-800 rounded-2xl rounded-bl-none space-y-2">
            <div className="w-full h-2.5 bg-slate-800 dark:bg-slate-800/50 rounded-full" />
            <div className="w-5/6 h-2.5 bg-slate-800 dark:bg-slate-800/50 rounded-full" />
            <div className="w-1/2 h-2 bg-slate-800 dark:bg-slate-800/40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
