import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { screenMessage } from "./screen";

type FixtureRow = {
  sender_id: string;
  advert_id: string;
  body: string;
  delivery_status: string;
  event_type: string | null;
  created_at: string;
};

type FakeQueryBuilder = {
  select: (columns: string, options?: { count?: string; head?: boolean }) => FakeQueryBuilder;
  eq: (column: keyof FixtureRow, value: unknown) => FakeQueryBuilder;
  neq: (column: keyof FixtureRow, value: unknown) => FakeQueryBuilder;
  is: (column: keyof FixtureRow, value: unknown) => FakeQueryBuilder;
  gte: (column: "created_at", value: string) => FakeQueryBuilder;
  then: (resolve: (value: unknown) => unknown) => unknown;
};

// A minimal stand-in for the Supabase query builder: real enough to exercise
// screenMessage's actual filter logic (eq/is/neq/gte applied against an
// in-memory fixture) rather than just returning canned responses per call.
function createFakeAdmin(rows: FixtureRow[]): SupabaseClient {
  function builder(): FakeQueryBuilder {
    let filtered = [...rows];
    let mode: "count" | "data" = "data";

    const chain: FakeQueryBuilder = {
      select(_columns, options) {
        if (options?.count === "exact" && options?.head) mode = "count";
        return chain;
      },
      eq(column, value) {
        filtered = filtered.filter((row) => row[column] === value);
        return chain;
      },
      neq(column, value) {
        filtered = filtered.filter((row) => row[column] !== value);
        return chain;
      },
      is(column, value) {
        filtered = filtered.filter((row) => row[column] === value);
        return chain;
      },
      gte(column, value) {
        filtered = filtered.filter(
          (row) => new Date(row[column]).getTime() >= new Date(value).getTime()
        );
        return chain;
      },
      then(resolve) {
        if (mode === "count") {
          return resolve({ count: filtered.length, data: null, error: null });
        }
        return resolve({ data: filtered, error: null });
      },
    };

    return chain;
  }

  return {
    from(table: string) {
      void table;
      return builder();
    },
  } as unknown as SupabaseClient;
}

const SENDER = "sender-1";
const ADVERT_A = "advert-a";
const ADVERT_B = "advert-b";
const ADVERT_C = "advert-c";

function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

describe("screenMessage — contact details", () => {
  const scamBodies = [
    "Hey I'm interested in your car message me on WhatsApp 07882733749",
    "do you use whatsapp? you can reach me here +447473221832",
    "Yes you can check it any time give me your WhatsApp I will contact you",
  ];

  for (const body of scamBodies) {
    it(`holds: "${body}"`, async () => {
      const admin = createFakeAdmin([]);
      const result = await screenMessage({
        senderId: SENDER,
        advertId: ADVERT_A,
        body,
        admin,
      });
      expect(result.hold).toBe(true);
      expect(result.reasons).toContain("contact_details");
    });
  }
});

describe("screenMessage — duplicate_text", () => {
  it("holds the third of three identical bodies sent to different adverts", async () => {
    const body =
      "Hi! I've recently moved to the area and I'm currently looking for one like this.";

    const admin = createFakeAdmin([
      {
        sender_id: SENDER,
        advert_id: ADVERT_A,
        body,
        delivery_status: "delivered",
        event_type: null,
        created_at: minutesAgo(5),
      },
      {
        sender_id: SENDER,
        advert_id: ADVERT_B,
        body,
        delivery_status: "delivered",
        event_type: null,
        created_at: minutesAgo(2),
      },
    ]);

    const result = await screenMessage({
      senderId: SENDER,
      advertId: ADVERT_C,
      body,
      admin,
    });

    expect(result.hold).toBe(true);
    expect(result.reasons).toContain("duplicate_text");
  });
});

describe("screenMessage — ordinary follow-up message", () => {
  it("does not hold a plain reply from a sender with a prior delivered message", async () => {
    const admin = createFakeAdmin([
      {
        sender_id: SENDER,
        advert_id: ADVERT_A,
        body: "Hi, is the car still for sale?",
        delivery_status: "delivered",
        event_type: null,
        created_at: minutesAgo(120),
      },
    ]);

    const result = await screenMessage({
      senderId: SENDER,
      advertId: ADVERT_A,
      body: "Is it still available? Could I view it Saturday?",
      admin,
    });

    expect(result.hold).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});

describe("screenMessage — first_message", () => {
  it("holds a sender's very first message", async () => {
    const admin = createFakeAdmin([]);
    const result = await screenMessage({
      senderId: SENDER,
      advertId: ADVERT_A,
      body: "Is this still available?",
      admin,
    });

    expect(result.hold).toBe(true);
    expect(result.reasons).toContain("first_message");
  });

  it("ignores vault system messages when checking for a prior delivered message", async () => {
    const admin = createFakeAdmin([
      {
        sender_id: SENDER,
        advert_id: ADVERT_A,
        body: "Shared your V5C — link expires in 15 minutes",
        delivery_status: "delivered",
        event_type: "document_share",
        created_at: minutesAgo(5),
      },
    ]);

    const result = await screenMessage({
      senderId: SENDER,
      advertId: ADVERT_A,
      body: "Is this still available?",
      admin,
    });

    expect(result.reasons).toContain("first_message");
  });
});

describe("screenMessage — burst", () => {
  it("holds when the sender has messaged 3+ different adverts in the last 10 minutes", async () => {
    const admin = createFakeAdmin([
      {
        sender_id: SENDER,
        advert_id: ADVERT_A,
        body: "Hi",
        delivery_status: "delivered",
        event_type: null,
        created_at: minutesAgo(1),
      },
      {
        sender_id: SENDER,
        advert_id: ADVERT_B,
        body: "Hi",
        delivery_status: "delivered",
        event_type: null,
        created_at: minutesAgo(2),
      },
    ]);

    const result = await screenMessage({
      senderId: SENDER,
      advertId: ADVERT_C,
      body: "Hi there",
      admin,
    });

    expect(result.hold).toBe(true);
    expect(result.reasons).toContain("burst");
  });
});
