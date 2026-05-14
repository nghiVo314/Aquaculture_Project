const TOKEN_PATTERNS = {
  pondId: /\[POND:([^\]]+)\]/i,
  sensorId: /\[SENSOR:([^\]]+)\]/i,
  actuatorId: /\[ACTUATOR:([^\]]+)\]/i,
  type: /\[TYPE:([^\]]+)\]/i,
  severity: /\[SEVERITY:([^\]]+)\]/i,
};

function pickFirstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

export function parseWarningMeta(log = {}) {
  const text = String(log.mo_ta || '');
  const sensorId = pickFirstMatch(text, [TOKEN_PATTERNS.sensorId]);
  const actuatorId = pickFirstMatch(text, [TOKEN_PATTERNS.actuatorId]);
  const pondId = pickFirstMatch(text, [TOKEN_PATTERNS.pondId]);
  const type = pickFirstMatch(text, [TOKEN_PATTERNS.type]).toUpperCase();
  const severity = pickFirstMatch(text, [TOKEN_PATTERNS.severity]).toLowerCase() || 'warning';
  const isNoise = severity === 'ignore' || /type:offline|chưa có dữ liệu/i.test(text);

  const device = actuatorId || sensorId || log.device_id || '';
  const description = text
    .replace(/\[POND:[^\]]+\]\s*/i, '')
    .replace(/\[SENSOR:[^\]]+\]\s*/i, '')
    .replace(/\[ACTUATOR:[^\]]+\]\s*/i, '')
    .replace(/\[TYPE:[^\]]+\]\s*/i, '')
    .replace(/\[SEVERITY:[^\]]+\]\s*/i, '')
    .replace(/\s*\|\s*value=.*$/i, '')
    .trim();

  return {
    pondId,
    sensorId,
    actuatorId,
    device,
    type,
    severity: isNoise ? 'ignore' : severity,
    description,
    raw: text,
    areaText: pondId ? `Ao ${pondId}` : '-',
  };
}

export function dedupeWarnings(rows = []) {
  const seen = new Set();
  const deduped = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const meta = parseWarningMeta(row);
    const key = [
      meta.pondId || '',
      meta.sensorId || '',
      meta.actuatorId || '',
      meta.type || '',
      meta.description || String(row.mo_ta || '').trim()
    ].join('|').toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

export function getWarningSeverityLabel(severity) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return { label: 'Gấp', color: '#dc2626' };
  if (normalized === 'warning') return { label: 'Bình thường', color: '#16a34a' };
  if (normalized === 'caution') return { label: 'Chưa gấp', color: '#eab308' };
  return { label: 'Không rõ', color: '#94a3b8' };
}

export function toWorkerName(log = {}) {
  // First, try to use the assigned maintenance person (TenDangNhap from LEFT JOIN)
  if (log.TenDangNhap) {
    return log.TenDangNhap;
  }

  // If not found, try to extract from the description (for manual acks)
  const text = String(log.mo_ta || '');
  const handlerMatch = text.match(/Đã xử lý bởi User:\s*([^\)\]]+)/i);
  if (handlerMatch?.[1]) {
    return handlerMatch[1].trim();
  }

  return 'Hệ thống';
}
