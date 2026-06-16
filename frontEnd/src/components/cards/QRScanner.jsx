import { memo, useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import scannerFrame from '../../assets/image/scanner.png';
import '../../styles/auth.css';

function QRScanner({ title, subtitle, onScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(false);
  const scannedRef = useRef(false);
  const [cameraState, setCameraState] = useState('loading');
  const [manualToken, setManualToken] = useState('');
  const [scanMessage, setScanMessage] = useState('Click the scanner to upload a QR photo if the camera cannot read it.');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const tuneCameraTrack = async stream => {
    const track = stream.getVideoTracks?.()[0];
    if (!track?.getCapabilities || !track?.applyConstraints) return;

    const capabilities = track.getCapabilities();
    const advanced = {};

    if (capabilities.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
    if (capabilities.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
    if (capabilities.whiteBalanceMode?.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
    if (capabilities.torch) advanced.torch = false;

    if (!Object.keys(advanced).length) return;
    await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
  };

  const requestCamera = useCallback(async () => {
    setCameraState('loading');
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('denied');
      return;
    }

    try {
      const preferredConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { min: 640, ideal: 1920 },
          height: { min: 480, ideal: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(preferredConstraints)
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      await tuneCameraTrack(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play?.().catch(() => {});
      }
      setCameraState('enabled');
    } catch {
      setCameraState('denied');
    }
  }, [stopCamera]);

  const readQrFromCanvas = useCallback(async detector => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    if (detector) {
      const codes = await detector.detect(canvas).catch(() => []);
      if (codes?.[0]?.rawValue) return codes[0].rawValue;
    }

    const context = canvas.getContext?.('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return null;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });

    return code?.data || null;
  }, []);

  const drawCenterCrop = useCallback(source => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.('2d', { willReadFrequently: true });
    if (!canvas || !context) return false;

    const sourceWidth = source.videoWidth || source.width || 0;
    const sourceHeight = source.videoHeight || source.height || 0;
    if (!sourceWidth || !sourceHeight) return false;

    const sourceSize = Math.floor(Math.min(sourceWidth, sourceHeight) * 0.86);
    const sourceX = Math.floor((sourceWidth - sourceSize) / 2);
    const sourceY = Math.floor((sourceHeight - sourceSize) / 2);
    const outputSize = 1000;

    canvas.width = outputSize;
    canvas.height = outputSize;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
    return true;
  }, []);

  const drawFullFrame = useCallback(source => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.('2d', { willReadFrequently: true });
    if (!canvas || !context) return false;

    const sourceWidth = source.videoWidth || source.width || 0;
    const sourceHeight = source.videoHeight || source.height || 0;
    if (!sourceWidth || !sourceHeight) return false;

    const maxSize = 1400;
    const scale = Math.min(maxSize / sourceWidth, maxSize / sourceHeight, 1);

    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return true;
  }, []);

  const loadImageSource = file => {
    if ('createImageBitmap' in window) return createImageBitmap(file);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(image.src);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(image.src);
        reject(new Error('Could not load QR image'));
      };
      image.src = URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    requestCamera();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [requestCamera, stopCamera]);

  useEffect(() => {
    if (!navigator.permissions?.query) return undefined;
    let permissionStatus;

    navigator.permissions.query({ name: 'camera' }).then(status => {
      permissionStatus = status;
      permissionStatus.onchange = () => {
        if (permissionStatus.state === 'granted' && cameraState !== 'enabled') requestCamera();
        if (permissionStatus.state === 'denied') setCameraState('denied');
      };
    }).catch(() => {});

    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [cameraState, requestCamera]);

  useEffect(() => {
    if (!onScan || cameraState !== 'enabled' || !videoRef.current || !('BarcodeDetector' in window)) return undefined;
    let cancelled = false;
    const detector = new window.BarcodeDetector({
      formats: ['qr_code']
    });

    const detectFromVideo = async video => {
      const videoWidth = video.videoWidth || 0;
      const videoHeight = video.videoHeight || 0;

      if (video.readyState < 2 || !videoWidth || !videoHeight) return null;

      const directCodes = await detector.detect(video).catch(() => []);
      if (directCodes?.[0]?.rawValue) return directCodes[0].rawValue;

      if (!drawCenterCrop(video)) return null;
      return readQrFromCanvas(detector);
    };

    const scan = async () => {
      if (cancelled || scannedRef.current || !videoRef.current) return;
      try {
        const value = await detectFromVideo(videoRef.current);
        if (value) {
          scannedRef.current = true;
          const accepted = await onScan(value);
          if (!accepted) {
            window.setTimeout(() => {
              scannedRef.current = false;
              if (!cancelled) scan();
            }, 1400);
          }
          return;
        }
      } catch {
        // Keep the camera preview active even if native detection is unavailable.
      }
      if (!cancelled) window.setTimeout(scan, 180);
    };

    scan();
    return () => {
      cancelled = true;
    };
  }, [cameraState, drawCenterCrop, onScan, readQrFromCanvas]);

  const openQrFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleScannerKeyDown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openQrFilePicker();
  };

  const handleQrFileUpload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onScan) return;

    setScanMessage('Reading QR photo...');

    try {
      const detector = 'BarcodeDetector' in window && typeof window.BarcodeDetector === 'function'
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;
      const bitmap = await loadImageSource(file);
      let value = null;

      if (drawFullFrame(bitmap)) value = await readQrFromCanvas(detector);
      if (!value && drawCenterCrop(bitmap)) value = await readQrFromCanvas(detector);
      bitmap.close?.();

      if (value) {
        setScanMessage('QR photo detected. Verifying...');
        await onScan(value);
        return;
      }

      setScanMessage('No QR code found in that photo. Try a clearer, uncropped image.');
    } catch {
      setScanMessage('Could not read that QR photo. Try another image or paste the token below.');
    }
  };

  const submitManualToken = async event => {
    event.preventDefault();
    const value = manualToken.trim();
    if (!value || !onScan) return;
    await onScan(value);
  };

  return (
    <div className="qr-scanner-wrapper">
      <div className="qr-title-block">
        <span className="auth-section-label">Security Portal</span>
        <h3>{title || 'Scan Your QR Code'}</h3>
      </div>

      <div
        className={`scanner-container qr-camera-${cameraState}`}
        role="button"
        tabIndex={0}
        title="Click to upload a QR code photo"
        aria-label="Open QR code photo upload"
        onClick={openQrFilePicker}
        onKeyDown={handleScannerKeyDown}
      >
        <div className="qr-camera-window">
          <video ref={videoRef} autoPlay muted playsInline className="scanner-video" />
          <canvas ref={canvasRef} className="qr-detect-canvas" aria-hidden="true" />
          <input
            ref={fileInputRef}
            className="qr-photo-input"
            type="file"
            accept="image/*"
            onChange={handleQrFileUpload}
            aria-label="Upload QR code photo"
          />
          {cameraState === 'denied' && (
            <span className="qr-camera-note">Camera access required</span>
          )}
        </div>

        <img src={scannerFrame} alt="QR Scanner" className="scanner-overlay" />

        <div className="scan-line" />
      </div>

      <p className="qr-copy">{subtitle}</p>
      <p className="qr-upload-hint">{scanMessage}</p>
      <form className="qr-manual-form" onSubmit={submitManualToken}>
        <input
          value={manualToken}
          onChange={event => setManualToken(event.target.value.toUpperCase())}
          placeholder="Paste secure QR token"
          aria-label="Secure QR token"
        />
        <button type="submit">Verify</button>
      </form>
    </div>
  );
}

export default memo(QRScanner);
