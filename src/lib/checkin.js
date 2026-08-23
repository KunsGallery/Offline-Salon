export function createCheckinToken(seed = '') {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const suffix = String(seed || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `SALON-${suffix || random}-${random}`;
}

export function normalizeCheckinApplication(application, index = 0) {
  if (!application) return null;
  const id = String(application.id || application.applicationId || `application_${index + 1}`).trim();
  const name = String(application.name || application.nickname || '').trim();
  const checkinToken = String(application.checkinToken || application.token || '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    email: String(application.email || '').trim(),
    phoneLast4: String(application.phoneLast4 || '').trim(),
    ticketType: String(application.ticketType || '일반').trim(),
    status: ['approved', 'pending', 'cancelled'].includes(application.status) ? application.status : 'approved',
    checkinToken,
    source: String(application.source || (application.joinTokenHash ? 'join' : 'manual')).trim(),
    joinTokenHash: String(application.joinTokenHash || application.tokenHash || '').trim(),
    joinShortCode: String(application.joinShortCode || application.shortCode || '').trim(),
    joinSalonTitle: String(application.joinSalonTitle || application.salonTitle || '').trim(),
    joinEventDateTime: String(application.joinEventDateTime || application.eventDateTime || '').trim(),
    joinVenueName: String(application.joinVenueName || application.venueName || '').trim(),
    joinCheckedInAt: application.joinCheckedInAt || null,
    importedAt: application.importedAt || null,
    checkedIn: application.checkedIn === true,
    checkedInAt: application.checkedInAt || null,
    checkedInBy: application.checkedInBy || null,
    notes: String(application.notes || '').trim(),
    createdAt: application.createdAt || null,
    updatedAt: application.updatedAt || null,
  };
}

export function normalizeCheckinApplications(value) {
  return Array.isArray(value) ? value.map(normalizeCheckinApplication).filter(Boolean) : [];
}

export function parseCheckinPayload(value) {
  const raw = String(value || '').trim();
  if (!raw) return { raw, token: '', applicationId: '', isJoinPayload: false };
  try {
    const url = new URL(raw);
    const token = url.searchParams.get('token') || url.searchParams.get('checkinToken') || url.searchParams.get('pass') || '';
    const applicationId = url.searchParams.get('applicationId') || url.searchParams.get('application') || '';
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPath = pathParts.at(-1) || '';
    const host = url.hostname.toLowerCase();
    return {
      raw,
      token: token || (!applicationId ? lastPath : ''),
      applicationId: applicationId || (/^(app|application)[_-]/i.test(lastPath) ? lastPath : ''),
      isJoinPayload: host === 'join.unframe.kr' || host.endsWith('.join.unframe.kr') || pathParts.includes('check-in-token') || pathParts.includes('pass'),
    };
  } catch {
    return { raw, token: raw, applicationId: '', isJoinPayload: raw.length >= 32 && !raw.startsWith('SALON-') };
  }
}

export function findCheckinApplication(applications = [], payload = {}) {
  const token = String(payload.token || '').trim();
  const applicationId = String(payload.applicationId || '').trim();
  const raw = String(payload.raw || '').trim();
  const joinTokenHash = String(payload.joinTokenHash || payload.tokenHash || '').trim();
  return applications.find((application) =>
    (applicationId && application.id === applicationId) ||
    (joinTokenHash && application.joinTokenHash === joinTokenHash) ||
    (token && application.checkinToken === token) ||
    (raw && (application.checkinToken === raw || application.id === raw)),
  ) || null;
}

export function createCheckinApplicationFromJoinPass(pass = {}) {
  const now = new Date().toISOString();
  const tokenHash = String(pass.tokenHash || '').trim();
  if (!tokenHash) return null;
  return normalizeCheckinApplication({
    id: `join_${tokenHash.slice(0, 18)}`,
    name: pass.applicantDisplayName || '참가자',
    email: '',
    phoneLast4: '',
    ticketType: pass.salonTitle || 'Join QR',
    status: 'approved',
    checkinToken: '',
    source: 'join',
    joinTokenHash: tokenHash,
    joinShortCode: pass.shortCode || tokenHash.slice(0, 6).toUpperCase(),
    joinSalonTitle: pass.salonTitle || '',
    joinEventDateTime: pass.eventDateTime || '',
    joinVenueName: pass.venueName || '',
    joinCheckedInAt: pass.joinCheckedInAt || null,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export function checkinSummary(applications = []) {
  const approved = applications.filter((item) => item.status !== 'cancelled');
  const checkedIn = approved.filter((item) => item.checkedIn);
  return {
    registered: approved.length,
    checkedIn: checkedIn.length,
    waiting: Math.max(0, approved.length - checkedIn.length),
    cancelled: applications.filter((item) => item.status === 'cancelled').length,
  };
}

export function sortCheckinApplications(applications = []) {
  return [...applications].sort((a, b) => {
    if (a.checkedIn !== b.checkedIn) return Number(b.checkedIn) - Number(a.checkedIn);
    if (a.checkedInAt || b.checkedInAt) return new Date(b.checkedInAt || 0) - new Date(a.checkedInAt || 0);
    return String(a.name).localeCompare(String(b.name), 'ko-KR');
  });
}
