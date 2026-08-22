const IGNORED_ROOT_FIELDS = new Set([
  'warnings',
  'conflicts',
  'fieldConfidences',
  'overallConfidence',
]);

export type ExtractionCorrection = {
  fieldPath: string;
  originalValue: string;
  correctedValue: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshot(value: unknown) {
  return value === undefined ? '__SEMORA_MISSING__' : JSON.stringify(value);
}

export function diffExtractionPayloads(original: unknown, corrected: unknown) {
  const corrections: ExtractionCorrection[] = [];

  function visit(before: unknown, after: unknown, path: string) {
    if (isRecord(before) && isRecord(after)) {
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of [...keys].sort()) {
        if (!path && IGNORED_ROOT_FIELDS.has(key)) continue;
        visit(before[key], after[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
      const length = Math.max(before.length, after.length);
      for (let index = 0; index < length; index += 1) {
        visit(before[index], after[index], `${path}[${index}]`);
      }
      return;
    }
    if (snapshot(before) === snapshot(after)) return;
    corrections.push({
      fieldPath: path || 'value',
      originalValue: snapshot(before),
      correctedValue: snapshot(after),
    });
  }

  visit(original, corrected, '');
  return corrections;
}
