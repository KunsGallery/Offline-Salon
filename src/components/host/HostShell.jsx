import React from 'react';
import { sessionThemeStyle } from '../../lib/colorPalette';

export default function HostShell({ session, children, aside, variant = '' }) {
  return (
    <div className={`host-screen ${variant ? `host-screen-${variant}` : ''}`} style={sessionThemeStyle(session)}>
      <header className="host-topbar">
        <div>
          <p className="eyebrow">HOST DISPLAY</p>
          <h1>{session?.title || '세션 없음'}</h1>
        </div>
        <div className="host-stats">{aside}</div>
      </header>
      <main className={`host-grid ${variant ? `host-grid-${variant}` : ''}`}>{children}</main>
    </div>
  );
}
