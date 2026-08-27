export type TravelChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const TRAVEL_MATE_GREETING = "Hey! I’m Travel Mate 🌍✈️ Where are we going next?";

export const TRAVEL_MATE_SYSTEM_PROMPT = `You are Travel Mate, a friendly, budget-savvy travel assistant for South Africa and beyond.

Voice: warm, excited, helpful, concise, and local-friend practical. Use emojis lightly. Write in short Markdown bullet points, never long paragraphs.

Conversation rule: Read the full conversation and carry forward useful trip details the traveller has already shared. Respond to the traveller’s latest message directly and naturally. If they ask a standalone question about safety, food, packing, weather, transport, or a destination, answer that question first; do not restart the trip-intake flow.

Trip intake rule: Before tailored itinerary advice, make sure you know where the traveller is leaving from, where they are going, how many days they have, and their budget in ZAR. Ask only for the details that are still missing, in one brief reply. Use this phrasing when all are unknown: “Where from? Where to? How many days? Budget?”

Planning rule: When the traveller asks to plan a trip and has provided the essentials, create a simple day-by-day itinerary. Offer 2–3 clearly labelled budget bands: Budget, Mid, and Luxury. Quote prices in ZAR as practical estimates, include approximate travel times, affordable transport choices such as Bolt, metered taxi, Baz Bus, or public transport when sensible, affordable stays such as hostels or Airbnb, and free activity ideas.

Trip-plan inclusion rule: Every completed trip plan must also include a compact packing list, relevant safety guidance for Cape Town and/or Johannesburg where applicable, a seasonal or best-time-to-visit note, local food to try, and the exact final sentence: “Want me to make this into a WhatsApp checklist?”

Accuracy rule: Never invent live flight, hotel, or ticket prices. For live prices, say exactly: “Check Travelstart or Skyscanner for live prices.” Be transparent that estimate ranges can change by season and availability.

Local advice: Give grounded, practical safety guidance such as using reputable ride services, keeping valuables out of sight, avoiding isolated areas at night, and asking accommodation hosts about neighbourhood-specific advice. Do not overstate danger. Keep every answer useful, calm, and short.`;

export type TripEssentials = {
  origin?: string;
  destination?: string;
  days?: string;
  budget?: string;
};

function firstMatch(messages: TravelChatMessage[], expression: RegExp) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const match = message.content.match(expression);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, " ");
  }
  return undefined;
}

export function collectTripEssentials(messages: TravelChatMessage[]): TripEssentials {
  const userMessages = messages.filter(message => message.role === "user");
  return {
    origin: firstMatch(userMessages, /\bfrom\s+([a-z][a-z\s'-]{1,60}?)(?=\s+(?:to|for|with|on)\b|[,.!?]|$)/i),
    destination: firstMatch(userMessages, /\b(?:to|visit|in|around)\s+([a-z][a-z\s'-]{2,60}?)(?:\s+(?:for|on|with|from|in)\b|[,.!?]|$)/i),
    days: firstMatch(userMessages, /\b(\d+\s*(?:day|days|night|nights))\b/i),
    budget: firstMatch(userMessages, /\b((?:r\s?\d+[\d,]*|zar\s?\d+[\d,]*|budget\s*(?:of|is|:)?\s*\d+[\d,]*))\b/i),
  };
}

export function missingTripEssentials(messages: TravelChatMessage[]) {
  const essentials = collectTripEssentials(messages);
  return ([
    !essentials.origin && "Where are you travelling from?",
    !essentials.destination && "Where are you heading to?",
    !essentials.days && "How many days do you have?",
    !essentials.budget && "What is your total budget in ZAR?",
  ].filter(Boolean) as string[]);
}

export function buildTripFollowUp(messages: TravelChatMessage[]) {
  const missing = missingTripEssentials(messages);
  if (missing.length === 4) return "Where from? Where to? How many days? Budget?";

  const knownDestination = collectTripEssentials(messages).destination;
  return `${knownDestination ? `Lovely — ${knownDestination} is a great choice. ` : "Lovely — "}Just send me:\n${missing.map(item => `- ${item}`).join("\n")}`;
}

export function isTripPlanningConversation(messages: TravelChatMessage[]) {
  return messages.some(message => message.role === "user" && isTripPlanRequest(message.content));
}

export function messageAddsTripDetail(message: string) {
  return /\b(from|to|visit|around|r\s?\d|zar\s?\d|budget|\d+\s*(?:day|days|night|nights))\b/i.test(message);
}

export function shouldAskTripFollowUp(messages: TravelChatMessage[]) {
  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") return false;
  return isTripPlanningConversation(messages)
    && missingTripEssentials(messages).length > 0
    && (isTripPlanRequest(lastMessage.content) || messageAddsTripDetail(lastMessage.content));
}

export function isTripPlanReady(messages: TravelChatMessage[]) {
  return isTripPlanningConversation(messages) && missingTripEssentials(messages).length === 0;
}

export function needsTripEssentials(message: string) {
  return isTripPlanRequest(message) && missingTripEssentials([{ role: "user", content: message }]).length > 0;
}

export function isTripPlanRequest(message: string) {
  return /\b(plan|itinerary|trip plan|organise|organize)\b/i.test(message);
}

export function extractDestination(message: string) {
  return collectTripEssentials([{ role: "user", content: message }]).destination;
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
  const essentials = collectTripEssentials(history);
  const knownDetails = Object.entries(essentials)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join("; ");

  return [
    {
      role: "system" as const,
      content: `${TRAVEL_MATE_SYSTEM_PROMPT}${knownDetails ? `\n\nConfirmed trip details from this conversation: ${knownDetails}.` : ""}`,
    },
    ...history.slice(-20).map(message => ({ role: message.role, content: message.content })),
  ];
}
