import { useEffect, useRef, useState } from 'react';

export default function KpiValue({ value, className = '' }) {
  const elementRef = useRef(null);
  const [fontSize, setFontSize] = useState(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const calculateFontSize = () => {
      const containerWidth = element.parentElement?.offsetWidth || 0;
      if (containerWidth < 100) return;

      // Start with a reasonable base size and scale down if needed
      let size = Math.min(46, containerWidth * 0.12);

      // Additional scaling based on text length
      const textLength = String(value).length;
      if (textLength > 15) {
        size *= 0.85;
      } else if (textLength > 12) {
        size *= 0.92;
      } else if (textLength > 10) {
        size *= 0.98;
      }

      setFontSize(Math.max(24, size));
    };

    calculateFontSize();

    // Use ResizeObserver to recalculate when container size changes
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        calculateFontSize();
      });

      const parent = element.parentElement;
      if (parent) {
        observer.observe(parent);
      }
    }

    // Also recalculate on window resize
    window.addEventListener('resize', calculateFontSize);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', calculateFontSize);
    };
  }, [value]);

  const style = fontSize ? { fontSize: `${fontSize}px` } : {};

  return (
    <strong
      ref={elementRef}
      className={className}
      style={style}
    >
      {value}
    </strong>
  );
}
