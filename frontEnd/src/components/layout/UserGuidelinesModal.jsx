import { memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBookOpen, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

const IMAGE_COUNT = 10;

const getThemeName = () => (
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light'
);

const buildGuidelineImages = themeName => (
  Array.from({ length: IMAGE_COUNT }, (_, index) => ({
    name: String(index + 1),
    src: `/GUIDELINES-${themeName === 'dark' ? 'DARKMODE' : 'LIGHTMODE'}/${index + 1}.png`
  }))
);

function UserGuidelinesModal({ isOpen, onClose }) {
  const [themeName, setThemeName] = useState(getThemeName);
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = useMemo(() => buildGuidelineImages(themeName), [themeName]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const updateTheme = () => setThemeName(getThemeName());
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentIndex(index => (index - 1 + images.length) % images.length);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCurrentIndex(index => (index + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setCurrentIndex(0);
  }, [isOpen]);

  if (typeof document === 'undefined') {
    return null;
  }

  const currentImage = images[currentIndex];

  const goPrevious = () => {
    setCurrentIndex(index => (index - 1 + images.length) % images.length);
  };

  const goNext = () => {
    setCurrentIndex(index => (index + 1) % images.length);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="guidelines-modal-shell"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            className="guidelines-modal"
            role="dialog"
            aria-modal="true"
            aria-label="User Guidelines"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            onMouseDown={event => event.stopPropagation()}
          >
          <header className="guidelines-modal-header">
            <div className="guidelines-modal-heading">
              <span className="guidelines-modal-kicker">
                <FiBookOpen size={14} />
                User Manual
              </span>
              <h3>User Guidelines</h3>
              <p>Browse the dashboard walkthrough, one page at a time.</p>
            </div>
            <button type="button" className="guidelines-modal-close" onClick={onClose} aria-label="Close user guidelines">
              <FiX size={18} />
            </button>
          </header>

          <div className="guidelines-modal-body">
            <div className="guidelines-modal-frame">
              <div className="guidelines-modal-image-stage">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImage.src}
                    src={currentImage.src}
                    alt={`User Guidelines image ${currentImage.name}`}
                    className="guidelines-modal-image"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.34, ease: 'easeInOut' }}
                  />
                </AnimatePresence>
              </div>
            </div>
          </div>

          <footer className="guidelines-modal-footer">
            <div className="guidelines-modal-counter">
              Image {currentImage.name} of {images.length}
            </div>
            <div className="guidelines-modal-actions">
              <button type="button" className="guidelines-modal-nav" onClick={goPrevious} disabled={images.length <= 1}>
                <FiChevronLeft size={16} />
                Previous
              </button>
              <button type="button" className="guidelines-modal-nav" onClick={goNext} disabled={images.length <= 1}>
                Next
                <FiChevronRight size={16} />
              </button>
            </div>
          </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default memo(UserGuidelinesModal);
