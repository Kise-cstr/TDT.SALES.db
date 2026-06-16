import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Camera, Download, Save, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../auth/AuthContext';
import { generateScanToken } from '../api/authApi';
import StatusBadge from '../components/common/StatusBadge';
import { baseSalesReps } from '../data/salesRepData';
import { getPerformanceState } from '../utils/salesRepUtils';
import '../styles/profile.css';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const cropFileInputRef = useRef(null);
  const cropDragRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    position: user?.position || 'Sales Representative',
    department: user?.department || 'Sales Department',
    avatar: user?.avatar || ''
  }));
  const [message, setMessage] = useState('');
  const [scanAccess, setScanAccess] = useState(null);
  const [scanAccessMessage, setScanAccessMessage] = useState('');
  const [cropImage, setCropImage] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });

  const initials = useMemo(() => {
    const first = form.firstName?.slice(0, 1) || user?.name?.slice(0, 1) || 'U';
    const last = form.lastName?.slice(0, 1) || '';
    return `${first}${last}`.toUpperCase();
  }, [form.firstName, form.lastName, user?.name]);
  const performanceState = useMemo(() => {
    const rep = baseSalesReps.find(item => item.name.toLowerCase() === user?.name?.toLowerCase());
    return rep ? getPerformanceState(rep.performance) : getPerformanceState(user?.status === 'approved' ? 76 : 48);
  }, [user?.name, user?.status]);

  const updateField = key => event => {
    setForm(current => ({ ...current, [key]: event.target.value }));
  };

  const handleAvatarUpload = event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result);
      setCrop({ x: 0, y: 0, zoom: 1 });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const closeCropModal = () => {
    setCropImage('');
    setCrop({ x: 0, y: 0, zoom: 1 });
  };

  const startCropDrag = event => {
    cropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cropX: crop.x,
      cropY: crop.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCropDrag = event => {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setCrop(current => ({
      ...current,
      x: Math.max(-90, Math.min(90, drag.cropX + event.clientX - drag.startX)),
      y: Math.max(-90, Math.min(90, drag.cropY + event.clientY - drag.startY))
    }));
  };

  const endCropDrag = event => {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  };

  useEffect(() => {
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      position: user?.position || 'Sales Representative',
      department: user?.department || 'Sales Department',
      avatar: user?.avatar || ''
    });
  }, [user?.avatar, user?.department, user?.firstName, user?.lastName, user?.position]);

  const saveCroppedAvatar = () => {
    if (!cropImage) return;

    const image = new Image();
    image.onload = async () => {
      const outputSize = 320;
      const previewSize = 220;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
      const scaledWidth = image.width * baseScale * crop.zoom;
      const scaledHeight = image.height * baseScale * crop.zoom;
      const dragScale = outputSize / previewSize;

      canvas.width = outputSize;
      canvas.height = outputSize;
      context.drawImage(
        image,
        (outputSize - scaledWidth) / 2 + crop.x * dragScale,
        (outputSize - scaledHeight) / 2 + crop.y * dragScale,
        scaledWidth,
        scaledHeight
      );

      const avatar = canvas.toDataURL('image/jpeg', 0.86);
      const nextForm = { ...form, avatar };
      setForm(nextForm);
      const result = await updateProfile(nextForm);
      setMessage(result.message || 'Avatar saved.');
      closeCropModal();
    };
    image.src = cropImage;
  };

  const handleSubmit = event => {
    event.preventDefault();
    updateProfile(form).then(result => {
      setMessage(result.message);
    });
  };

  const handleGenerateScanAccess = async () => {
    setScanAccessMessage('');
    try {
      const response = await generateScanToken();
      if (response?.success && response.data?.token) {
        setScanAccess(response.data);
        setScanAccessMessage('New account-bound QR token generated. Previous QR tokens are now invalid.');
      } else {
        setScanAccessMessage(response?.message || 'Unable to generate secure token.');
      }
    } catch (error) {
      setScanAccessMessage(error?.response?.data?.message || error.message || 'Unable to generate secure token.');
    }
  };

  useEffect(() => {
    if (!user?.qrToken) return;
    setScanAccess(current => {
      if (current?.token === user.qrToken) return current;
      return {
        token: user.qrToken,
        expiresIn: '30d',
        generatedAt: user.qrGeneratedAt || null,
        tokenVersion: user.tokenVersion || 1,
        qrCodeToken: user.qrToken,
      };
    });
  }, [user?.qrGeneratedAt, user?.qrToken, user?.tokenVersion]);

  useEffect(() => {
    if (!scanAccess?.token || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, scanAccess.token, {
      errorCorrectionLevel: 'L',
      margin: 3,
      width: 220,
      color: {
        dark: '#111111',
        light: '#ffffff'
      }
    }).catch(() => {});
  }, [scanAccess?.token]);

  const downloadQrCode = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !scanAccess?.token) return;

    canvas.toBlob(blob => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `tdt-qr-token-${scanAccess.token.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  };

  return (
    <motion.section
      className="profile-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
    >
      <div className="profile-hero">
        <div>
          <small className="profile-kicker">Employee Profile</small>
          <h1>Profile Management</h1>
          <p>Keep your visible workforce identity current across the dashboard.</p>
        </div>
        <StatusBadge status={performanceState} type="performance" />
      </div>

      <form className="profile-card" onSubmit={handleSubmit}>
        <div className="profile-management-layout">
          <div className="profile-avatar-editor">
            <div className="profile-avatar-preview">
              {form.avatar ? <img src={form.avatar} alt="" /> : <span>{initials}</span>}
            </div>
            <label className="profile-avatar-upload">
              <Camera size={16} />
              Upload avatar
              <input ref={cropFileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          </div>

          <div className="profile-form-panel">
            <div className="profile-fields profile-form-grid">
              <label>
                <span>First name</span>
                <input value={form.firstName} onChange={updateField('firstName')} />
              </label>
              <label>
                <span>Last name</span>
                <input value={form.lastName} onChange={updateField('lastName')} />
              </label>
              <label>
                <span>Position</span>
                <input value={form.position} onChange={updateField('position')} />
              </label>
              <label>
                <span>Department</span>
                <input value={form.department} onChange={updateField('department')} />
              </label>
            </div>

            {message && <p className="profile-save-message">{message}</p>}

            <div className="profile-actions">
              <button className="profile-save-btn" type="submit">
                <Save size={16} />
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </form>

      <section className="profile-card profile-security-card">
        <div className="profile-security-copy">
          <small className="profile-kicker">Secure Access</small>
          <h2>QR Account Token</h2>
          <p>Generate one account-bound QR token for scanner login. Creating a new one rotates and invalidates the previous token.</p>
        </div>
        <button className="profile-save-btn" type="button" onClick={handleGenerateScanAccess}>
          Generate QR Token
        </button>
        {scanAccessMessage && <p className="profile-save-message">{scanAccessMessage}</p>}
        {scanAccess?.token && (
          <div className="profile-scan-token-box">
            <div className="profile-scan-code-grid">
              <div>
                <span>QR code</span>
                <canvas ref={qrCanvasRef} aria-label="Account-bound QR code" />
                <button className="profile-download-qr-btn" type="button" onClick={downloadQrCode}>
                  <Download size={15} />
                  Download QR
                </button>
              </div>
            </div>
            <span>Token number</span>
            <input className="profile-token-number" readOnly value={scanAccess.token} />
            <small>Expires in {scanAccess.expiresIn}. Keep this token private; it logs in only this account.</small>
          </div>
        )}
      </section>

      {cropImage && (
        <div className="profile-crop-backdrop" role="presentation" onMouseDown={closeCropModal}>
          <div className="profile-crop-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <div className="profile-crop-header">
              <div>
                <span>Avatar crop</span>
                <strong>Position image</strong>
              </div>
              <button type="button" onClick={closeCropModal} aria-label="Close avatar cropper">
                <X size={18} />
              </button>
            </div>

            <div
              className="profile-crop-stage"
              onPointerDown={startCropDrag}
              onPointerMove={moveCropDrag}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
            >
              <img
                src={cropImage}
                alt=""
                draggable="false"
                style={{ transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.zoom})` }}
              />
            </div>

            <label className="profile-crop-zoom">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="1.8"
                step="0.01"
                value={crop.zoom}
                onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))}
              />
            </label>

            <div className="profile-crop-actions">
              <button type="button" className="profile-crop-secondary" onClick={closeCropModal}>Cancel</button>
              <button type="button" className="profile-save-btn" onClick={saveCroppedAvatar}>Save avatar</button>
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}
