import { memo } from 'react';
import MetricCard from './MetricCard';

function InteractiveMetricCard(cardProps) {
  return (
    <div className="interactive-metric-card">
      <MetricCard {...cardProps} />
    </div>
  );
}

export default memo(InteractiveMetricCard);
