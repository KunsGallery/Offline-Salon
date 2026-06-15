import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRJoinCard({ sessionId, url }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const clientUrl = sessionId ? `${origin}/client/${encodeURIComponent(sessionId)}` : url || '';

  return (
    <section className="qr-card">
      <div className="qr-frame" aria-label="QR code">
        <QRCodeSVG value={clientUrl} size={228} bgColor="#ffffff" fgColor="#06090f" includeMargin />
      </div>
      <div className="stack gap-xs">
        <strong>휴대폰으로 QR을 스캔해 참여하세요</strong>
        <a className="link" href={clientUrl} target="_blank" rel="noreferrer">
          {clientUrl}
        </a>
      </div>
    </section>
  );
}
