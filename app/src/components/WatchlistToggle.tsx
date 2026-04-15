'use client';

interface WatchlistToggleProps {
  playerName: string;
  isWatched: boolean;
  onToggle?: (playerName: string) => void;
}

export default function WatchlistToggle({ playerName, isWatched, onToggle }: WatchlistToggleProps) {
  return (
    <button
      onClick={() => onToggle?.(playerName)}
      className="text-xl hover:scale-110 transition-transform"
      title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isWatched ? '⭐' : '☆'}
    </button>
  );
}
