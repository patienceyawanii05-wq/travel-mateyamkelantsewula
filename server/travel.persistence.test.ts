import { describe, expect, it, vi } from "vitest";

const mockedDb = vi.hoisted(() => ({
  createTravelConversation: vi.fn(async () => 44),
  createTravelMessage: vi.fn(async () => undefined),
  getRecentTravelConversations: vi.fn(async () => [{ id: 44, title: "Cape Town getaway" }]),
  getSavedItineraries: vi.fn(async () => [{ id: 7, destination: "Cape Town" }]),
  getTravelConversationForUser: vi.fn(async (userId: number, conversationId: number) => userId === 1 && conversationId === 44 ? { id: 44, userId } : undefined),
  getTravelMessages: vi.fn(async () => [
    { id: 1, role: "user", content: "Plan a trip from Durban to Cape Town" },
    { id: 2, role: "assistant", content: "How many days and what budget?" },
    { id: 3, role: "user", content: "I have 4 days" },
  ]),
  saveItinerary: vi.fn(async () => 7),
}));

const mockedLlm = vi.hoisted(() => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "- **Budget:** R4,000\n- Check Travelstart or Skyscanner for live prices." } }] })),
}));

vi.mock("./db", () => mockedDb);
vi.mock("./_core/llm", () => mockedLlm);

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

  it("asks a focused follow-up for partial plans while still answering a direct travel question", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    mockedLlm.invokeLLM.mockClear();

    const partial = await caller.travel.chat({ messages: [{ role: "user", content: "Plan my trip to Cape Town" }] });
    expect(partial.reply).toContain("Where are you travelling from?");
    expect(partial.reply).toContain("How many days do you have?");
    expect(mockedLlm.invokeLLM).not.toHaveBeenCalled();

    const directQuestion = await caller.travel.chat({
      messages: [
        { role: "user", content: "Plan my trip to Cape Town" },
        { role: "assistant", content: partial.reply },
        { role: "user", content: "Is Cape Town safe for solo travellers?" },
      ],
    });
    expect(directQuestion.reply).toContain("Check Travelstart or Skyscanner for live prices.");
    expect(mockedLlm.invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("loads stored messages before completing and saving a multi-turn trip plan", async () => {
    const caller = appRouter.createCaller(travellerContext);
    mockedDb.saveItinerary.mockClear();
    const result = await caller.travel.chat({
      conversationId: 44,
      messages: [{ role: "user", content: "My budget is R7,500" }],
    });
    expect(result.conversationId).toBe(44);
    expect(result.itineraryId).toBe(7);
    expect(mockedDb.saveItinerary).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, destination: "Cape Town" }));
  });
});
