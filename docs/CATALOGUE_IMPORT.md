# Catalogue Import Format

The Phase 1 importer accepts one JSON object per university and academic term.
It converts source-specific catalogue data into the canonical `University`,
`AcademicTerm`, `Course`, `CourseOffering`, `Section`, and `Meeting` records.

Run it from the repository root:

```powershell
npm run catalogue:import --workspace @semora/api -- path/to/catalogue.json
```

Required shape:

```json
{
  "university": {
    "name": "Lahore University of Management Sciences",
    "shortName": "LUMS",
    "country": "Pakistan",
    "timezone": "Asia/Karachi"
  },
  "term": {
    "name": "Fall 2026",
    "termType": "FALL",
    "academicYear": "2026-2027",
    "startDate": "2026-08-31",
    "endDate": "2026-12-18",
    "addDropEndDate": "2026-09-11",
    "examStartDate": "2026-12-07",
    "examEndDate": "2026-12-18"
  },
  "courses": [
    {
      "courseCode": "CS 340",
      "title": "Operating Systems",
      "description": "Course description from the official source.",
      "department": "Computer Science",
      "creditHoursDefault": 3,
      "creditHours": 3,
      "sections": [
        {
          "sectionCode": "01",
          "capacity": 40,
          "instructorDisplay": "Instructor name",
          "meetings": [
            {
              "dayOfWeek": "MONDAY",
              "startTime": "12:30",
              "endTime": "13:45",
              "meetingType": "LECTURE",
              "location": "Academic Block"
            }
          ]
        }
      ]
    }
  ]
}
```

`termType` must be `FALL`, `SPRING`, `SUMMER`, or `OTHER`. Meeting days must
use the uppercase weekday enum; meeting times use 24-hour `HH:mm`. Meeting
types are `LECTURE`, `LAB`, `TUTORIAL`, `SEMINAR`, or `OTHER`.

The importer validates required fields, uses the canonical uniqueness keys,
replaces sections for an existing offering, and runs the complete import in a
Prisma transaction. Re-running the same file is therefore idempotent for the
represented term and courses.

The repository currently contains synthetic seed data only. Official LUMS
source documents must be supplied before claiming the Fall 2026 catalogue has
been imported.
