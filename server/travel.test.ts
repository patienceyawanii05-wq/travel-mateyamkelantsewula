import { describe, expect, it } from "vitest";
import {
  TRAVEL_MATE_GREETING,
  TRAVEL_MATE_SYSTEM_PROMPT,
  buildTravelMessages,
  buildTripFollowUp,
  collectTripEssentials,
  extractDestination,
  isTripPlanRequest,
  isTripPlanReady,
  missingTripEssentials,
  needsTripEssentials,
  shouldAskTripFollowUp,
  titleFromMessage,
} from "./travel";

describe("Travel Mate trip-planning rules", () => {
  it("uses the supplied welcome greeting and enforces live-price transparency", () => {
    expect(TRAVEL_MATE_GREETING).toBe("Hey! I’m Travel Mate 🌍✈️ Where are we going next?");
    expect(TRAVEL_MATE_SYSTEM_PROMPT).toContain("Check Travelstart or Skyscanner for live prices.");
    expect(TRAVEL_MATE_SYSTEM_PROMPT).toContain("Want me to make this into a WhatsApp checklist?");
  });

  it("recognises when a trip request is missing vital planning details", () => {
    expect(needsTripEssentials("Plan my trip to Cape Town")).toBe(true);
    expect(needsTripEssentials("Plan a Cape Town trip from Durban to Cape Town for 4 days with R8,000")).toBe(false);
  });

  it("carries trip essentials across multiple turns and asks only for what is missing", () => {
    const partialTrip = [
      { role: "user" as const, content: "Plan a trip to Cape Town" },
      { role: "assistant" as const, content: "Where are you travelling from?" },
      { role: "user" as const, content: "I am travelling from Durban" },
    ];
    expect(missingTripEssentials(partialTrip)).toEqual(["How many days do you have?", "What is your total budget in ZAR?"]);
    expect(buildTripFollowUp(partialTrip)).toContain("How many days do you have?");
    expect(shouldAskTripFollowUp(partialTrip)).toBe(true);

    const completeTrip = [...partialTrip, { role: "user" as const, content: "I have 4 days and R7,500" }];
    expect(collectTripEssentials(completeTrip)).toMatchObject({ origin: "Durban", destination: "Cape Town", days: "4 days", budget: "R7,500" });
    expect(isTripPlanReady(completeTrip)).toBe(true);
  });

  it("extracts a destination and builds a safe bounded prompt history", () => {
    const message = "Please plan a trip to Cape Town for 3 days with R6,000";
    expect(extractDestination(message)).toBe("Cape Town");
    expect(titleFromMessage(message)).toBe("Cape Town getaway");
    expect(isTripPlanRequest(message)).toBe(true);

    const history = Array.from({ length: 15 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `Message ${index}`,
    }));
    const prompt = buildTravelMessages(history);
    expect(prompt).toHaveLength(16);
    expect(prompt[0]?.role).toBe("system");
    expect(prompt[0]?.content).toContain("You are Travel Mate");
    expect(prompt[1]?.content).toBe("Message 0");
  });
});
