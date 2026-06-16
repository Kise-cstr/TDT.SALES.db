import { useEffect, useState } from 'react';

export const panelVariant = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: 'easeOut' }
  }
};

export function PresentationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="presentation-tooltip">
      <strong>{label}</strong>
      {payload.map(entry => (
        <span key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name || entry.dataKey}: {entry.value}
        </span>
      ))}
    </div>
  );
}

export function PresentationPanelHeader({ title, subtitle }) {
  return (
    <div className="presentation-panel-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

export function usePresentationCycle(panelCount, intervalMs = 4200) {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCycleIndex(current => (current + 1) % panelCount);
      setRefreshCount(current => (current + 1) % 9);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, panelCount]);

  return { cycleIndex, refreshCount };
}
