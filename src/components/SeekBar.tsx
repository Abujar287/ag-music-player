import React, { useCallback, useRef, useState } from 'react';

interface SeekBarProps {
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
  onPreviewChange?: (sec: number | null) => void;
  variant?: 'full' | 'mini';
  ariaLabel?: string;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  positionSec,
  durationSec,
  onSeek,
  onPreviewChange,
  variant = 'full',
  ariaLabel = 'Seek audio position',
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const draftSecRef = useRef(positionSec);
  const [isDragging, setIsDragging] = useState(false);
  const [draftSec, setDraftSec] = useState<number | null>(null);

  const safeDuration = Math.max(1, Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1);
  const activeSec = isDragging && draftSec !== null ? draftSec : positionSec;
  const clampedSec = Math.max(0, Math.min(activeSec, safeDuration));
  const progressPct = Math.min(100, Math.max(0, (clampedSec / safeDuration) * 100));

  const calcTimeFromClientX = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return clampedSec;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * safeDuration;
    },
    [clampedSec, safeDuration]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture is unavailable
    }
    const nextSec = calcTimeFromClientX(e.clientX);
    draggingRef.current = true;
    draftSecRef.current = nextSec;
    setIsDragging(true);
    setDraftSec(nextSec);
    onPreviewChange?.(nextSec);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const nextSec = calcTimeFromClientX(e.clientX);
    draftSecRef.current = nextSec;
    setDraftSec(nextSec);
    onPreviewChange?.(nextSec);
  };

  const commitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const finalSec = draftSecRef.current;
    draggingRef.current = false;
    setIsDragging(false);
    setDraftSec(null);
    onPreviewChange?.(null);
    onSeek(finalSec);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onSeek(Math.min(safeDuration, clampedSec + 5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onSeek(Math.max(0, clampedSec - 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(safeDuration);
    }
  };

  if (variant === 'mini') {
    return (
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(clampedSec)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitDrag}
        onPointerCancel={commitDrag}
        onKeyDown={handleKeyDown}
        className="relative w-full h-1 bg-black/10 dark:bg-white/10 cursor-pointer touch-none select-none"
      >
        <div className="absolute inset-x-0 -top-2.5 h-5" />
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-75"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration)}
      aria-valuenow={Math.round(clampedSec)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={commitDrag}
      onPointerCancel={commitDrag}
      onKeyDown={handleKeyDown}
      className="relative w-full h-8 flex items-center cursor-pointer touch-none select-none focus:outline-none"
    >
      <div className="w-full h-1.5 rounded-full bg-black/15 dark:bg-white/15 overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div
        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_2px_rgba(11,11,13,0.65)] transition-transform duration-100 pointer-events-none ${
          isDragging ? 'w-4 h-4 scale-125' : 'w-3.5 h-3.5'
        }`}
        style={{ left: `${progressPct}%` }}
      />
    </div>
  );
};
