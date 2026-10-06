import { describe, expect, it } from "vitest";
import { HOME_CATEGORIES, categoryMatches } from "../src/components/home/categories";
import { posts, users } from "../src/lib/repo/mock";

describe("mock demo seed", () => {
  it("offers diverse student and small-business accounts", () => {
    const students = users.filter((user) => user.role === "student");
    const businesses = users.filter((user) => user.role === "resident" && user.kind === "상인");

    expect(students).toHaveLength(12);
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
});
