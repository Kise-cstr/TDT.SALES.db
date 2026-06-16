import { memo } from 'react';
import '../../styles/background.css';

function Background() {
  return (
    <div className="app-background">
      <div className="background-texture" />
      <div className="background-grid" />
      <div className="background-glow" />
      <div className="background-sweep" />
    </div>
  );
}

export default memo(Background);
