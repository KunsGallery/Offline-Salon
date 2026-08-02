import React from 'react';
import { sessionThemeStyle } from '../../lib/colorPalette';

export default function HostShell({ session, children, aside }) {
  return (
    <div className="host-screen" style={sessionThemeStyle(session)}>
      <header className="host-topbar">
        <div>
          <p className="eyebrow">HOST DISPLAY</p>
          <h1>{session?.title || '세션 없음'}</h1>
        </div>
        <div className="host-stats">{aside}</div>
      </header>
      <main className="host-grid">{children}</main>
    </div>
  );
}
