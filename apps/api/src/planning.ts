import type express from 'express';
import {
  analyzeCandidateScenario,
  analyzeCandidateSchedule,
  calculateCandidateComparison,
  calculateTotalCredits,
  detectTimetableClashes,
  resolveWorkloadProfile,
  type CandidateSemesterInput,
  type CandidateCourseInput,
  type CourseWorkloadProfile,
  type MeetingDay,
} from '@semora/semester-engine';
import { z } from 'zod';
import { prisma } from './db.js';
import { requireUserId } from './session.js';

const workspaceRequestSchema = z.object({
  academicTermId: z.string().trim().min(1),
});

const candidateNameSchema = z.string().trim().min(1).max(80);

const createCandidateSchema = z.object({
  name: candidateNameSchema,
});

const updateCandidateSchema = z
  .object({
    name: candidateNameSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isArchived !== undefined);

const selectionRequestSchema = z.object({
  sectionId: z.string().trim().min(1),
});

const commitmentCategories = [
  'TASHIP',
  'SOCIETY',
  'WORK',
  'RESEARCH',
  'GYM',
  'COMMUTE',
  'PERSONAL',
  'OTHER',
] as const;
const commitmentFlexibilities = ['HARD', 'SOFT', 'FLEXIBLE'] as const;
const meetingDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const commitmentMeetingSchema = z.object({
  dayOfWeek: z.enum(meetingDays),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
});
const commitmentEventRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    estimatedEffortHours: z.number().finite().min(0).max(168).nullable().optional(),
    flexibilityOverride: z.enum(commitmentFlexibilities).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (new Date(value.startAt).getTime() >= new Date(value.endAt).getTime()) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'Event must end after it starts.',
      });
    }
  });
const commitmentRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    category: z.enum(commitmentCategories),
    weeklyEffortHours: z.number().finite().min(0).max(168),
    flexibility: z.enum(commitmentFlexibilities),
    meetings: z.array(commitmentMeetingSchema).max(7),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, meeting] of value.meetings.entries()) {
      if (meeting.startTime >= meeting.endTime) {
        context.addIssue({
          code: 'custom',
          path: ['meetings', index, 'endTime'],
          message: 'Meeting must end after it starts.',
        });
      }
      const key = `${meeting.dayOfWeek}:${meeting.startTime}:${meeting.endTime}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['meetings', index],
          message: 'Recurring meetings must be unique.',
        });
      }
      seen.add(key);
    }
  });

const preferenceValueSchema = z.number().finite().min(0).max(1);
const preferenceUpdateSchema = z
  .object({
    workloadPriority: preferenceValueSchema.optional(),
    schedulePriority: preferenceValueSchema.optional(),
    careerPriority: preferenceValueSchema.optional(),
    interestPriority: preferenceValueSchema.optional(),
    gradeSafetyPriority: preferenceValueSchema.optional(),
    projectPreference: preferenceValueSchema.optional(),
    examPreference: preferenceValueSchema.optional(),
    continuousAssessmentPreference: preferenceValueSchema.optional(),
    freeDayPriority: preferenceValueSchema.optional(),
    earlyClassAversion: preferenceValueSchema.optional(),
    lateClassAversion: preferenceValueSchema.optional(),
    maxPreferredHardCourses: z.number().int().min(0).max(20).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const scenarioSchema = z
  .object({
    replaceSelection: z
      .object({
        selectionId: z.string().trim().min(1),
        sectionId: z.string().trim().min(1),
      })
      .optional(),
    addSectionId: z.string().trim().min(1).optional(),
    removeSelectionId: z.string().trim().min(1).optional(),
    removeCommitmentId: z.string().trim().min(1).optional(),
    preferences: preferenceUpdateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const coursePreferenceUpdateSchema = z
  .object({
    interestScore: preferenceValueSchema.nullable().optional(),
    careerRelevanceScore: preferenceValueSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const workloadDimensionSchema = z.number().finite().min(0).max(10).nullable().optional();
const workloadProfileUpdateSchema = z
  .object({
    overallIntensity: workloadDimensionSchema,
    continuousWorkload: workloadDimensionSchema,
    assignmentIntensity: workloadDimensionSchema,
    quizIntensity: workloadDimensionSchema,
    projectIntensity: workloadDimensionSchema,
    examIntensity: workloadDimensionSchema,
    labIntensity: workloadDimensionSchema,
    readingIntensity: workloadDimensionSchema,
    scheduleBurden: workloadDimensionSchema,
    assessmentFragmentation: workloadDimensionSchema,
    estimatedWeeklyHours: z.number().finite().min(0).max(168).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const selectionInclude = {
  section: {
    include: {
      courseOffering: { include: { course: true } },
      meetings: true,
    },
  },
} as const;

const activeCourseSelectionInclude = {
  section: selectionInclude.section,
  state: {
    include: {
      outlineDocument: {
        include: {
          extractionJobs: {
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            include: { verification: true },
          },
        },
      },
    },
  },
} as const;

const commitmentInclude = {
  meetings: true,
  events: { orderBy: { startAt: 'asc' as const } },
} as const;

const workspaceInclude = {
  academicTerm: { include: { university: true } },
  preferences: true,
  coursePreferences: true,
  workloadProfiles: true,
  commitments: {
    include: commitmentInclude,
    orderBy: { createdAt: 'asc' as const },
  },
  candidates: {
    where: { isArchived: false },
    include: {
      _count: { select: { selections: true } },
      selections: { include: selectionInclude },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  activeCourseSelections: {
    where: { status: 'ACTIVE' as const },
    include: activeCourseSelectionInclude,
    orderBy: { addedAt: 'asc' as const },
  },
} as const;

const activeWorkspaceValidationInclude = {
  preferences: true,
  coursePreferences: true,
  workloadProfiles: true,
  commitments: {
    include: { meetings: true },
    orderBy: { createdAt: 'asc' as const },
  },
  activeCourseSelections: {
    where: { status: 'ACTIVE' as const },
    include: activeCourseSelectionInclude,
    orderBy: { addedAt: 'asc' as const },
  },
} as const;

type SelectionRecord = {
  id: string;
  sectionId: string;
  section: {
    id: string;
    sectionCode: string;
    capacity: number | null;
    instructorDisplay: string | null;
    meetings: Array<{
      dayOfWeek: string;
      startTime: Date;
      endTime: Date;
      meetingType: string;
      location: string | null;
    }>;
    courseOffering: {
      id: string;
      creditHours: { toString(): string };
      course: { courseCode: string; title: string };
    };
  };
};

type CandidateRecord = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { selections: number };
  selections?: SelectionRecord[];
};

type ActiveCourseSelectionRecord = {
  id: string;
  sectionId: string;
  addedAt: Date;
  droppedAt: Date | null;
  status: string;
  state: {
    id: string;
    dataCompleteness: { toString(): string };
    dataConfidence: { toString(): string };
    instructorDisplay: string | null;
    outlineDocument: {
      id: string;
      originalFilename: string;
      extractionJobs: Array<{
        id: string;
        status: string;
        verification: { verificationState: string } | null;
      }>;
    } | null;
  } | null;
  section: SelectionRecord['section'];
};

type CommitmentRecord = {
  id: string;
  name: string;
  category: string;
  weeklyEffortHours: { toString(): string };
  flexibility: string;
  meetings: Array<{
    dayOfWeek: string;
    startTime: Date;
    endTime: Date;
  }>;
  events?: Array<CommitmentEventRecord>;
};

type CommitmentEventRecord = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  estimatedEffortHours: { toString(): string } | null;
  flexibilityOverride: string | null;
};

type PreferencesRecord = {
  id: string;
  updatedAt: Date;
  workloadPriority: { toString(): string };
  schedulePriority: { toString(): string };
  careerPriority: { toString(): string };
  interestPriority: { toString(): string };
  gradeSafetyPriority: { toString(): string };
  projectPreference: { toString(): string };
  examPreference: { toString(): string };
  continuousAssessmentPreference: { toString(): string };
  freeDayPriority: { toString(): string };
  earlyClassAversion: { toString(): string };
  lateClassAversion: { toString(): string };
  maxPreferredHardCourses: number | null;
};

type WorkloadProfileRecord = {
  id: string;
  courseOfferingId: string;
  sectionId: string | null;
  overallIntensity: { toString(): string } | null;
  continuousWorkload: { toString(): string } | null;
  assignmentIntensity: { toString(): string } | null;
  quizIntensity: { toString(): string } | null;
  projectIntensity: { toString(): string } | null;
  examIntensity: { toString(): string } | null;
  labIntensity: { toString(): string } | null;
  readingIntensity: { toString(): string } | null;
  scheduleBurden: { toString(): string } | null;
  assessmentFragmentation: { toString(): string } | null;
  estimatedWeeklyHours: { toString(): string } | null;
  confidence: { toString(): string };
  sourceType: string;
};

type CoursePreferenceRecord = {
  id: string;
  courseOfferingId: string;
  interestScore: { toString(): string } | null;
  careerRelevanceScore: { toString(): string } | null;
  manualDifficultyEstimate: { toString(): string } | null;
  manualNotes: string | null;
};

type WorkspaceRecord = {
  id: string;
  state: string;
  lockedCandidateSemesterId: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  academicTerm: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    university: { id: string; name: string; shortName: string };
  };
  preferences: PreferencesRecord | null;
  coursePreferences: CoursePreferenceRecord[];
  workloadProfiles: WorkloadProfileRecord[];
  commitments: CommitmentRecord[];
  candidates: CandidateRecord[];
  activeCourseSelections: ActiveCourseSelectionRecord[];
};

function serializeCandidate(candidate: CandidateRecord) {
  const selections = candidate.selections ?? [];
  const credits = calculateTotalCredits(
    selections.map((selection) => Number(selection.section.courseOffering.creditHours)),
  );

  return {
    id: candidate.id,
    name: candidate.name,
    isArchived: candidate.isArchived,
    selectionCount: candidate._count.selections,
    credits,
    selections: selections.map(serializeSelection),
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

function formatTime(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function serializeSelection(selection: SelectionRecord) {
  return {
    id: selection.id,
    sectionId: selection.section.id,
    sectionCode: selection.section.sectionCode,
    capacity: selection.section.capacity,
    instructor: selection.section.instructorDisplay,
    courseOfferingId: selection.section.courseOffering.id,
    courseCode: selection.section.courseOffering.course.courseCode,
    title: selection.section.courseOffering.course.title,
    credits: Number(selection.section.courseOffering.creditHours),
    meetings: selection.section.meetings.map((meeting) => ({
      day: meeting.dayOfWeek,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime),
      type: meeting.meetingType,
      location: meeting.location,
    })),
  };
}

function serializeActiveCourseSelection(selection: ActiveCourseSelectionRecord) {
  return {
    ...serializeSelection({
      id: selection.id,
      sectionId: selection.sectionId,
      section: {
        ...selection.section,
        instructorDisplay:
          selection.state?.instructorDisplay ?? selection.section.instructorDisplay,
      },
    }),
    status: selection.status,
    addedAt: selection.addedAt.toISOString(),
    droppedAt: selection.droppedAt?.toISOString() ?? null,
    state: selection.state
      ? {
          id: selection.state.id,
          dataCompleteness: Number(selection.state.dataCompleteness),
          dataConfidence: Number(selection.state.dataConfidence),
          outline: selection.state.outlineDocument
            ? {
                documentId: selection.state.outlineDocument.id,
                filename: selection.state.outlineDocument.originalFilename,
                extractionJob: selection.state.outlineDocument.extractionJobs[0]
                  ? {
                      id: selection.state.outlineDocument.extractionJobs[0].id,
                      status: selection.state.outlineDocument.extractionJobs[0].status,
                      verificationState:
                        selection.state.outlineDocument.extractionJobs[0].verification
                          ?.verificationState ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
  };
}

function serializeCommitment(commitment: CommitmentRecord) {
  return {
    id: commitment.id,
    name: commitment.name,
    category: commitment.category,
    weeklyEffortHours: Number(commitment.weeklyEffortHours),
    flexibility: commitment.flexibility as 'HARD' | 'SOFT' | 'FLEXIBLE',
    meetings: commitment.meetings.map((meeting) => ({
      day: meeting.dayOfWeek,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime),
    })),
    events: (commitment.events ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      estimatedEffortHours: decimalOrNull(event.estimatedEffortHours),
      flexibilityOverride: event.flexibilityOverride as 'HARD' | 'SOFT' | 'FLEXIBLE' | null,
    })),
  };
}

function serializePreferences(preferences: PreferencesRecord) {
  return {
    id: preferences.id,
    updatedAt: preferences.updatedAt.toISOString(),
    workloadPriority: Number(preferences.workloadPriority),
    schedulePriority: Number(preferences.schedulePriority),
    careerPriority: Number(preferences.careerPriority),
    interestPriority: Number(preferences.interestPriority),
    gradeSafetyPriority: Number(preferences.gradeSafetyPriority),
    projectPreference: Number(preferences.projectPreference),
    examPreference: Number(preferences.examPreference),
    continuousAssessmentPreference: Number(preferences.continuousAssessmentPreference),
    freeDayPriority: Number(preferences.freeDayPriority),
    earlyClassAversion: Number(preferences.earlyClassAversion),
    lateClassAversion: Number(preferences.lateClassAversion),
    maxPreferredHardCourses: preferences.maxPreferredHardCourses,
  };
}

function decimalOrNull(value: { toString(): string } | null) {
  return value === null ? null : Number(value);
}

function serializeWorkloadProfile(profile: WorkloadProfileRecord) {
  return {
    id: profile.id,
    courseOfferingId: profile.courseOfferingId,
    sectionId: profile.sectionId,
    overallIntensity: decimalOrNull(profile.overallIntensity),
    continuousWorkload: decimalOrNull(profile.continuousWorkload),
    assignmentIntensity: decimalOrNull(profile.assignmentIntensity),
    quizIntensity: decimalOrNull(profile.quizIntensity),
    projectIntensity: decimalOrNull(profile.projectIntensity),
    examIntensity: decimalOrNull(profile.examIntensity),
    labIntensity: decimalOrNull(profile.labIntensity),
    readingIntensity: decimalOrNull(profile.readingIntensity),
    scheduleBurden: decimalOrNull(profile.scheduleBurden),
    assessmentFragmentation: decimalOrNull(profile.assessmentFragmentation),
    estimatedWeeklyHours: decimalOrNull(profile.estimatedWeeklyHours),
    confidence: Number(profile.confidence),
    source: profile.sourceType,
  };
}

function serializeCoursePreference(preference: CoursePreferenceRecord) {
  return {
    id: preference.id,
    courseOfferingId: preference.courseOfferingId,
    interestScore: decimalOrNull(preference.interestScore),
    careerRelevanceScore: decimalOrNull(preference.careerRelevanceScore),
    manualDifficultyEstimate: decimalOrNull(preference.manualDifficultyEstimate),
    manualNotes: preference.manualNotes,
  };
}

function commitmentMeetingData(meeting: z.infer<typeof commitmentMeetingSchema>) {
  return {
    dayOfWeek: meeting.dayOfWeek,
    startTime: new Date(`1970-01-01T${meeting.startTime}:00.000Z`),
    endTime: new Date(`1970-01-01T${meeting.endTime}:00.000Z`),
  };
}

function serializeWorkspace(workspace: WorkspaceRecord) {
  return {
    id: workspace.id,
    state: workspace.state,
    lockedCandidateSemesterId: workspace.lockedCandidateSemesterId,
    lockedAt: workspace.lockedAt?.toISOString() ?? null,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    term: {
      id: workspace.academicTerm.id,
      name: workspace.academicTerm.name,
      startDate: workspace.academicTerm.startDate.toISOString().slice(0, 10),
      endDate: workspace.academicTerm.endDate.toISOString().slice(0, 10),
      university: workspace.academicTerm.university,
    },
    preferences: workspace.preferences ? serializePreferences(workspace.preferences) : null,
    coursePreferences: workspace.coursePreferences.map(serializeCoursePreference),
    workloadProfiles: workspace.workloadProfiles.map(serializeWorkloadProfile),
    commitments: workspace.commitments.map(serializeCommitment),
    candidates: workspace.candidates.map(serializeCandidate),
    activeCourseSelections: workspace.activeCourseSelections.map(serializeActiveCourseSelection),
  };
}

function validationError(response: express.Response, details: unknown) {
  response.status(400).json({ error: 'VALIDATION_ERROR', details });
}

function conflictError(response: express.Response, error: string) {
  response.status(409).json({ error });
}

class CandidateSelectionConflict extends Error {}

class LockWorkflowConflict extends Error {}

class ActiveCourseConflict extends Error {}

async function loadOwnedWorkspace(workspaceId: string, userId: string) {
  return prisma?.semesterWorkspace.findFirst({
    where: { id: workspaceId, userId },
    include: workspaceInclude,
  });
}

async function loadOwnedCandidate(candidateId: string, userId: string) {
  return prisma?.candidateSemester.findFirst({
    where: { id: candidateId, workspace: { userId } },
    include: {
      _count: { select: { selections: true } },
      selections: { include: selectionInclude },
    },
  });
}

async function loadOwnedSelection(selectionId: string, userId: string) {
  return prisma?.candidateCourseSelection.findFirst({
    where: { id: selectionId, candidateSemester: { workspace: { userId } } },
    include: {
      candidateSemester: { select: { id: true, workspaceId: true } },
      ...selectionInclude,
    },
  });
}

async function loadSectionForWorkspace(sectionId: string, academicTermId: string) {
  return prisma?.section.findFirst({
    where: { id: sectionId, courseOffering: { academicTermId } },
    include: {
      courseOffering: { include: { course: true } },
      meetings: true,
    },
  });
}

async function loadOwnedActiveSelection(selectionId: string, userId: string) {
  return prisma?.activeCourseSelection.findFirst({
    where: { id: selectionId, status: 'ACTIVE', workspace: { userId } },
    include: {
      workspace: { select: { id: true, userId: true, academicTermId: true, state: true } },
      ...activeCourseSelectionInclude,
    },
  });
}

async function loadOwnedCandidateForValidation(candidateId: string, userId: string) {
  return prisma?.candidateSemester.findFirst({
    where: { id: candidateId, workspace: { userId } },
    include: {
      selections: { include: selectionInclude },
      workspace: {
        select: {
          id: true,
          academicTermId: true,
          preferences: true,
          coursePreferences: true,
          workloadProfiles: true,
          commitments: {
            include: { meetings: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
}

type AnalysisWorkspace = {
  preferences: PreferencesRecord | null;
  coursePreferences: CoursePreferenceRecord[];
  workloadProfiles: WorkloadProfileRecord[];
  commitments: CommitmentRecord[];
};

type AnalysisSection = {
  sectionCode: string;
  meetings: Array<{
    dayOfWeek: string;
    startTime: Date;
    endTime: Date;
    meetingType: string;
  }>;
  courseOffering: {
    id: string;
    creditHours: { toString(): string };
    course: { courseCode: string; title: string };
  };
};

function candidateCourseInputFromSection(
  selectionId: string,
  section: AnalysisSection,
  workspace: AnalysisWorkspace,
): CandidateCourseInput {
  const courseOfferingId = section.courseOffering.id;
  const meetings = section.meetings.map((meeting) => ({
    dayOfWeek: meeting.dayOfWeek as MeetingDay,
    startTime: formatTime(meeting.startTime),
    endTime: formatTime(meeting.endTime),
    meetingType: meeting.meetingType as 'LECTURE' | 'LAB' | 'TUTORIAL' | 'SEMINAR' | 'OTHER',
  }));
  const stored = workspace.workloadProfiles.find(
    (profile) => profile.courseOfferingId === courseOfferingId,
  );
  const coursePreference = workspace.coursePreferences.find(
    (preference) => preference.courseOfferingId === courseOfferingId,
  );

  return {
    id: selectionId,
    courseOfferingId,
    courseCode: section.courseOffering.course.courseCode,
    courseTitle: section.courseOffering.course.title,
    creditHours: Number(section.courseOffering.creditHours),
    sectionCode: section.sectionCode,
    meetings,
    interestScore: decimalOrNull(coursePreference?.interestScore ?? null),
    careerRelevanceScore: decimalOrNull(coursePreference?.careerRelevanceScore ?? null),
    ...(stored
      ? {
          workloadProfile: resolveWorkloadProfile(
            {
              creditHours: Number(section.courseOffering.creditHours),
              meetings,
            },
            {
              overallIntensity: decimalOrNull(stored.overallIntensity),
              continuousWorkload: decimalOrNull(stored.continuousWorkload),
              assignmentIntensity: decimalOrNull(stored.assignmentIntensity),
              quizIntensity: decimalOrNull(stored.quizIntensity),
              projectIntensity: decimalOrNull(stored.projectIntensity),
              examIntensity: decimalOrNull(stored.examIntensity),
              labIntensity: decimalOrNull(stored.labIntensity),
              readingIntensity: decimalOrNull(stored.readingIntensity),
              scheduleBurden: decimalOrNull(stored.scheduleBurden),
              assessmentFragmentation: decimalOrNull(stored.assessmentFragmentation),
              estimatedWeeklyHours: decimalOrNull(stored.estimatedWeeklyHours),
              confidence: Number(stored.confidence),
              source: stored.sourceType as
                'STRUCTURAL_ESTIMATE' | 'USER_ESTIMATE' | 'VERIFIED_OUTLINE',
            },
          ),
        }
      : {}),
  };
}

type SemesterInputSelection = {
  id: string;
  section: AnalysisSection;
};

function semesterPreferencesInput(preferences: PreferencesRecord | null) {
  return preferences
    ? {
        workloadPriority: Number(preferences.workloadPriority),
        schedulePriority: Number(preferences.schedulePriority),
        careerPriority: Number(preferences.careerPriority),
        interestPriority: Number(preferences.interestPriority),
        gradeSafetyPriority: Number(preferences.gradeSafetyPriority),
        projectPreference: Number(preferences.projectPreference),
        examPreference: Number(preferences.examPreference),
        continuousAssessmentPreference: Number(preferences.continuousAssessmentPreference),
        freeDayPriority: Number(preferences.freeDayPriority),
        earlyClassAversion: Number(preferences.earlyClassAversion),
        lateClassAversion: Number(preferences.lateClassAversion),
        maxPreferredHardCourses: preferences.maxPreferredHardCourses,
      }
    : undefined;
}

function semesterCommitmentsInput(commitments: CommitmentRecord[]) {
  return commitments.map((commitment) => ({
    id: commitment.id,
    name: commitment.name,
    flexibility: commitment.flexibility as 'HARD' | 'SOFT' | 'FLEXIBLE',
    weeklyEffortHours: Number(commitment.weeklyEffortHours),
    meetings: commitment.meetings.map((meeting) => ({
      dayOfWeek: meeting.dayOfWeek as MeetingDay,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime),
    })),
  }));
}

function semesterInputFromSelections(
  candidateId: string,
  selections: SemesterInputSelection[],
  workspace: AnalysisWorkspace,
): CandidateSemesterInput {
  const preferences = semesterPreferencesInput(workspace.preferences);

  return {
    candidateId,
    courses: selections.map((selection) =>
      candidateCourseInputFromSection(selection.id, selection.section, workspace),
    ),
    commitments: semesterCommitmentsInput(workspace.commitments),
    ...(preferences ? { preferences } : {}),
  };
}

function candidateSemesterInput(
  candidate: NonNullable<Awaited<ReturnType<typeof loadOwnedCandidateForValidation>>>,
): CandidateSemesterInput {
  return semesterInputFromSelections(candidate.id, candidate.selections, candidate.workspace);
}

function analyzeCandidateTimetable(
  candidate: NonNullable<Awaited<ReturnType<typeof loadOwnedCandidateForValidation>>>,
) {
  return detectTimetableClashes(candidateSemesterInput(candidate));
}

export function registerPlanningRoutes(app: express.Express) {
  app.get('/api/terms', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    if (!(await requireUserId(request, response))) return;

    const universities = await prisma.university.findMany({
      include: {
        terms: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    response.status(200).json({
      universities: universities.map((university) => ({
        id: university.id,
        name: university.name,
        shortName: university.shortName,
        terms: university.terms.map((term) => ({
          id: term.id,
          name: term.name,
          startDate: term.startDate.toISOString().slice(0, 10),
          endDate: term.endDate.toISOString().slice(0, 10),
          status: term.status,
        })),
      })),
    });
  });

  app.get('/api/workspaces', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspaces = await prisma.semesterWorkspace.findMany({
      where: { userId, state: { not: 'ARCHIVED' } },
      include: workspaceInclude,
      orderBy: { academicTerm: { startDate: 'desc' } },
    });

    response.status(200).json({ workspaces: workspaces.map(serializeWorkspace) });
  });

  app.post('/api/workspaces', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = workspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const term = await prisma.academicTerm.findUnique({
      where: { id: parsed.data.academicTermId },
      select: { id: true },
    });
    if (!term) {
      response.status(404).json({ error: 'TERM_NOT_FOUND' });
      return;
    }

    const workspace = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.semesterWorkspace.upsert({
        where: {
          userId_academicTermId: { userId, academicTermId: parsed.data.academicTermId },
        },
        update: {},
        create: { userId, academicTermId: parsed.data.academicTermId },
      });

      await transaction.semesterPreferences.upsert({
        where: { workspaceId: saved.id },
        update: {},
        create: { workspaceId: saved.id },
      });

      return transaction.semesterWorkspace.findUniqueOrThrow({
        where: { id: saved.id },
        include: workspaceInclude,
      });
    });

    response.status(200).json({ workspace: serializeWorkspace(workspace) });
  });

  app.get('/api/workspaces/:workspaceId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspace = await loadOwnedWorkspace(request.params.workspaceId, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    response.status(200).json({ workspace: serializeWorkspace(workspace) });
  });

  app.patch('/api/workspaces/:workspaceId/preferences', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = preferenceUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const workspace = await loadOwnedWorkspace(request.params.workspaceId, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const preferenceData: {
      workloadPriority?: number;
      schedulePriority?: number;
      careerPriority?: number;
      interestPriority?: number;
      gradeSafetyPriority?: number;
      projectPreference?: number;
      examPreference?: number;
      continuousAssessmentPreference?: number;
      freeDayPriority?: number;
      earlyClassAversion?: number;
      lateClassAversion?: number;
      maxPreferredHardCourses?: number | null;
    } = {};
    if (parsed.data.workloadPriority !== undefined)
      preferenceData.workloadPriority = parsed.data.workloadPriority;
    if (parsed.data.schedulePriority !== undefined)
      preferenceData.schedulePriority = parsed.data.schedulePriority;
    if (parsed.data.careerPriority !== undefined)
      preferenceData.careerPriority = parsed.data.careerPriority;
    if (parsed.data.interestPriority !== undefined)
      preferenceData.interestPriority = parsed.data.interestPriority;
    if (parsed.data.gradeSafetyPriority !== undefined)
      preferenceData.gradeSafetyPriority = parsed.data.gradeSafetyPriority;
    if (parsed.data.projectPreference !== undefined)
      preferenceData.projectPreference = parsed.data.projectPreference;
    if (parsed.data.examPreference !== undefined)
      preferenceData.examPreference = parsed.data.examPreference;
    if (parsed.data.continuousAssessmentPreference !== undefined)
      preferenceData.continuousAssessmentPreference = parsed.data.continuousAssessmentPreference;
    if (parsed.data.freeDayPriority !== undefined)
      preferenceData.freeDayPriority = parsed.data.freeDayPriority;
    if (parsed.data.earlyClassAversion !== undefined)
      preferenceData.earlyClassAversion = parsed.data.earlyClassAversion;
    if (parsed.data.lateClassAversion !== undefined)
      preferenceData.lateClassAversion = parsed.data.lateClassAversion;
    if (parsed.data.maxPreferredHardCourses !== undefined)
      preferenceData.maxPreferredHardCourses = parsed.data.maxPreferredHardCourses;
    const preferences = await prisma.semesterPreferences.upsert({
      where: { workspaceId: workspace.id },
      update: preferenceData,
      create: { workspaceId: workspace.id, ...preferenceData },
    });
    response.status(200).json({ preferences: serializePreferences(preferences) });
  });

  app.patch(
    '/api/workspaces/:workspaceId/course-preferences/:courseOfferingId',
    async (request, response) => {
      if (!prisma) {
        response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
        return;
      }
      const userId = await requireUserId(request, response);
      if (!userId) return;

      const parsed = coursePreferenceUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        validationError(response, parsed.error.flatten());
        return;
      }

      const workspace = await prisma.semesterWorkspace.findFirst({
        where: { id: request.params.workspaceId, userId },
        select: { id: true, academicTermId: true },
      });
      if (!workspace) {
        response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
        return;
      }

      const offering = await prisma.courseOffering.findFirst({
        where: { id: request.params.courseOfferingId, academicTermId: workspace.academicTermId },
        select: { id: true },
      });
      if (!offering) {
        response.status(404).json({ error: 'COURSE_OFFERING_NOT_FOUND' });
        return;
      }

      const values = parsed.data;
      const update: {
        interestScore?: number | null;
        careerRelevanceScore?: number | null;
      } = {};
      if (values.interestScore !== undefined) update.interestScore = values.interestScore;
      if (values.careerRelevanceScore !== undefined) {
        update.careerRelevanceScore = values.careerRelevanceScore;
      }

      const preference = await prisma.userCoursePreference.upsert({
        where: {
          workspaceId_courseOfferingId: {
            workspaceId: workspace.id,
            courseOfferingId: offering.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          courseOfferingId: offering.id,
          interestScore: values.interestScore ?? null,
          careerRelevanceScore: values.careerRelevanceScore ?? null,
        },
        update,
      });

      response.status(200).json({ coursePreference: serializeCoursePreference(preference) });
    },
  );

  app.delete(
    '/api/workspaces/:workspaceId/course-preferences/:courseOfferingId',
    async (request, response) => {
      if (!prisma) {
        response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
        return;
      }
      const userId = await requireUserId(request, response);
      if (!userId) return;

      const workspace = await prisma.semesterWorkspace.findFirst({
        where: { id: request.params.workspaceId, userId },
        select: { id: true, academicTermId: true },
      });
      if (!workspace) {
        response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
        return;
      }

      const preference = await prisma.userCoursePreference.findFirst({
        where: {
          workspaceId: workspace.id,
          courseOfferingId: request.params.courseOfferingId,
          courseOffering: { academicTermId: workspace.academicTermId },
        },
        select: { id: true },
      });
      if (!preference) {
        response.status(404).json({ error: 'COURSE_PREFERENCE_NOT_FOUND' });
        return;
      }

      await prisma.userCoursePreference.delete({ where: { id: preference.id } });
      response.status(200).json({ courseOfferingId: request.params.courseOfferingId });
    },
  );

  app.patch(
    '/api/workspaces/:workspaceId/workload-profiles/:courseOfferingId',
    async (request, response) => {
      if (!prisma) {
        response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
        return;
      }
      const userId = await requireUserId(request, response);
      if (!userId) return;

      const parsed = workloadProfileUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        validationError(response, parsed.error.flatten());
        return;
      }

      const workspace = await prisma.semesterWorkspace.findFirst({
        where: { id: request.params.workspaceId, userId },
        select: { id: true, academicTermId: true },
      });
      if (!workspace) {
        response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
        return;
      }

      const offering = await prisma.courseOffering.findFirst({
        where: { id: request.params.courseOfferingId, academicTermId: workspace.academicTermId },
        select: { id: true },
      });
      if (!offering) {
        response.status(404).json({ error: 'COURSE_OFFERING_NOT_FOUND' });
        return;
      }

      const values = parsed.data;
      const profile = await prisma.courseWorkloadProfile.upsert({
        where: {
          workspaceId_courseOfferingId: {
            workspaceId: workspace.id,
            courseOfferingId: offering.id,
          },
        },
        create: {
          workspaceId: workspace.id,
          courseOfferingId: offering.id,
          sourceType: 'USER_ESTIMATE',
          confidence: 0.8,
          overallIntensity: values.overallIntensity ?? null,
          continuousWorkload: values.continuousWorkload ?? null,
          assignmentIntensity: values.assignmentIntensity ?? null,
          quizIntensity: values.quizIntensity ?? null,
          projectIntensity: values.projectIntensity ?? null,
          examIntensity: values.examIntensity ?? null,
          labIntensity: values.labIntensity ?? null,
          readingIntensity: values.readingIntensity ?? null,
          scheduleBurden: values.scheduleBurden ?? null,
          assessmentFragmentation: values.assessmentFragmentation ?? null,
          estimatedWeeklyHours: values.estimatedWeeklyHours ?? null,
        },
        update: {
          sourceType: 'USER_ESTIMATE',
          confidence: 0.8,
          overallIntensity: values.overallIntensity ?? null,
          continuousWorkload: values.continuousWorkload ?? null,
          assignmentIntensity: values.assignmentIntensity ?? null,
          quizIntensity: values.quizIntensity ?? null,
          projectIntensity: values.projectIntensity ?? null,
          examIntensity: values.examIntensity ?? null,
          labIntensity: values.labIntensity ?? null,
          readingIntensity: values.readingIntensity ?? null,
          scheduleBurden: values.scheduleBurden ?? null,
          assessmentFragmentation: values.assessmentFragmentation ?? null,
          estimatedWeeklyHours: values.estimatedWeeklyHours ?? null,
        },
      });

      response.status(200).json({ workloadProfile: serializeWorkloadProfile(profile) });
    },
  );

  app.delete(
    '/api/workspaces/:workspaceId/workload-profiles/:courseOfferingId',
    async (request, response) => {
      if (!prisma) {
        response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
        return;
      }
      const userId = await requireUserId(request, response);
      if (!userId) return;

      const profile = await prisma.courseWorkloadProfile.findFirst({
        where: {
          workspaceId: request.params.workspaceId,
          courseOfferingId: request.params.courseOfferingId,
          workspace: { userId },
        },
        select: { id: true },
      });
      if (!profile) {
        response.status(404).json({ error: 'WORKLOAD_PROFILE_NOT_FOUND' });
        return;
      }

      await prisma.courseWorkloadProfile.delete({ where: { id: profile.id } });
      response.status(200).json({ courseOfferingId: request.params.courseOfferingId });
    },
  );

  app.post('/api/workspaces/:workspaceId/commitments', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = commitmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    if (!(await loadOwnedWorkspace(request.params.workspaceId, userId))) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const commitment = await prisma.commitment.create({
      data: {
        workspaceId: request.params.workspaceId,
        name: parsed.data.name,
        category: parsed.data.category,
        weeklyEffortHours: parsed.data.weeklyEffortHours,
        flexibility: parsed.data.flexibility,
        meetings: { create: parsed.data.meetings.map(commitmentMeetingData) },
      },
      include: commitmentInclude,
    });

    response.status(201).json({ commitment: serializeCommitment(commitment) });
  });

  app.patch('/api/commitments/:commitmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = commitmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await prisma.commitment.findFirst({
      where: { id: request.params.commitmentId, workspace: { userId } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_NOT_FOUND' });
      return;
    }

    const commitment = await prisma.$transaction(async (transaction) => {
      await transaction.commitmentMeeting.deleteMany({ where: { commitmentId: existing.id } });
      return transaction.commitment.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          weeklyEffortHours: parsed.data.weeklyEffortHours,
          flexibility: parsed.data.flexibility,
          meetings: { create: parsed.data.meetings.map(commitmentMeetingData) },
        },
        include: commitmentInclude,
      });
    });

    response.status(200).json({ commitment: serializeCommitment(commitment) });
  });

  app.delete('/api/commitments/:commitmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const existing = await prisma.commitment.findFirst({
      where: { id: request.params.commitmentId, workspace: { userId } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_NOT_FOUND' });
      return;
    }

    await prisma.commitment.delete({ where: { id: existing.id } });
    response.status(200).json({ commitmentId: existing.id });
  });

  app.post('/api/commitments/:commitmentId/events', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = commitmentEventRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const commitment = await prisma.commitment.findFirst({
      where: { id: request.params.commitmentId, workspace: { userId } },
      select: { id: true },
    });
    if (!commitment) {
      response.status(404).json({ error: 'COMMITMENT_NOT_FOUND' });
      return;
    }
    const event = await prisma.commitmentEvent.create({
      data: {
        commitmentId: commitment.id,
        title: parsed.data.title,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        estimatedEffortHours: parsed.data.estimatedEffortHours ?? null,
        flexibilityOverride: parsed.data.flexibilityOverride ?? null,
      },
    });
    response.status(201).json({
      event: {
        id: event.id,
        title: event.title,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        estimatedEffortHours: decimalOrNull(event.estimatedEffortHours),
        flexibilityOverride: event.flexibilityOverride,
      },
    });
  });

  app.patch('/api/commitment-events/:eventId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = commitmentEventRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await prisma.commitmentEvent.findFirst({
      where: { id: request.params.eventId, commitment: { workspace: { userId } } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_EVENT_NOT_FOUND' });
      return;
    }
    const event = await prisma.commitmentEvent.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        estimatedEffortHours: parsed.data.estimatedEffortHours ?? null,
        flexibilityOverride: parsed.data.flexibilityOverride ?? null,
      },
    });
    response.status(200).json({
      event: {
        id: event.id,
        title: event.title,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt.toISOString(),
        estimatedEffortHours: decimalOrNull(event.estimatedEffortHours),
        flexibilityOverride: event.flexibilityOverride,
      },
    });
  });

  app.delete('/api/commitment-events/:eventId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const existing = await prisma.commitmentEvent.findFirst({
      where: { id: request.params.eventId, commitment: { workspace: { userId } } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_EVENT_NOT_FOUND' });
      return;
    }
    await prisma.commitmentEvent.delete({ where: { id: existing.id } });
    response.status(200).json({ eventId: existing.id });
  });

  app.get('/api/candidates/:candidateId/validation', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const candidate = await loadOwnedCandidateForValidation(request.params.candidateId, userId);
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    response.status(200).json({
      candidateId: candidate.id,
      ...analyzeCandidateTimetable(candidate),
    });
  });

  app.post('/api/candidates/:candidateId/lock', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const candidate = await loadOwnedCandidateForValidation(request.params.candidateId, userId);
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    let alreadyLocked = false;
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${candidate.workspace.id}))
        `;

        const workspace = await transaction.semesterWorkspace.findFirst({
          where: { id: candidate.workspace.id, userId },
          select: {
            id: true,
            state: true,
            lockedCandidateSemesterId: true,
          },
        });
        if (!workspace) throw new LockWorkflowConflict('WORKSPACE_NOT_FOUND');

        if (workspace.state === 'ACTIVE') {
          if (workspace.lockedCandidateSemesterId === candidate.id) {
            alreadyLocked = true;
            return;
          }
          throw new LockWorkflowConflict('WORKSPACE_ALREADY_ACTIVE');
        }
        if (workspace.state !== 'PLANNING') {
          throw new LockWorkflowConflict('WORKSPACE_NOT_LOCKABLE');
        }
        if (candidate.isArchived) {
          throw new LockWorkflowConflict('CANDIDATE_ARCHIVED');
        }
        if (!candidate.selections.length) {
          throw new LockWorkflowConflict('CANDIDATE_EMPTY');
        }

        const validation = analyzeCandidateTimetable(candidate);
        if (!validation.valid) {
          throw new LockWorkflowConflict('CANDIDATE_HAS_CRITICAL_CONFLICTS');
        }

        for (const selection of candidate.selections) {
          const activeSelection = await transaction.activeCourseSelection.create({
            data: {
              workspaceId: workspace.id,
              sectionId: selection.sectionId,
              status: 'ACTIVE',
            },
          });
          await transaction.activeCourseState.create({
            data: { activeCourseSelectionId: activeSelection.id },
          });
        }

        await transaction.semesterWorkspace.update({
          where: { id: workspace.id },
          data: {
            state: 'ACTIVE',
            lockedCandidateSemesterId: candidate.id,
            lockedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof LockWorkflowConflict) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
          response.status(404).json({ error: error.message });
        } else {
          conflictError(response, error.message);
        }
        return;
      }
      throw error;
    }

    const workspace = await loadOwnedWorkspace(candidate.workspace.id, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    response.status(200).json({
      alreadyLocked,
      workspace: serializeWorkspace(workspace),
    });
  });

  app.post('/api/workspaces/:workspaceId/active-selections', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const workspace = await loadOwnedWorkspace(request.params.workspaceId, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    if (workspace.state !== 'ACTIVE') {
      conflictError(response, 'WORKSPACE_NOT_ACTIVE');
      return;
    }

    let addedSelectionId: string;
    try {
      addedSelectionId = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${workspace.id}))
        `;

        const activeWorkspace = await transaction.semesterWorkspace.findFirst({
          where: { id: workspace.id, userId, state: 'ACTIVE' },
          include: activeWorkspaceValidationInclude,
        });
        if (!activeWorkspace) throw new ActiveCourseConflict('WORKSPACE_NOT_ACTIVE');

        const section = await transaction.section.findFirst({
          where: {
            id: parsed.data.sectionId,
            courseOffering: { academicTermId: activeWorkspace.academicTermId },
          },
          include: { courseOffering: { include: { course: true } }, meetings: true },
        });
        if (!section) throw new ActiveCourseConflict('SECTION_NOT_FOUND');

        if (
          activeWorkspace.activeCourseSelections.some(
            (selection) => selection.section.courseOffering.id === section.courseOfferingId,
          )
        ) {
          throw new ActiveCourseConflict('COURSE_ALREADY_ACTIVE');
        }

        const currentSemesterInput = semesterInputFromSelections(
          activeWorkspace.id,
          activeWorkspace.activeCourseSelections,
          activeWorkspace,
        );
        const validation = detectTimetableClashes({
          ...currentSemesterInput,
          courses: [
            ...currentSemesterInput.courses,
            candidateCourseInputFromSection(`pending-${section.id}`, section, activeWorkspace),
          ],
        });
        if (!validation.valid) throw new ActiveCourseConflict('CANDIDATE_HAS_CRITICAL_CONFLICTS');

        const activeSelection = await transaction.activeCourseSelection.create({
          data: { workspaceId: activeWorkspace.id, sectionId: section.id, status: 'ACTIVE' },
        });
        await transaction.activeCourseState.create({
          data: { activeCourseSelectionId: activeSelection.id },
        });
        return activeSelection.id;
      });
    } catch (error) {
      if (error instanceof ActiveCourseConflict) {
        if (error.message === 'SECTION_NOT_FOUND') {
          response.status(404).json({ error: error.message });
        } else {
          conflictError(response, error.message);
        }
        return;
      }
      throw error;
    }

    const savedWorkspace = await loadOwnedWorkspace(workspace.id, userId);
    if (!savedWorkspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    const activeSelection = savedWorkspace.activeCourseSelections.find(
      (selection) => selection.id === addedSelectionId,
    );
    response.status(201).json({
      activeCourseSelection: activeSelection
        ? serializeActiveCourseSelection(activeSelection)
        : undefined,
      workspace: serializeWorkspace(savedWorkspace),
    });
  });

  app.patch('/api/active-selections/:selectionId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const existing = await loadOwnedActiveSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ACTIVE_SELECTION_NOT_FOUND' });
      return;
    }
    const section = await loadSectionForWorkspace(
      parsed.data.sectionId,
      existing.workspace.academicTermId,
    );
    if (!section) {
      response.status(404).json({ error: 'SECTION_NOT_FOUND' });
      return;
    }
    if (section.courseOfferingId !== existing.section.courseOffering.id) {
      conflictError(response, 'SECTION_MUST_MATCH_COURSE');
      return;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${existing.workspace.id}))
        `;

        const activeWorkspace = await transaction.semesterWorkspace.findFirst({
          where: { id: existing.workspace.id, userId, state: 'ACTIVE' },
          include: activeWorkspaceValidationInclude,
        });
        if (!activeWorkspace) throw new ActiveCourseConflict('WORKSPACE_NOT_ACTIVE');

        const current = activeWorkspace.activeCourseSelections.find(
          (selection) => selection.id === existing.id,
        );
        if (!current) throw new ActiveCourseConflict('ACTIVE_SELECTION_NOT_FOUND');

        if (
          activeWorkspace.activeCourseSelections.some(
            (selection) =>
              selection.id !== current.id &&
              selection.section.courseOffering.id === section.courseOfferingId,
          )
        ) {
          throw new ActiveCourseConflict('COURSE_ALREADY_ACTIVE');
        }

        const courses = activeWorkspace.activeCourseSelections.map((selection) =>
          selection.id === current.id
            ? candidateCourseInputFromSection(selection.id, section, activeWorkspace)
            : candidateCourseInputFromSection(selection.id, selection.section, activeWorkspace),
        );
        const validation = detectTimetableClashes({
          ...semesterInputFromSelections(
            activeWorkspace.id,
            activeWorkspace.activeCourseSelections,
            activeWorkspace,
          ),
          courses,
        });
        if (!validation.valid) throw new ActiveCourseConflict('CANDIDATE_HAS_CRITICAL_CONFLICTS');

        await transaction.activeCourseSelection.update({
          where: { id: current.id },
          data: { sectionId: section.id },
        });
      });
    } catch (error) {
      if (error instanceof ActiveCourseConflict) {
        if (error.message === 'ACTIVE_SELECTION_NOT_FOUND') {
          response.status(404).json({ error: error.message });
        } else {
          conflictError(response, error.message);
        }
        return;
      }
      throw error;
    }

    const savedWorkspace = await loadOwnedWorkspace(existing.workspace.id, userId);
    if (!savedWorkspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    const activeSelection = savedWorkspace.activeCourseSelections.find(
      (selection) => selection.id === existing.id,
    );
    response.status(200).json({
      activeCourseSelection: activeSelection
        ? serializeActiveCourseSelection(activeSelection)
        : undefined,
      workspace: serializeWorkspace(savedWorkspace),
    });
  });

  app.post('/api/active-selections/:selectionId/drop', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const existing = await loadOwnedActiveSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ACTIVE_SELECTION_NOT_FOUND' });
      return;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${existing.workspace.id}))
        `;
        const current = await transaction.activeCourseSelection.findFirst({
          where: { id: existing.id, status: 'ACTIVE', workspace: { userId, state: 'ACTIVE' } },
        });
        if (!current) throw new ActiveCourseConflict('ACTIVE_SELECTION_NOT_FOUND');
        await transaction.activeCourseSelection.update({
          where: { id: current.id },
          data: { status: 'DROPPED', droppedAt: new Date() },
        });
      });
    } catch (error) {
      if (error instanceof ActiveCourseConflict) {
        response.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }

    const savedWorkspace = await loadOwnedWorkspace(existing.workspace.id, userId);
    if (!savedWorkspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    response.status(200).json({ workspace: serializeWorkspace(savedWorkspace) });
  });

  app.get('/api/candidates/:candidateId/analysis', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const candidate = await loadOwnedCandidateForValidation(request.params.candidateId, userId);
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    response.status(200).json(analyzeCandidateSchedule(candidateSemesterInput(candidate)));
  });

  app.get('/api/workspaces/:workspaceId/comparison', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspace = await loadOwnedWorkspace(request.params.workspaceId, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const candidates = (
      await Promise.all(
        workspace.candidates.map(async (candidate) => {
          const fullCandidate = await loadOwnedCandidateForValidation(candidate.id, userId);
          if (!fullCandidate) return null;
          const input = candidateSemesterInput(fullCandidate);
          return {
            candidateId: candidate.id,
            name: candidate.name,
            analysis: analyzeCandidateSchedule(input),
            ...(input.preferences ? { preferences: input.preferences } : {}),
          };
        }),
      )
    ).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    response.status(200).json(calculateCandidateComparison(candidates));
  });

  app.post('/api/candidates/:candidateId/scenario', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const candidate = await loadOwnedCandidateForValidation(request.params.candidateId, userId);
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const input = candidateSemesterInput(candidate);
    let courses = [...input.courses];
    let commitments = [...input.commitments];
    const changes: string[] = [];

    if (parsed.data.removeSelectionId) {
      const nextCourses = courses.filter((course) => course.id !== parsed.data.removeSelectionId);
      if (nextCourses.length === courses.length) {
        response.status(400).json({ error: 'SCENARIO_SELECTION_NOT_FOUND' });
        return;
      }
      courses = nextCourses;
      changes.push('course_removed');
    }

    if (parsed.data.replaceSelection) {
      const existing = courses.find(
        (course) => course.id === parsed.data.replaceSelection?.selectionId,
      );
      if (!existing) {
        response.status(400).json({ error: 'SCENARIO_SELECTION_NOT_FOUND' });
        return;
      }
      const section = await loadSectionForWorkspace(
        parsed.data.replaceSelection.sectionId,
        candidate.workspace.academicTermId,
      );
      if (!section) {
        response.status(404).json({ error: 'SECTION_NOT_FOUND' });
        return;
      }
      if (section.courseOfferingId !== existing.courseOfferingId) {
        conflictError(response, 'SECTION_MUST_MATCH_COURSE');
        return;
      }
      courses = courses.map((course) =>
        course.id === existing.id
          ? candidateCourseInputFromSection(course.id, section, candidate.workspace)
          : course,
      );
      changes.push('section_replaced');
    }

    if (parsed.data.addSectionId) {
      const section = await loadSectionForWorkspace(
        parsed.data.addSectionId,
        candidate.workspace.academicTermId,
      );
      if (!section) {
        response.status(404).json({ error: 'SECTION_NOT_FOUND' });
        return;
      }
      if (courses.some((course) => course.courseOfferingId === section.courseOfferingId)) {
        conflictError(response, 'COURSE_ALREADY_SELECTED');
        return;
      }
      courses = [
        ...courses,
        candidateCourseInputFromSection(`scenario-${section.id}`, section, candidate.workspace),
      ];
      changes.push('course_added');
    }

    if (parsed.data.removeCommitmentId) {
      const nextCommitments = commitments.filter(
        (commitment) => commitment.id !== parsed.data.removeCommitmentId,
      );
      if (nextCommitments.length === commitments.length) {
        response.status(400).json({ error: 'SCENARIO_COMMITMENT_NOT_FOUND' });
        return;
      }
      commitments = nextCommitments;
      changes.push('commitment_removed');
    }

    const scenarioPreferenceOverrides = parsed.data.preferences
      ? (Object.fromEntries(
          Object.entries(parsed.data.preferences).filter(([, value]) => value !== undefined),
        ) as CandidateSemesterInput['preferences'])
      : undefined;
    const preferences = scenarioPreferenceOverrides
      ? { ...input.preferences, ...scenarioPreferenceOverrides }
      : input.preferences;
    if (scenarioPreferenceOverrides) changes.push('preferences_changed');

    const scenarioOverrides = {
      courses,
      commitments,
      ...(preferences ? { preferences } : {}),
    };

    response.status(200).json({
      analysis: analyzeCandidateScenario(input, scenarioOverrides),
      changes,
    });
  });

  app.post('/api/workspaces/:workspaceId/candidates', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = createCandidateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    if (!(await loadOwnedWorkspace(request.params.workspaceId, userId))) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const candidate = await prisma.candidateSemester.create({
      data: { workspaceId: request.params.workspaceId, name: parsed.data.name },
      include: { _count: { select: { selections: true } } },
    });

    response.status(201).json({ candidate: serializeCandidate(candidate) });
  });

  app.post('/api/candidates/:candidateId/selections', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const candidate = await prisma.candidateSemester.findFirst({
      where: { id: request.params.candidateId, workspace: { userId } },
      select: {
        id: true,
        workspaceId: true,
        workspace: { select: { academicTermId: true } },
      },
    });
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const section = await loadSectionForWorkspace(
      parsed.data.sectionId,
      candidate.workspace.academicTermId,
    );
    if (!section) {
      response.status(404).json({ error: 'SECTION_NOT_FOUND' });
      return;
    }
    let selection;
    try {
      selection = await prisma.$transaction(async (transaction) => {
        // The relational model intentionally derives an offering from Section.
        // Serialize writes per candidate so two simultaneous requests cannot
        // add alternate sections of the same offering.
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${candidate.id}))
        `;
        const duplicate = await transaction.candidateCourseSelection.findFirst({
          where: {
            candidateSemesterId: candidate.id,
            section: { courseOfferingId: section.courseOfferingId },
          },
          select: { id: true },
        });
        if (duplicate) throw new CandidateSelectionConflict('COURSE_ALREADY_SELECTED');
        return transaction.candidateCourseSelection.create({
          data: { candidateSemesterId: candidate.id, sectionId: section.id },
          include: selectionInclude,
        });
      });
    } catch (error) {
      if (error instanceof CandidateSelectionConflict) {
        conflictError(response, error.message);
        return;
      }
      throw error;
    }
    const workspace = await loadOwnedWorkspace(candidate.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find((item) => item.id === candidate.id);

    response.status(201).json({
      selection: serializeSelection(selection),
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
  });

  app.patch('/api/selections/:selectionId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const existing = await loadOwnedSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'SELECTION_NOT_FOUND' });
      return;
    }
    const section = await loadSectionForWorkspace(
      parsed.data.sectionId,
      (
        await prisma.semesterWorkspace.findUniqueOrThrow({
          where: { id: existing.candidateSemester.workspaceId },
          select: { academicTermId: true },
        })
      ).academicTermId,
    );
    if (!section) {
      response.status(404).json({ error: 'SECTION_NOT_FOUND' });
      return;
    }
    if (section.courseOfferingId !== existing.section.courseOffering.id) {
      conflictError(response, 'SECTION_MUST_MATCH_COURSE');
      return;
    }

    let selection;
    try {
      selection = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT 1::integer AS "locked"
          FROM pg_advisory_xact_lock(hashtext(${existing.candidateSemester.id}))
        `;
        const duplicate = await transaction.candidateCourseSelection.findFirst({
          where: {
            candidateSemesterId: existing.candidateSemester.id,
            id: { not: existing.id },
            section: { courseOfferingId: section.courseOfferingId },
          },
          select: { id: true },
        });
        if (duplicate) throw new CandidateSelectionConflict('COURSE_ALREADY_SELECTED');
        return transaction.candidateCourseSelection.update({
          where: { id: existing.id },
          data: { sectionId: section.id },
          include: selectionInclude,
        });
      });
    } catch (error) {
      if (error instanceof CandidateSelectionConflict) {
        conflictError(response, error.message);
        return;
      }
      throw error;
    }
    const workspace = await loadOwnedWorkspace(existing.candidateSemester.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find(
      (candidate) => candidate.id === existing.candidateSemester.id,
    );

    response.status(200).json({
      selection: serializeSelection(selection),
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
  });

  app.delete('/api/selections/:selectionId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const existing = await loadOwnedSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'SELECTION_NOT_FOUND' });
      return;
    }

    await prisma.candidateCourseSelection.delete({ where: { id: existing.id } });
    const workspace = await loadOwnedWorkspace(existing.candidateSemester.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find(
      (candidate) => candidate.id === existing.candidateSemester.id,
    );

    response.status(200).json({
      selectionId: existing.id,
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
  });

  app.patch('/api/candidates/:candidateId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = updateCandidateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const ownedCandidate = await loadOwnedCandidate(request.params.candidateId, userId);
    if (!ownedCandidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const update: { name?: string; isArchived?: boolean } = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.isArchived !== undefined) update.isArchived = parsed.data.isArchived;

    const candidate = await prisma.candidateSemester.update({
      where: { id: ownedCandidate.id },
      data: update,
      include: { _count: { select: { selections: true } } },
    });
    const savedCandidate = await loadOwnedCandidate(candidate.id, userId);

    response.status(200).json({
      candidate: serializeCandidate(savedCandidate ?? candidate),
    });
  });

  app.post('/api/candidates/:candidateId/duplicate', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const source = await loadOwnedCandidate(request.params.candidateId, userId);
    if (!source) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const suffix = ' copy';
    const name = `${source.name.slice(0, 80 - suffix.length)}${suffix}`;
    const candidate = await prisma.candidateSemester.create({
      data: {
        workspaceId: source.workspaceId,
        name,
        selections: {
          create: source.selections.map((selection) => ({ sectionId: selection.section.id })),
        },
      },
      include: { _count: { select: { selections: true } } },
    });
    const savedCandidate = await loadOwnedCandidate(candidate.id, userId);

    response.status(201).json({
      candidate: serializeCandidate(savedCandidate ?? candidate),
    });
  });
}
