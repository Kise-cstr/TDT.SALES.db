import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import '../../styles/animations.css';
import logo from '../../assets/logos/tdt_logo.png';
import darkModeBackground from '../../assets/mode/DARKMODE.png';
import lightModeBackground from '../../assets/mode/LIGHTMODE.png';

const LOADER_DURATION_MS = 2500;

const loadingStages = [
  { max: 20, label: 'Initializing System...' },
  { max: 40, label: 'Loading User Data...' },
  { max: 60, label: 'Processing Sales Records...' },
  { max: 80, label: 'Generating Analytics...' },
  { max: 100, label: 'Finalizing Dashboard...' }
];

const particles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  angle: index * 20,
  distance: 190 + (index % 4) * 42,
  delay: index * 0.12
}));

export default function LoadingScreen({ mode = 'route', onComplete }) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const progressPercent = Math.round(loadingProgress * 100);
  const currentStage = loadingStages.find(stage => progressPercent <= stage.max) || loadingStages[loadingStages.length - 1];

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finishLoading = useCallback((source = 'complete') => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setLoadingProgress(1);
    console.log(`[KITA Loader] loading finished by ${source}.`);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    let frameId = 0;
    const startedAt = window.performance.now();

    const tick = now => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(elapsed / LOADER_DURATION_MS, 1);
      setLoadingProgress(nextProgress);

      if (nextProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      finishLoading('progress 100%');
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [finishLoading]);

  return (
    <motion.div
      className={`loader-screen loader-screen-${mode}`}
      style={{
        '--loader-dark-background': `url(${darkModeBackground})`,
        '--loader-light-background': `url(${lightModeBackground})`
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="loading-container">
        <div className="loading-radar" aria-hidden="true">
          <span className="radar-ring radar-ring-outer" />
          <span className="radar-ring radar-ring-mid" />
          <span className="radar-ring radar-ring-inner" />
          <span className="radar-scan" />
          <span className="data-arc data-arc-a" />
          <span className="data-arc data-arc-b" />
          <span className="data-arc data-arc-c" />
          {particles.map(particle => (
            <span
              key={particle.id}
              className="loader-particle"
              style={{
                '--particle-angle': `${particle.angle}deg`,
                '--particle-distance': `${particle.distance}px`,
                '--particle-delay': `${particle.delay}s`
              }}
            />
          ))}
        </div>

        <motion.img
          src={logo}
          alt="TDT Powersteel Logo"
          className="loading-logo"
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: [1, 1.015, 1], y: 0 }}
          transition={{ opacity: { delay: 0.05, duration: 0.5 }, scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
        />

        <div className="loading-copy">
          <p className="loading-subtitle">KEY INTEGRATED TRACKING &amp; ANALYTICS</p>
        </div>

        <div className="intelligence-progress" aria-label={`Loading progress ${progressPercent} of 100 percent`}>
          {loadingStages.map((status, index) => (
            <span
              key={status.label}
              className={progressPercent >= (index + 1) * 20 ? 'is-active' : ''}
              style={{
                '--segment-fill': Math.max(0, Math.min((loadingProgress * 100 - index * 20) / 20, 1))
              }}
            />
          ))}
        </div>

        <motion.p
          key={currentStage.label}
          className="loading-text"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          {currentStage.label}
        </motion.p>
      </div>

      <button
        type="button"
        className="loading-skip-button"
        onClick={() => finishLoading('skip button')}
      >
        Skip
      </button>
    </motion.div>
  );
}
