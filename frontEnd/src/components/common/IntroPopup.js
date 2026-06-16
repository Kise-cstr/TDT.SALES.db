import '../../styles/animations.css';

import logo from '../../assets/logos/tdt_logo.png';

export default function IntroPopup() {
  return (
    <div className="intro-screen">
      <div className="intro-logo-wrapper">
        <img
          src={logo}
          alt="TDT Powersteel Logo"
          className="intro-logo"
        />
      </div>
    </div>
  );
}
