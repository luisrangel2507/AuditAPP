'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Escanea el código de barras / QR de la etiqueta del número de parte con la cámara.
// Usa el lector nativo del navegador cuando existe (Android/Chrome) y, si no, uno por software (iPhone).
export default function BarcodeScan({ onResult, onClose }) {
  const video = useRef(null), [err, setErr] = useState(''), [busy, setBusy] = useState(true);
  useEffect(() => {
    let stop = false, controls = null, stream = null, raf = 0;
    const done = (text) => { if (stop) return; stop = true; const clean = String(text || '').trim().toUpperCase(); if (navigator.vibrate) navigator.vibrate(60); onResult(clean); };
    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          const formats = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'qr_code', 'data_matrix', 'itf', 'codabar'];
          const det = new window.BarcodeDetector({ formats });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          video.current.srcObject = stream; await video.current.play(); setBusy(false);
          const tick = async () => {
            if (stop) return;
            try { const r = await det.detect(video.current); if (r[0]?.rawValue) return done(r[0].rawValue); } catch {}
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
          const hints = new Map([[lib.DecodeHintType.TRY_HARDER, true]]);
          const reader = new BrowserMultiFormatReader(hints);
          controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (res) => { if (res) done(res.getText()); });
          setBusy(false);
        }
      } catch (e) {
        setBusy(false);
        setErr(e?.name === 'NotAllowedError' ? 'Permite el acceso a la cámara para escanear (o escribe el N/P a mano).' : 'No se pudo abrir la cámara. Escribe el N/P a mano.');
      }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); try { controls?.stop(); } catch {} try { stream?.getTracks().forEach((t) => t.stop()); } catch {} };
    // eslint-disable-next-line
  }, []);
  return createPortal(
    <div className="scan" role="dialog" aria-label="Escanear código">
      <div className="scan-top"><b>Escanea el código de la etiqueta</b><button type="button" className="photo-back" style={{ position: 'static' }} onClick={onClose}>✕ Cerrar</button></div>
      <div className="scan-stage">
        <video ref={video} playsInline muted />
        <i className="scan-frame" />
        {busy && <div className="scan-msg">Abriendo cámara…</div>}
        {err && <div className="scan-msg err">{err}</div>}
      </div>
      <div className="scan-hint">Apunta al código de barras o QR. También puedes cerrar y escribir el número de parte a mano.</div>
    </div>, document.body);
}
