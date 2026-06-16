import { memo } from 'react';
import { FiMinimize2, FiMonitor } from 'react-icons/fi';

function PresentButton({ isPresenting, onToggle }) {
  const Icon = isPresenting ? FiMinimize2 : FiMonitor;

  return (
    <button className="nav-btn nav-btn-secondary" type="button" onClick={onToggle}>
      <Icon size={16} />
      {isPresenting ? 'Exit' : 'Present'}
    </button>
  );
}

export default memo(PresentButton);
