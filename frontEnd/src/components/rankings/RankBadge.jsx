import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export default function RankBadge({ rank, movement }) {
  const isTopThree = rank <= 3;
  const movementClass = movement > 0 ? 'up' : movement < 0 ? 'down' : 'same';
  const movementLabel = movement > 0 ? `Moved up ${movement}` : movement < 0 ? `Moved down ${Math.abs(movement)}` : 'Unchanged';
  const MovementIcon = movement > 0 ? TrendingUp : movement < 0 ? TrendingDown : Minus;

  return (
    <div className="rank-badge-wrap">
      <span className={`rank-badge ${isTopThree ? `rank-top-${rank}` : ''}`}>
        #{rank}
      </span>
      <span className={`rank-movement ${movementClass}`} title={movementLabel}>
        <MovementIcon size={16} />
      </span>
    </div>
  );
}
