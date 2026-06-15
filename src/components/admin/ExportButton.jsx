import React from 'react';
import { downloadCsv, toCsv } from '../../lib/csv';
import { realtime } from '../../lib/realtime';
import { formatDateTime } from '../../lib/format';

export default function ExportButton({ session }) {
  const onExport = async () => {
    const latestSession = realtime.getSession(session.id) || session;
    const responses = await Promise.resolve(realtime.getAllResponses?.(session.id) || latestSession.responses || []);
    const rows = responses.map((response) => {
      const question = realtime.findSessionQuestion(session.id, response.questionId);
      return {
        sessionId: latestSession.id,
        questionId: response.questionId,
        questionTitle: question?.title || '',
        questionType: question?.type || '',
        nickname: response.nickname || '',
        participantId: response.participantId || '',
        value: Array.isArray(response.value) ? response.value.join('|') : response.value,
        hidden: response.hidden ? 'true' : 'false',
        createdAt: formatDateTime(response.createdAt),
      };
    });

    const csv = toCsv(rows, [
      { key: 'sessionId', label: 'sessionId' },
      { key: 'questionId', label: 'questionId' },
      { key: 'questionTitle', label: 'questionTitle' },
      { key: 'questionType', label: 'questionType' },
      { key: 'nickname', label: 'nickname' },
      { key: 'participantId', label: 'participantId' },
      { key: 'value', label: 'value' },
      { key: 'hidden', label: 'hidden' },
      { key: 'createdAt', label: 'createdAt' },
    ]);

    downloadCsv(`${latestSession.id}-responses.csv`, csv);
  };

  return (
    <button className="btn primary" type="button" onClick={onExport}>
      CSV Export
    </button>
  );
}
