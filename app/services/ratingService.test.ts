import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  rateCourse,
  canUserRateCourse,
  getUserRatingForCourse,
  getCourseRatingSummary,
  getRatingSummariesForCourses,
} from "./ratingService";
import { enrollUser } from "./enrollmentService";

function createStudent(email: string) {
  return testDb
    .insert(schema.users)
    .values({ name: email, email, role: schema.UserRole.Student })
    .returning()
    .get();
}

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("rateCourse", () => {
    it("lets an enrolled student rate a course", () => {
      enrollUser(base.user.id, base.course.id, false, false);
      rateCourse(base.user.id, base.course.id, 4);

      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBe(4);
    });

    it("updates an existing rating instead of adding a second one", () => {
      enrollUser(base.user.id, base.course.id, false, false);
      rateCourse(base.user.id, base.course.id, 2);
      rateCourse(base.user.id, base.course.id, 5);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 5,
        count: 1,
      });
    });

    it.each([0, 6, 3.5])("rejects invalid rating %s", (rating) => {
      enrollUser(base.user.id, base.course.id, false, false);
      expect(() => rateCourse(base.user.id, base.course.id, rating)).toThrow();
    });

    it("rejects a student who is not enrolled", () => {
      expect(() => rateCourse(base.user.id, base.course.id, 4)).toThrow();
    });

    it("prevents instructors from rating their own course", () => {
      enrollUser(base.instructor.id, base.course.id, false, false);

      expect(canUserRateCourse(base.instructor.id, base.course.id)).toBe(false);
      expect(() => rateCourse(base.instructor.id, base.course.id, 5)).toThrow();
    });
  });

  describe("summaries", () => {
    it("returns null average when a course has no ratings", () => {
      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: null,
        count: 0,
      });
    });

    it("averages ratings across students", () => {
      const other = createStudent("other@example.com");
      enrollUser(base.user.id, base.course.id, false, false);
      enrollUser(other.id, base.course.id, false, false);
      rateCourse(base.user.id, base.course.id, 4);
      rateCourse(other.id, base.course.id, 5);

      expect(getCourseRatingSummary(base.course.id)).toEqual({
        average: 4.5,
        count: 2,
      });
      const map = getRatingSummariesForCourses([base.course.id, 999]);
      expect(map.get(base.course.id)).toEqual({ average: 4.5, count: 2 });
      expect(map.has(999)).toBe(false);
    });
  });
});
