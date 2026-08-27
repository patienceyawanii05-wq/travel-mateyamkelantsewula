import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  savedItineraries,
  travelConversations,
  travelMessages,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createTravelConversation(userId: number, title: string, destination?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db.insert(travelConversations).values({ userId, title, destination });
  return Number(result[0].insertId);
}

export async function getTravelConversationForUser(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(travelConversations)
    .where(and(eq(travelConversations.id, conversationId), eq(travelConversations.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function getRecentTravelConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(travelConversations)
    .where(eq(travelConversations.userId, userId))
    .orderBy(desc(travelConversations.updatedAt))
    .limit(12);
}

export async function createTravelMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(travelMessages).values({ conversationId, role, content });
  await db
    .update(travelConversations)
    .set({ updatedAt: new Date() })
    .where(eq(travelConversations.id, conversationId));
}

export async function getTravelMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({ id: travelMessages.id, role: travelMessages.role, content: travelMessages.content, createdAt: travelMessages.createdAt })
    .from(travelMessages)
    .where(eq(travelMessages.conversationId, conversationId))
    .orderBy(asc(travelMessages.createdAt));
}

export async function saveItinerary(input: {
  userId: number;
  conversationId?: number;
  destination: string;
  summary: string;
  itineraryBody: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db.insert(savedItineraries).values(input);
  return Number(result[0].insertId);
}

export async function getSavedItineraries(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(savedItineraries)
    .where(eq(savedItineraries.userId, userId))
    .orderBy(desc(savedItineraries.createdAt))
    .limit(12);
}
