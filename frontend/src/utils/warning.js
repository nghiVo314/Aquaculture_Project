const TOKEN_PATTERNS = {
  pondId: /\[POND:([^\]]+)\]/i,
  sensorId: /\[SENSOR:([^\]]+)\]/i,
  sensorType: /\[SENSOR_TYPE:([^\]]+)\]/i,
  type: /\[TYPE:([^\]]+)\]/i,
  severity: /\[SEVERITY:([^\]]+)\]/i,
  value: /\[VALUE:([^\]]+)\]/i,
  min: /\[MIN:([^\]]+)\]/i,
  max: /\[MAX:([^\]]+)\]/i,
  offlineMinutes: /\[OFFLINE_MINUTES:([^\]]+)\]/i,
};

const SEVERITY_META = {
  low: { label: 'Thấp', color: '#22c55e', rank: 1 },
  medium: { label: 'Trung bình', color: '#f59e0b', rank: 2 },
  warning: { label: 'Cảnh báo', color: '#f97316', rank: 3 },
  critical: { label: 'Nguy hiểm', color: '#dc2626', rank: 4 },
  unknown: { label: 'Không rõ', color: '#94a3b8', rank: 0 },
};

function pickFirstMatch(text, pattern) {
  const match = String(text || '').match(pattern);
  return match?.[1] || '';
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseWarningMeta(log = {}) {
  const text = String(log.mo_ta || '');
  const pondId = log.pond_id || log.ma_ao_nuoi || pickFirstMatch(text, TOKEN_PATTERNS.pondId);
  const sensorId = log.sensor_id || pickFirstMatch(text, TOKEN_PATTERNS.sensorId);
  const sensorType = log.sensor_type || pickFirstMatch(text, TOKEN_PATTERNS.sensorType);
  const type = String(log.alert_kind || pickFirstMatch(text, TOKEN_PATTERNS.type) || '').toUpperCase();
  const severity = String(log.severity || pickFirstMatch(text, TOKEN_PATTERNS.severity) || 'unknown').toLowerCase();
  const currentValue = parseNumber(log.current_value ?? pickFirstMatch(text, TOKEN_PATTERNS.value));
  const minValue = parseNumber(log.min_value ?? pickFirstMatch(text, TOKEN_PATTERNS.min));
  const maxValue = parseNumber(log.max_value ?? pickFirstMatch(text, TOKEN_PATTERNS.max));
  const offlineMinutes = parseNumber(log.offline_minutes ?? pickFirstMatch(text, TOKEN_PATTERNS.offlineMinutes));

  const description = String(log.description || log.alert_message || text.replace(/\[[A-Z_]+:[^\]]+\]\s*/gi, '').trim());

  return {
    pondId: pondId || '',
    sensorId: sensorId || '',
    sensorType: sensorType || '',
    device: sensorType || sensorId || '',
    type,
    severity,
    description,
    currentValue,
    minValue,
    maxValue,
    offlineMinutes,
    raw: text,
    areaText: pondId ? `Ao ${pondId}` : '-',
  };
}

export function normalizeAlert(log = {}) {
  const meta = parseWarningMeta(log);
  const severityInfo = getWarningSeverityLabel(meta.severity);

  return {
    ...log,
    meta,
    alertKey: log.alert_key || [meta.pondId, meta.sensorId, meta.type].filter(Boolean).join('|'),
    displayDevice: meta.device || meta.sensorId || '-',
    displayLocation: meta.areaText || '-',
    displayDescription: meta.description || String(log.mo_ta || ''),
    displayWorker: toWorkerName(log),
    severityLabel: severityInfo.label,
    severityColor: severityInfo.color,
    severityRank: severityInfo.rank,
    acknowledged: Boolean(log.acknowledged),
    changedAt: log.changed_at || log.thoi_gian_khoi_tao || null,
  };
}

export function normalizeAlertCollection(rows = []) {
  const byKey = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const normalized = normalizeAlert(row);
    const existing = byKey.get(normalized.alertKey);
    if (!existing) {
      byKey.set(normalized.alertKey, normalized);
      continue;
    }

    const existingTime = existing.changedAt ? new Date(existing.changedAt).getTime() : 0;
    const nextTime = normalized.changedAt ? new Date(normalized.changedAt).getTime() : 0;
    if (nextTime >= existingTime) {
      byKey.set(normalized.alertKey, normalized);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (b.severityRank !== a.severityRank) {
      return b.severityRank - a.severityRank;
    }

    const timeA = a.changedAt ? new Date(a.changedAt).getTime() : 0;
    const timeB = b.changedAt ? new Date(b.changedAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function dedupeWarnings(rows = []) {
  return normalizeAlertCollection(rows);
}

export function getWarningSeverityLabel(severity) {
  const normalized = String(severity || '').toLowerCase();
  return SEVERITY_META[normalized] || SEVERITY_META.unknown;
}

export function toWorkerName(log = {}) {
  if (log.worker_name) {
    return log.worker_name;
  }

  if (log.TenDangNhap) {
    return log.TenDangNhap;
  }

  const text = String(log.mo_ta || '');
  const handlerMatch = text.match(/Đã xử lý bởi User:\s*([^)\]]+)/i);
  if (handlerMatch?.[1]) {
    return handlerMatch[1].trim();
  }

  return 'Hệ thống';
}
