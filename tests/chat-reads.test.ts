import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chatReads } from "../src/lib/repo/chatReads";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

it("preserves read messages on reload and isolates accounts, rooms and backends", async () => {
  await chatReads("mock").markChatRead("alice", "room1", ["m1"]);
  const reloaded = chatReads("mock");
  expect(await reloaded.readChatMessageIds("alice", "room1")).toEqual(["m1"]);
  expect(await reloaded.readChatMessageIds("bob", "room1")).toEqual([]);
  expect(await reloaded.readChatMessageIds("alice", "room2")).toEqual([]);
  expect(await chatReads("server").readChatMessageIds("alice", "room1")).toEqual([]);
});

it("merges receipts across tabs without marking future messages read", async () => {
  const first = chatReads("mock"), second = chatReads("mock");
  await first.markChatRead("alice", "room", ["m1"]);
  await second.markChatRead("alice", "room", ["m2"]);
  await first.markChatRead("alice", "room", ["m1"]);
  expect(await first.readChatMessageIds("alice", "room")).toEqual(["m1", "m2"]);
  expect(await first.readChatMessageIds("alice", "room")).not.toContain("m3");
});
