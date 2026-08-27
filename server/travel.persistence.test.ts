import { describe, expect, it, vi } from "vitest";

const mockedDb = vi.hoisted(() => ({
  createTravelConversation: vi.fn(async () => 44),
  createTravelMessage: vi.fn(async () => undefined),
  getRecentTravelConversations: vi.fn(async () => [{ id: 44, title: "Cape Town getaway" }]),
  getSavedItineraries: vi.fn(async () => [{ id: 7, destination: "Cape Town" }]),
  getTravelConversationForUser: vi.fn(async (userId: number, conversationId: number) => userId === 1 && conversationId === 44 ? { id: 44, userId } : undefined),
  getTravelMessages: vi.fn(async () => [{ id: 1, role: "user", content: "Hello" }]),
  saveItinerary: vi.fn(async () => 7),
}));

vi.mock("./db", () => mockedDb);
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "- **Budget:** R4,000\n- Check Travelstart or Skyscanner for live prices." } }] })),
}));

const { appRouter } = await import("./routers");

const anonymousContext = { user: null, req: { protocol: "https", headers: {} }, res: { clearCookie: vi.fn() } } as never;
const travellerContext = {
  user: { id: 1, openId: "traveller", name: "Traveller", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn() },
} as never;

describe("Travel Mate persistence procedures", () => {
  it("requires sign-in before travellers can access saved content", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.travel.itineraries()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("saves an itinerary under the signed-in traveller and returns their recent data", async () => {
    const caller = appRouter.createCaller(travellerContext);
    await expect(caller.travel.conversations()).resolves.toEqual([{ id: 44, title: "Cape Town getaway" }]);
    await expect(caller.travel.itineraries()).resolves.toEqual([{ id: 7, destination: "Cape Town" }]);
    await expect(caller.travel.saveItinerary({ destination: "Cape Town", summary: "A short city escape", itineraryBody: "- Day 1" })).resolves.toEqual({ itineraryId: 7 });
    expect(mockedDb.saveItinerary).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, destination: "Cape Town" }));
  });

  it("blocks loading conversations that do not belong to the traveller", async () => {
    const caller = appRouter.createCaller(travellerContext);
    await expect(caller.travel.messages({ conversationId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
