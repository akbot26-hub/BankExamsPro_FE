import React from 'react';

/**
 * The exam engine runs on laptops and desktops only. Everything before the
 * exam works on a phone; the paper itself does not. Two signals, either blocks:
 *   1. a mobile/tablet user agent — phones and iPads are out regardless of size
 *   2. a viewport narrower than the engine's two-pane layout needs
 */
export const EXAM_MIN_WIDTH = 1024;

export function examDeviceCheck() {
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini|Mobile/i.test(ua)
    // Modern iPads report as Mac + touch.
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (mobileUA) return { ok: false, reason: 'mobile-device' };
  if (window.innerWidth < EXAM_MIN_WIDTH) return { ok: false, reason: 'small-window' };
  return { ok: true };
}

export function DesktopOnlyModal({ reason, onClose }) {
  return (
    <div className="exam-modal-bg" role="dialog" aria-modal="true" aria-labelledby="dg-title">
      <div className="exam-modal">
        <header id="dg-title">This exam opens on a laptop or desktop only</header>
        <div className="content">
          {reason === 'small-window' ? (
            <p>
              Your browser window is too narrow for the exam screen. Maximise the window
              (at least {EXAM_MIN_WIDTH}px wide) and press Start again.
            </p>
          ) : (
            <p>
              Mock tests can only be taken on a <b>laptop or desktop</b>, because the real
              examination hall gives you a full-size screen — and practising on anything
              smaller builds the wrong habits.
            </p>
          )}
          <p style={{ marginBottom: 0 }}>
            You can do everything else here on your phone: read instructions, review
            solutions, and study your analysis. When you are ready to attempt the paper,
            open <b>this same website</b> on a computer and sign in with the same OTP login.
          </p>
        </div>
        <footer>
          <button className="primary" onClick={onClose}>Okay, got it</button>
        </footer>
      </div>
    </div>
  );
}
