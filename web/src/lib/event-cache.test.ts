import { describe, expect, it, vi } from "vitest";
import { queryAllEventsWithCache, type EventCacheStorage } from "./event-cache";

function createStorage(): EventCacheStorage {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

describe("queryAllEventsWithCache", () => {
  it("starts from the cached cursor and appends newer events", async () => {
    const storage = createStorage();
    storage.setItem(
      "events:test",
      JSON.stringify({
        version: 1,
        records: [
          {
            parsed: { gate_id: "0xgate-a" },
            txDigest: "0xtx-1",
            eventSeq: 1,
            timestampMs: "1000"
          }
        ],
        cursor: { txDigest: "0xtx-1", eventSeq: "1" }
      })
    );

    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            parsedJson: { gate_id: "0xgate-b" },
            id: { txDigest: "0xtx-2", eventSeq: "2" },
            timestampMs: "2000"
          }
        ],
        hasNextPage: false,
        nextCursor: { txDigest: "0xtx-2", eventSeq: "2" }
      })
    };

    const results = await queryAllEventsWithCache<{ gate_id: string }>({
      client,
      eventType: "pkg::module::Event",
      cacheKey: "events:test",
      storage
    });

    expect(client.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { txDigest: "0xtx-1", eventSeq: "1" }
      })
    );
    expect(results.map((event) => `${event.txDigest}:${event.eventSeq}`)).toEqual(["0xtx-1:1", "0xtx-2:2"]);
  });

  it("deduplicates the cached tail when the RPC returns the cursor event again", async () => {
    const storage = createStorage();
    storage.setItem(
      "events:test",
      JSON.stringify({
        version: 1,
        records: [
          {
            parsed: { gate_id: "0xgate-a" },
            txDigest: "0xtx-1",
            eventSeq: 1,
            timestampMs: "1000"
          }
        ],
        cursor: { txDigest: "0xtx-1", eventSeq: "1" }
      })
    );

    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            parsedJson: { gate_id: "0xgate-a" },
            id: { txDigest: "0xtx-1", eventSeq: "1" },
            timestampMs: "1000"
          },
          {
            parsedJson: { gate_id: "0xgate-b" },
            id: { txDigest: "0xtx-2", eventSeq: "2" },
            timestampMs: "2000"
          }
        ],
        hasNextPage: false,
        nextCursor: { txDigest: "0xtx-2", eventSeq: "2" }
      })
    };

    const results = await queryAllEventsWithCache<{ gate_id: string }>({
      client,
      eventType: "pkg::module::Event",
      cacheKey: "events:test",
      storage
    });

    expect(results.map((event) => `${event.txDigest}:${event.eventSeq}`)).toEqual(["0xtx-1:1", "0xtx-2:2"]);
  });

  it("stops paginating when the RPC reports more pages without a cursor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            parsedJson: { gate_id: "0xtx-1" },
            id: { txDigest: "0xtx-1", eventSeq: "1" },
            timestampMs: "1000"
          }
        ],
        hasNextPage: true,
        nextCursor: null
      })
    };

    try {
      const results = await queryAllEventsWithCache<{ gate_id: string }>({
        client,
        eventType: "pkg::module::Event",
        cacheKey: "events:test",
        storage: createStorage()
      });

      expect(results.map((event) => `${event.txDigest}:${event.eventSeq}`)).toEqual(["0xtx-1:1"]);
      expect(client.queryEvents).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "Stopping pkg::module::Event event pagination because hasNextPage=true but nextCursor is missing."
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("preserves the cached-fetch error when the fresh retry also fails", async () => {
    const storage = createStorage();
    storage.setItem(
      "events:test",
      JSON.stringify({
        version: 1,
        records: [
          {
            parsed: { gate_id: "0xgate-a" },
            txDigest: "0xtx-1",
            eventSeq: 1,
            timestampMs: "1000"
          }
        ],
        cursor: { txDigest: "0xtx-1", eventSeq: "1" }
      })
    );

    const cachedCursorError = new Error("cached cursor fetch failed");
    const freshFetchError = new Error("fresh fetch failed");
    const client = {
      queryEvents: vi
        .fn()
        .mockRejectedValueOnce(cachedCursorError)
        .mockRejectedValueOnce(freshFetchError)
    };

    try {
      await queryAllEventsWithCache<{ gate_id: string }>({
        client,
        eventType: "pkg::module::Event",
        cacheKey: "events:test",
        storage
      });
      throw new Error("Expected queryAllEventsWithCache to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).message).toContain("pkg::module::Event");
      expect((error as AggregateError).errors).toEqual([cachedCursorError, freshFetchError]);
    }
  });

  it("drops the cache when localStorage quota is exceeded instead of persisting partial history", async () => {
    const storage = (() => {
      const store = new Map<string, string>();
      return {
        getItem(key: string) {
          return store.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          throw new Error(`quota exceeded: ${value.length}`);
          store.set(key, value);
        },
        removeItem(key: string) {
          store.delete(key);
        }
      } satisfies EventCacheStorage;
    })();

    const client = {
      queryEvents: vi.fn().mockResolvedValue({
        data: [
          {
            parsedJson: { gate_id: "0xgate-a" },
            id: { txDigest: "0xtx-1", eventSeq: "1" },
            timestampMs: "1000"
          },
          {
            parsedJson: { gate_id: "0xgate-b" },
            id: { txDigest: "0xtx-2", eventSeq: "2" },
            timestampMs: "2000"
          },
          {
            parsedJson: { gate_id: "0xgate-c" },
            id: { txDigest: "0xtx-3", eventSeq: "3" },
            timestampMs: "3000"
          }
        ],
        hasNextPage: false,
        nextCursor: { txDigest: "0xtx-3", eventSeq: "3" }
      })
    };

    const results = await queryAllEventsWithCache<{ gate_id: string }>({
      client,
      eventType: "pkg::module::Event",
      cacheKey: "events:test",
      storage
    });

    expect(results.map((event) => `${event.txDigest}:${event.eventSeq}`)).toEqual([
      "0xtx-1:1",
      "0xtx-2:2",
      "0xtx-3:3"
    ]);
    expect(storage.getItem("events:test")).toBeNull();
  });
});
