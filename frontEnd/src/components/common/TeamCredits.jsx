import { memo, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import '../../styles/teamCredits.css';

const members = [
  {
    name: 'JANINE YZABEL MANANGU',
    role: 'FRONTEND DEVELOPER',
    cardImage: '/SDT/JANINE%20YZABEL%20MANANGU.png'
  },
  {
    name: 'KAYE CEE CASTRO',
    role: 'BACKEND DEVELOPER',
    cardImage: '/SDT/KAYE%20CEE%20CASTRO.png'
  },
  {
    name: 'NOREEN SARMIENTO',
    role: 'DATA MINER',
    cardImage: '/SDT/NOREEN%20SARMIENTO.png'
  },
  {
    name: 'KRISRAYAH SISON',
    role: 'QA & TESTER',
    cardImage: '/SDT/KRISRAYAH%20SISON.png'
  }
];

function TeamCredits({ isOpen, onClose }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const transitionTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(transitionTimerRef.current), []);

  if (!isOpen) return null;

  const swapContent = nextMember => {
    window.clearTimeout(transitionTimerRef.current);
    setIsExiting(true);
    transitionTimerRef.current = window.setTimeout(() => {
      setSelectedMember(nextMember);
      setIsExiting(false);
    }, 400);
  };

  const handleClose = () => {
    if (selectedMember || isExiting) {
      swapContent(null);
      return;
    }
    onClose();
  };

  return (
    <div className="team-panel-backdrop" role="presentation" onMouseDown={handleClose}>
      <aside className="team-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <button className="team-panel-close" type="button" onClick={handleClose} aria-label={selectedMember ? 'Back to development team list' : 'Close development team panel'}>
          <X size={18} />
        </button>
        <span className="team-panel-kicker">TDT POWERSTEEL KITA DASHBOARD</span>
        <h2>System Development Team</h2>

        <div className={`team-panel-stage${isExiting ? ' is-exiting' : ''}`} key={selectedMember?.name || 'team-list'}>
          {selectedMember ? (
            <div className="team-selected-id">
              <img src={selectedMember.cardImage} alt={`${selectedMember.name} ID card`} />
            </div>
          ) : (
            <div className="team-panel-list">
              {members.map(member => (
              <button
                className="team-member-card"
                type="button"
                key={member.name}
                onClick={() => swapContent(member)}
              >
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </button>
              ))}
            </div>
          )}
        </div>

        <small className="team-panel-footer">© TDT Powersteel Corporation</small>
      </aside>
    </div>
  );
}

export default memo(TeamCredits);
