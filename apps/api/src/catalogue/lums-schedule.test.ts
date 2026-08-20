import { describe, expect, it } from 'vitest';
import { buildLumsCatalogue, type PdfTextItem } from './lums-schedule.js';

function item(str: string, x: number, y: number): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

describe('LUMS schedule adapter', () => {
  it('parses wrapped titles, days, aliases, and duplicate source section labels', () => {
    const catalogue = buildLumsCatalogue([
      [
        item('CS 999', 38, 600),
        item('Advanced Topics in', 89.73, 603.5),
        item('Testing', 89.73, 596.5),
        item('3', 204.67, 600),
        item('LEC 1', 244.9, 600),
        item('16W', 290.88, 600),
        item('MW', 336.86, 600),
        item('12:30PM', 382.84, 600),
        item('1:45PM', 440.31, 600),
        item('Instructor One', 486.29, 600),
        item('LEC 1', 244.9, 580),
        item('16W', 290.88, 580),
        item('TR', 336.86, 580),
        item('2:00PM', 382.84, 580),
        item('3:15PM', 440.31, 580),
        item('Instructor Two', 486.29, 580),
        item('EE 999', 38, 500),
        item('Advanced Topics in Testing', 89.73, 500),
        item('3', 204.67, 500),
        item('w/ CS 999', 244.9, 500),
      ],
    ]);

    expect(catalogue.courses).toHaveLength(2);
    expect(catalogue.courses[0]).toMatchObject({
      courseCode: 'CS 999',
      title: 'Advanced Topics in Testing',
      creditHoursDefault: 3,
    });
    expect(catalogue.courses[0]?.sections.map((section) => section.sectionCode)).toEqual([
      'LEC 1',
      'LEC 1 (2)',
    ]);
    expect(catalogue.courses[0]?.sections[0]?.meetings.map((meeting) => meeting.dayOfWeek)).toEqual(
      ['MONDAY', 'WEDNESDAY'],
    );
    expect(catalogue.courses[1]?.sections).toEqual(catalogue.courses[0]?.sections);
  });
});
