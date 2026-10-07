import { describe, expect, it } from "vitest";
import { HOME_CATEGORIES, categoryMatches } from "../src/components/home/categories";
import { applications, messages, posts, seedNotifications, users } from "../src/lib/repo/mock";

describe("mock demo seed", () => {
  it("offers diverse student and small-business accounts", () => {
    const students = users.filter((user) => user.role === "student");
    const businesses = users.filter((user) => user.role === "resident" && user.kind === "상인");

    expect(students).toHaveLength(13);
    expect(businesses.length).toBeGreaterThanOrEqual(13);
    expect(new Set(users.map((user) => user.id)).size).toBe(users.length);
    expect(new Set(students.map((student) => student.department)).size).toBeGreaterThanOrEqual(8);
  });

  it("shows about six active requests in every home category", () => {
    for (const category of HOME_CATEGORIES) {
      const active = posts.filter((post) => post.status !== "done" && categoryMatches(category.value, post.category));
      expect(active, category.label).toHaveLength(6);
    }
  });

  it("links every request to an existing resident or merchant", () => {
    const clients = new Set(users.filter((user) => user.role === "resident").map((user) => user.id));
    expect(new Set(posts.map((post) => post.id)).size).toBe(posts.length);
    expect(posts.every((post) => clients.has(post.authorId))).toBe(true);
  });

  it("seeds valid student-client conversations across several accounts", () => {
    const students = new Set(users.filter((user) => user.role === "student").map((user) => user.id));
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const applicationsById = new Map(applications.map((application) => [application.id, application]));
    const participants = new Set<string>();

    expect(applications.length).toBeGreaterThanOrEqual(12);
    expect(new Set(applications.map((application) => application.id)).size).toBe(applications.length);
    for (const application of applications) {
      const post = postsById.get(application.postId);
      expect(post).toBeDefined();
      expect(students.has(application.studentId)).toBe(true);
      participants.add(application.studentId);
      participants.add(post!.authorId);
    }

    expect(participants.size).toBeGreaterThanOrEqual(15);
    for (const message of messages) {
      const application = applicationsById.get(message.applicationId);
      const post = application && postsById.get(application.postId);
      expect(application).toBeDefined();
      expect([application!.studentId, post!.authorId]).toContain(message.senderId);
    }

    const comparisonScenario = applications.filter((application) => application.postId === "p10");
    expect(comparisonScenario).toHaveLength(4);
    expect(comparisonScenario.every((application) => messages.some((message) => message.applicationId === application.id))).toBe(true);
  });

  it("provides actionable notifications for students and clients", () => {
    const userIds = new Set(users.map((user) => user.id));
    const postIds = new Set(posts.map((post) => post.id));

    expect(seedNotifications.length).toBeGreaterThanOrEqual(20);
    expect(seedNotifications.some((notification) => notification.kind === "CHAT")).toBe(true);
    expect(seedNotifications.some((notification) => notification.kind === "APPLICATION")).toBe(true);
    expect(seedNotifications.every((notification) => userIds.has(notification.userId))).toBe(true);
    expect(seedNotifications.every((notification) => !notification.postId || postIds.has(notification.postId))).toBe(true);
  });
});
