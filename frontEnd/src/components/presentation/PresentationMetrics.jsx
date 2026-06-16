import { motion } from 'framer-motion';

export default function PresentationMetrics({ metrics }) {
  return (
    <motion.section
      className="presentation-metrics"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.04, delayChildren: 0.08 }
        }
      }}
    >
      {metrics.map(metric => (
        <motion.article
          className="presentation-metric-card"
          key={metric.label}
          variants={{
            hidden: { opacity: 0, y: 10, scale: 0.98 },
            visible: { opacity: 1, y: 0, scale: 1 }
          }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <span className="presentation-metric-label">{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </motion.article>
      ))}
    </motion.section>
  );
}
