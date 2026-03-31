export interface EventCursor {
  txDigest: string;
  eventSeq: string;
}

export interface EventQueryRecord<T> {
  parsed: T;
  txDigest: string;
  eventSeq: number;
  timestampMs: string;
}

export interface EventCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface EventCachePayload<T> {
  version: number;
  records: EventQueryRecord<T>[];
  cursor: EventCursor | null;
}

interface EventQueryResponse {
  data: Array<{
    parsedJson: unknown;
    id: { txDigest: string; eventSeq: string };
    timestampMs?: string | null;
  }>;
  hasNextPage: boolean;
  nextCursor?: EventCursor | null;
}

interface EventQueryClient {
  queryEvents(input: {
    query: { MoveEventType: string };
    limit: number;
    order: "ascending";
    cursor?: EventCursor;
  }): Promise<EventQueryResponse>;
}

const CACHE_VERSION = 1;
function getDefaultStorage() {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return globalThis.localStorage satisfies EventCacheStorage;
}

function getRecordId(record: { txDigest: string; eventSeq: number | string }) {
  return `${record.txDigest}:${record.eventSeq}`;
}

function normalizeCursor(cursor?: EventCursor | null) {
  if (!cursor) {
    return null;
  }

  return {
    txDigest: cursor.txDigest,
    eventSeq: String(cursor.eventSeq)
  } satisfies EventCursor;
}

function getLastCursor<T>(records: EventQueryRecord<T>[]) {
  const lastRecord = records.at(-1);
  if (!lastRecord) {
    return null;
  }

  return {
    txDigest: lastRecord.txDigest,
    eventSeq: String(lastRecord.eventSeq)
  } satisfies EventCursor;
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function readEventCache<T>(cacheKey: string, storage: EventCacheStorage | null) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<EventCachePayload<T>>;
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.records)) {
      storage.removeItem(cacheKey);
      return null;
    }

    return {
      version: CACHE_VERSION,
      records: parsed.records,
      cursor: normalizeCursor(parsed.cursor)
    } satisfies EventCachePayload<T>;
  } catch {
    storage.removeItem(cacheKey);
    return null;
  }
}

function writeEventCache<T>(cacheKey: string, payload: EventCachePayload<T>, storage: EventCacheStorage | null) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    storage.removeItem(cacheKey);
  }
}

async function fetchEventsFromCursor<T>({
  client,
  eventType,
  initialRecords,
  initialCursor
}: {
  client: EventQueryClient;
  eventType: string;
  initialRecords: EventQueryRecord<T>[];
  initialCursor?: EventCursor;
}) {
  const results = [...initialRecords];
  const seen = new Set(results.map((record) => getRecordId(record)));
  let cursor = initialCursor;
  let hasMore = true;

  while (hasMore) {
    const response = await client.queryEvents({
      query: { MoveEventType: eventType },
      limit: 50,
      order: "ascending",
      cursor
    });

    for (const event of response.data) {
      const record = {
        parsed: event.parsedJson as T,
        txDigest: event.id.txDigest,
        eventSeq: Number(event.id.eventSeq),
        timestampMs: event.timestampMs ?? "0"
      } satisfies EventQueryRecord<T>;

      const recordId = getRecordId(record);
      if (seen.has(recordId)) {
        continue;
      }

      results.push(record);
      seen.add(recordId);
    }

    hasMore = response.hasNextPage;
    const nextCursor = normalizeCursor(response.nextCursor);
    if (hasMore && !nextCursor) {
      console.warn(
        `Stopping ${eventType} event pagination because hasNextPage=true but nextCursor is missing.`
      );
      break;
    }

    cursor = nextCursor ?? undefined;
  }

  return results;
}

export async function queryAllEventsWithCache<T>({
  client,
  eventType,
  cacheKey,
  storage = getDefaultStorage()
}: {
  client: EventQueryClient;
  eventType: string;
  cacheKey: string;
  storage?: EventCacheStorage | null;
}): Promise<EventQueryRecord<T>[]> {
  const cached = readEventCache<T>(cacheKey, storage);

  try {
    const results = await fetchEventsFromCursor({
      client,
      eventType,
      initialRecords: cached?.records ?? [],
      initialCursor: cached?.cursor ?? undefined
    });

    writeEventCache(
      cacheKey,
      {
        version: CACHE_VERSION,
        records: results,
        cursor: getLastCursor(results)
      },
      storage
    );

    return results;
  } catch (error) {
    if (!cached) {
      throw error;
    }

    try {
      const results = await fetchEventsFromCursor<T>({
        client,
        eventType,
        initialRecords: [],
        initialCursor: undefined
      });

      writeEventCache(
        cacheKey,
        {
          version: CACHE_VERSION,
          records: results,
          cursor: getLastCursor(results)
        },
        storage
      );

      return results;
    } catch (retryError) {
      throw new AggregateError(
        [error, retryError],
        `Failed to query ${eventType} with cached cursor and fresh retry (${describeError(error)}; ${describeError(retryError)})`
      );
    }
  }
}
