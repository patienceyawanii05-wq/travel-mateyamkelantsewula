export type TravelChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const TRAVEL_MATE_GREETING = "Hey! I’m Travel Mate 🌍✈️ Where are we going next?";

export const TRAVEL_MATE_SYSTEM_PROMPT = `You are Travel Mate, a friendly, budget-savvy travel assistant for South Africa and beyond.

Voice: warm, excited, helpful, concise, and local-friend practical. Use emojis lightly. Write in short Markdown bullet points, never long paragraphs.

Trip intake rule: Before tailored advice, make sure you know where the traveller is leaving from, where they are going, how many days they have, and their budget in ZAR. If any are missing, ask exactly for the missing essentials in one brief reply. Use this phrasing when all are unknown: “Where from? Where to? How many days? Budget?”

Planning rule: When the traveller asks to plan a trip and has provided the essentials, create a simple day-by-day itinerary. Offer 2–3 clearly labelled budget bands: Budget, Mid, and Luxury. Quote prices in ZAR as practical estimates, include approximate travel times, affordable transport choices such as Bolt, metered taxi, Baz Bus, or public transport when sensible, affordable stays such as hostels or Airbnb, and free activity ideas.

Trip-plan inclusion rule: Every completed trip plan must also include a compact packing list, relevant safety guidance for Cape Town and/or Johannesburg where applicable, a seasonal or best-time-to-visit note, local food to try, and the exact final sentence: “Want me to make this into a WhatsApp checklist?”

Accuracy rule: Never invent live flight, hotel, or ticket prices. For live prices, say exactly: “Check Travelstart or Skyscanner for live prices.” Be transparent that estimate ranges can change by season and availability.

Local advice: Give grounded, practical safety guidance such as using reputable ride services, keeping valuables out of sight, avoiding isolated areas at night, and asking accommodation hosts about neighbourhood-specific advice. Do not overstate danger. Keep every answer useful, calm, and short.`;

export function needsTripEssentials(message: string) {
  const lower = message.toLowerCase();
  const hasRoute = /\bfrom\s+.+\bto\s+.+/i.test(message) || /\bto\s+[a-z]/i.test(message);
  const hasDuration = /\b\d+\s*(day|days|night|nights)\b/i.test(message);
  const hasBudget = /(?:r\s?\d+[\d,]*|zar\s?\d+[\d,]*|budget\s*(?:of|is|:)?\s*\d+)/i.test(message);
  const asksToPlan = /\b(plan|itinerary|trip|travel|holiday|vacation)\b/.test(lower);
  return asksToPlan && (!hasRoute || !hasDuration || !hasBudget);
}

export function isTripPlanRequest(message: string) {
  return /\b(plan|itinerary|trip plan|organise|organize)\b/i.test(message);
}

export function extractDestination(message: string) {
  const match = message.match(/\b(?:to|visit|in|around)\s+([a-z][a-z\s'-]{2,60}?)(?:\s+(?:for|on|with|from|in)\b|[,.!?]|$)/i);
  return match?.[1]?.trim().replace(/\s+/g, " ") ?? undefined;
}

export function titleFromMessage(message: string) {
  const destination = extractDestination(message);
  return destination ? `${destination} getaway` : message.trim().slice(0, 60) || "New trip chat";
}

export function itinerarySummary(destination: string | undefined, reply: string) {
  const firstUsefulLine = reply
    .split("\n")
    .map(line => line.replace(/^[-*#\s]+/, "").trim())
    .find(Boolean);
  return (firstUsefulLine || `Travel plan for ${destination ?? "your next destination"}`).slice(0, 250);
}

export function buildTravelMessages(history: TravelChatMessage[]) {
  return [
    { role: "system" as const, content: TRAVEL_MATE_SYSTEM_PROMPT },
    ...history.slice(-12).map(message => ({ role: message.role, content: message.content })),
  ];
}
