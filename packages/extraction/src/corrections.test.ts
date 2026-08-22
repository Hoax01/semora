import { describe, expect, it } from 'vitest';
import { diffExtractionPayloads } from './corrections.js';

describe('extraction correction diffs', () => {
  it('records changed fields while ignoring derived validation metadata', () => {
    const corrections = diffExtractionPayloads(
      {
        courseIdentity: { instructors: ['Original'] },
        gradingScheme: { categories: [{ name: 'Assignments', weightPercentage: 20 }] },
        assessments: [{ title: 'Quiz 1', dueDate: null }],
        warnings: [{ code: 'OLD_WARNING' }],
        overallConfidence: 0.55,
      },
      {
        courseIdentity: { instructors: ['Corrected'] },
        gradingScheme: { categories: [{ name: 'Assignments', weightPercentage: 25 }] },
        assessments: [{ title: 'Quiz 1', dueDate: '2026-10-01' }],
        warnings: [{ code: 'NEW_WARNING' }],
        overallConfidence: 0.4,
      },
    );

    expect(corrections).toEqual([
      {
        fieldPath: 'assessments[0].dueDate',
        originalValue: 'null',
        correctedValue: '"2026-10-01"',
      },
      {
        fieldPath: 'courseIdentity.instructors[0]',
        originalValue: '"Original"',
        correctedValue: '"Corrected"',
      },
      {
        fieldPath: 'gradingScheme.categories[0].weightPercentage',
        originalValue: '20',
        correctedValue: '25',
      },
    ]);
  });

  it('captures added and removed array entries explicitly', () => {
    expect(diffExtractionPayloads({ assessments: [{ title: 'A' }] }, { assessments: [] })).toEqual([
      {
        fieldPath: 'assessments[0]',
        originalValue: '{"title":"A"}',
        correctedValue: '__SEMORA_MISSING__',
      },
    ]);
  });
});
