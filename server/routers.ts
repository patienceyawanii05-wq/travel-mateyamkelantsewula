import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createTravelConversation,
  createTravelMessage,
  getRecentTravelConversations,
  getSavedItineraries,
  getTravelConversationForUser,
  getTravelMessages,
  saveItinerary as createSavedItinerary,
} from "./db";
import {
  buildTravelMessages,
  buildTripFollowUp,
  collectTripEssentials,
  extractDestination,
  isTripPlanReady,
  itinerarySummary,
  messageAddsTripDetail,
  shouldAskTripFollowUp,
  titleFromMessage,
  type TravelChatMessage,
} from "./travel";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(3000),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  travel: router({
    chat: publicProcedure
      .input(z.object({ messages: z.array(chatMessageSchema).min(1).max(60), conversationId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        const lastMessage = input.messages.at(-1);
        if (!lastMessage || lastMessage.role !== "user") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Send a traveller message to continue." });
        }

        let conversationHistory = input.messages as TravelChatMessage[];
        let conversationId = input.conversationId;

        if (ctx.user && conversationId) {
          const conversation = await getTravelConversationForUser(ctx.user.id, conversationId);
          if (!conversation) {
            throw new TRPCError({ code: "FORBIDDEN", message: "This travel conversation is not available." });
          }
          const storedMessages = await getTravelMessages(conversationId);
          conversationHistory = [...storedMessages.map(message => ({ role: message.role, content: message.content })), lastMessage];
        }

        const essentials = collectTripEssentials(conversationHistory);
        const destination = essentials.destination ?? extractDestination(lastMessage.content);
        let reply = "";

        if (shouldAskTripFollowUp(conversationHistory)) {
          reply = buildTripFollowUp(conversationHistory);
        } else {
          const completion = await invokeLLM({
            model: "gpt-5-mini",
            messages: buildTravelMessages(conversationHistory),
            maxTokens: 1400,
          });
          const rawReply = completion.choices[0]?.message?.content;
          reply = typeof rawReply === "string" ? rawReply.trim() : "";
        }

        if (!reply) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Travel Mate could not prepare a reply. Please try again." });
        }

        let itineraryId: number | undefined;
        if (ctx.user) {
          if (!conversationId) {
            conversationId = await createTravelConversation(ctx.user.id, titleFromMessage(lastMessage.content), destination);
          }
          await createTravelMessage(conversationId, "user", lastMessage.content);
          await createTravelMessage(conversationId, "assistant", reply);

          if (isTripPlanReady(conversationHistory) && messageAddsTripDetail(lastMessage.content) && destination) {
            itineraryId = await createSavedItinerary({
              userId: ctx.user.id,
              conversationId,
              destination,
              summary: itinerarySummary(destination, reply),
              itineraryBody: reply,
            });
          }
        }

        return { reply, conversationId, itineraryId, destination };
      }),
    conversations: protectedProcedure.query(({ ctx }) => getRecentTravelConversations(ctx.user.id)),
    messages: protectedProcedure
      .input(z.object({ conversationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const conversation = await getTravelConversationForUser(ctx.user.id, input.conversationId);
        if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." });
        return getTravelMessages(input.conversationId);
      }),
    saveItinerary: protectedProcedure
      .input(z.object({
        conversationId: z.number().int().positive().optional(),
        destination: z.string().trim().min(2).max(160),
        summary: z.string().trim().min(2).max(255),
        itineraryBody: z.string().trim().min(2).max(15000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const conversation = await getTravelConversationForUser(ctx.user.id, input.conversationId);
          if (!conversation) throw new TRPCError({ code: "FORBIDDEN", message: "This travel conversation is not available." });
        }
        const itineraryId = await createSavedItinerary({ userId: ctx.user.id, ...input });
        return { itineraryId };
      }),
    itineraries: protectedProcedure.query(({ ctx }) => getSavedItineraries(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
