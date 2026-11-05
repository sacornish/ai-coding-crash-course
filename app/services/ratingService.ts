import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings, courses } from "~/db/schema";
import { isUserEnrolled } from "~/services/enrollmentService";

// ─── Rating Service ───
// 1–5 star course ratings. One rating per user per course (re-rating updates it).
// Uses positional parameters (project convention).

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export type RatingSummary = { average: number | null; count: number };

export function getUserRatingForCourse(userId: number, courseId: number) {
  const row = db
    .select({ rating: courseRatings.rating })
    .from(courseRatings)
    .where(
      and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId))
    )
    .get();
  return row?.rating ?? null;
}

export function getCourseRatingSummary(courseId: number): RatingSummary {
  const row = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();
  return { average: row?.average ?? null, count: row?.count ?? 0 };
}

export function getRatingSummariesForCourses(
  courseIds: number[]
): Map<number, RatingSummary> {
  const summaries = new Map<number, RatingSummary>();
  if (courseIds.length === 0) return summaries;

  const rows = db
    .select({
      courseId: courseRatings.courseId,
      average: sql<number>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId)
    .all();

  for (const row of rows) {
    summaries.set(row.courseId, { average: row.average, count: row.count });
  }
  return summaries;
}

export function canUserRateCourse(userId: number, courseId: number) {
  const course = db
    .select({ instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
  if (!course) return false;
  if (course.instructorId === userId) return false;
  return isUserEnrolled(userId, courseId);
}

export function rateCourse(userId: number, courseId: number, rating: number) {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new Error(`Rating must be an integer between ${MIN_RATING} and ${MAX_RATING}`);
  }
  if (!canUserRateCourse(userId, courseId)) {
    throw new Error("User is not allowed to rate this course");
  }

  const now = new Date().toISOString();
  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [courseRatings.userId, courseRatings.courseId],
      set: { rating, updatedAt: now },
    })
    .returning()
    .get();
}
