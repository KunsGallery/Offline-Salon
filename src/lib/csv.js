function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCsv(column.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => escapeCsv(typeof column.value === 'function' ? column.value(row) : row[column.key]))
        .join(','),
    )
    .join('\n');

  return [header, body].filter(Boolean).join('\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
