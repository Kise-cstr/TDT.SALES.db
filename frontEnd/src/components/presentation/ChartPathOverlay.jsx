import { motion } from 'framer-motion';
import { useEffect, useRef, useId } from 'react';

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function samplePathAtDistance(path, distance) {
  const totalLength = path.getTotalLength();
  const point = path.getPointAtLength(Math.min(distance, totalLength));
  return point;
}

export default function ChartPathOverlay({
  data = [],
  dataKey = 'value',
  width = 800,
  height = 300,
  margin = { top: 8, right: 12, left: -12, bottom: 0 },
  strokeColor = '#ff9f43',
  pulseColor = '#ff9f43',
  animated = true
}) {
  // Call all hooks unconditionally at the top of the component
  const pathRef = useRef(null);
  const dotRef = useRef(null);
  const pulseFrameRef = useRef(null);
  const rawId = useId();

  // Setup animation effect hook before early return
  useEffect(() => {
    if (!pathRef.current || !dotRef.current || !data?.length) return undefined;

    let animationStart = animated ? Date.now() : null;
    const animationDuration = 3000;

    const animate = () => {
      if (!animated || animationStart === null) {
        pulseFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = Date.now() - animationStart;
      const progress = (elapsed % animationDuration) / animationDuration;
      const pathLength = pathRef.current.getTotalLength();
      const distance = progress * pathLength;

      try {
        const point = samplePathAtDistance(pathRef.current, distance);
        if (dotRef.current && point) {
          dotRef.current.setAttribute('cx', point.x);
          dotRef.current.setAttribute('cy', point.y);
        }
      } catch (e) {
        // Silent
      }

      pulseFrameRef.current = requestAnimationFrame(animate);
    };

    if (animated) {
      pulseFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (pulseFrameRef.current) {
        cancelAnimationFrame(pulseFrameRef.current);
      }
    };
  }, [animated, pathRef, dotRef, data?.length]);

  // Early return AFTER all hooks
  if (!data?.length || width < 100 || height < 100) return null;

  const filterId = `chartOverlay${rawId.replace(/:/g, '')}`;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const baseY = margin.top + plotHeight;

  // Normalize data
  const normalized = data.map(item => ({
    ...item,
    value: toNumber(item[dataKey] ?? item.value ?? 0)
  }));

  // Find max for scaling
  const maxValue = Math.max(0.01, ...normalized.map(item => item.value));

  // Build path points
  const xFor = (index) => {
    if (normalized.length <= 1) return margin.left + plotWidth / 2;
    return margin.left + (plotWidth / (normalized.length - 1)) * index;
  };

  const yFor = (value) => {
    const clampedValue = Math.min(Math.max(value, 0), maxValue);
    return margin.top + plotHeight - (clampedValue / maxValue) * plotHeight;
  };

  // Generate smooth curve path
  const pathPoints = normalized.map((item, index) => ({
    x: xFor(index),
    y: yFor(item.value)
  }));

  const pathD = pathPoints.reduce((path, point, index, points) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  return (
    <svg
      className="chart-path-overlay"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2
      }}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={pulseColor} floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Animated path draw */}
      {animated ? (
        <motion.path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.72 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ) : (
        <path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
      )}

      {/* Pulse dot that moves along path */}
      {animated && (
        <circle
          ref={dotRef}
          cx={pathPoints[0]?.x || margin.left}
          cy={pathPoints[0]?.y || margin.top}
          r="5"
          fill={pulseColor}
          opacity="0.9"
          filter={`url(#${filterId})`}
        >
          <animate
            attributeName="r"
            values="5;7;5"
            dur="1.2s"
            repeatCount="indefinite"
            begin="0s"
          />
          <animate
            attributeName="opacity"
            values="0.9;0.6;0.9"
            dur="1.2s"
            repeatCount="indefinite"
            begin="0s"
          />
        </circle>
      )}
    </svg>
  );
}
