import { describe, expect, it } from "vitest";
import {
  TRAVEL_MATE_GREETING,
  TRAVEL_MATE_SYSTEM_PROMPT,
  buildTravelMessages,
  extractDestination,
  isTripPlanRequest,
  needsTripEssentials,
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
    expect(prompt).toHaveLength(13);
    expect(prompt[0]?.role).toBe("system");
    expect(prompt[1]?.content).toBe("Message 3");
  });
});
