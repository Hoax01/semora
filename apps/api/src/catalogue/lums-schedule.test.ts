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

  it('keeps all section rows before the next course code', () => {
    const catalogue = buildLumsCatalogue([
      [
        item('MKTG 201', 38, 271),
        item('Principles of Marketing', 89.73, 271),
        item('3', 204.67, 271),
        item('LEC 1', 244.9, 271),
        item('MW', 336.86, 271),
        item('9:30AM', 382.84, 271),
        item('10:45AM', 440.31, 271),
        item('Komal Zain', 486.29, 271),
        item('LEC 2', 244.9, 256),
        item('TR', 336.86, 256),
        item('3:30PM', 382.84, 256),
        item('4:45PM', 440.31, 256),
        item('Komal Zain', 486.29, 256),
        item('LEC 3', 244.9, 241),
        item('TR', 336.86, 241),
        item('9:30AM', 382.84, 241),
        item('10:45AM', 440.31, 241),
        item('Aaminah Zaman Malik', 486.29, 241),
        item('LEC 4', 244.9, 226),
        item('MW', 336.86, 226),
        item('11:00AM', 382.84, 226),
        item('12:15PM', 440.31, 226),
        item('Mahira Ilyas', 486.29, 226),
        item('LEC 5', 244.9, 211),
        item('TR', 336.86, 211),
        item('11:00AM', 382.84, 211),
        item('12:15PM', 440.31, 211),
        item('Saima Mujtaba Rana', 486.29, 211),
        item('MKTG 222', 38, 196),
        item('Retail Management', 89.73, 196),
        item('3', 204.67, 196),
        item('LEC 1', 244.9, 196),
        item('MW', 336.86, 196),
        item('2:00PM', 382.84, 196),
        item('3:15PM', 440.31, 196),
        item('Mahira Ilyas', 486.29, 196),
      ],
    ]);

    expect(catalogue.courses[0]?.sections.map((section) => section.sectionCode)).toEqual([
      'LEC 1',
      'LEC 2',
      'LEC 3',
      'LEC 4',
      'LEC 5',
    ]);
    expect(catalogue.courses[0]?.sections.map((section) => section.instructorDisplay)).toEqual([
      'Komal Zain',
      'Komal Zain',
      'Aaminah Zaman Malik',
      'Mahira Ilyas',
      'Saima Mujtaba Rana',
    ]);
  });
});
