import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, FileDown, FileImage, FileSpreadsheet, X } from 'lucide-react';
import '../../styles/export.css';

const exportOptions = [
  {
    id: 'pdf',
    title: 'Export as PDF',
    description: 'Browser-ready meeting copy of the dashboard.',
    icon: FileDown
  },
  {
    id: 'png',
    title: 'Export as PNG',
    description: 'Download a visual executive dashboard snapshot.',
    icon: FileImage
  },
  {
    id: 'csv',
    title: 'Export as CSV',
    description: 'Export visible tables and employee rankings.',
    icon: FileSpreadsheet
  },
  {
    id: 'report',
    title: 'Export Analytics Report',
    description: 'Generate a concise metrics and rankings report.',
    icon: BarChart3
  }
];

export default function ExportModal({ isOpen, isExporting, onClose, onExport }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="export-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="export-modal"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="export-modal-header">
              <div>
                <p className="export-kicker">Dashboard Export</p>
                <h2>Choose Export Format</h2>
              </div>
              <button className="export-close-btn" type="button" onClick={onClose} aria-label="Close export modal">
                <X size={18} />
              </button>
            </div>

            <div className="export-options-grid">
              {exportOptions.map(option => {
                const Icon = option.icon;

                return (
                  <button
                    className="export-option-card"
                    type="button"
                    key={option.id}
                    disabled={isExporting}
                    onClick={() => onExport(option.id)}
                  >
                    <span className="export-option-icon">
                      <Icon size={22} />
                    </span>
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {isExporting && (
              <motion.div
                className="export-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Preparing export package...
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
