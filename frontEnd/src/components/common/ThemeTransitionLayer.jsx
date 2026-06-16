import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { DASHBOARD_THEME_CHANGE_EVENT, DASHBOARD_THEMES } from '../../utils/dashboardTheme';

const themeWash = {
  [DASHBOARD_THEMES.light]: {
    background:
      'radial-gradient(circle at 84% 12%, rgba(255,255,255,0.96), rgba(255,255,255,0.54) 30%, transparent 58%), linear-gradient(135deg, rgba(250,250,250,0.78), rgba(230,112,38,0.10))'
  },
  [DASHBOARD_THEMES.dark]: {
    background:
      'radial-gradient(circle at 84% 12%, rgba(255,122,0,0.20), rgba(20,18,16,0.48) 32%, transparent 62%), linear-gradient(135deg, rgba(0,0,0,0.78), rgba(36,36,35,0.34))'
  }
};

export default function ThemeTransitionLayer() {
  const reduceMotion = useReducedMotion();
  const [transition, setTransition] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleThemeChange = event => {
      const nextTheme = event.detail?.nextTheme === DASHBOARD_THEMES.light
        ? DASHBOARD_THEMES.light
        : DASHBOARD_THEMES.dark;

      window.clearTimeout(timerRef.current);
      setTransition({
        id: `${nextTheme}-${Date.now()}`,
        nextTheme
      });
      timerRef.current = window.setTimeout(() => setTransition(null), reduceMotion ? 80 : 620);
    };

    window.addEventListener(DASHBOARD_THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener(DASHBOARD_THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {transition && (
        <motion.div
          key={transition.id}
          className="theme-transition-layer"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1.01, filter: 'blur(6px)' }}
          animate={{
            opacity: reduceMotion ? 0 : [0, 0.24, 0],
            scale: [1.01, 1, 1.003],
            filter: ['blur(6px)', 'blur(0px)', 'blur(7px)']
          }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: reduceMotion ? 0.08 : 0.32, ease: [0.4, 0, 0.2, 1], times: [0, 0.45, 1] }}
          style={themeWash[transition.nextTheme]}
        />
      )}
    </AnimatePresence>
  );
}
