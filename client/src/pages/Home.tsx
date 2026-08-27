import { AIChatBox, type Message } from "@/components/AIChatBox";
import { MapView } from "@/components/Map";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  CircleDollarSign,
  Compass,
  History,
  LogOut,
  MapPin,
  Menu,
  Plane,
  Route,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const GREETING = "Hey! I’m Travel Mate 🌍✈️ Where are we going next?";
const SCENIC_CAPE_IMAGE = "/manus-storage/travel-mate-cape-peninsula_0b15f3c6.jpeg";

const starters = [
  "Plan 3 days in Cape Town",
  "Affordable Jozi weekend",
  "Garden Route on a budget",
];

const destinations = [
  { name: "Cape Town", place: "Cape Town, South Africa", origin: "Cape Town International Airport", lat: -33.9249, lng: 18.4241, note: "Ocean, colour & mountains" },
  { name: "Johannesburg", place: "Johannesburg, South Africa", origin: "O.R. Tambo International Airport", lat: -26.2041, lng: 28.0473, note: "Culture, food & city energy" },
  { name: "Durban", place: "Durban, South Africa", origin: "King Shaka International Airport", lat: -29.8587, lng: 31.0218, note: "Warm water & easy days" },
  { name: "Garden Route", place: "Knysna, South Africa", origin: "George Airport", lat: -34.0363, lng: 23.0471, note: "Slow roads & wild coast" },
];

function getDestinationFromText(text: string) {
  const found = destinations.find(destination => text.toLowerCase().includes(destination.name.toLowerCase()));
  return found ?? { name: text, place: text, origin: "", lat: -30.5595, lng: 22.9375, note: "A new place to explore" };
}

function RouteMap({ destination, origin }: { destination: { name: string; place: string; lat: number; lng: number }; origin: string }) {
  const [mapIssue, setMapIssue] = useState<"loading" | "route" | "map" | null>("loading");

  useEffect(() => setMapIssue("loading"), [destination.name, origin]);

  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-white/55 bg-white/50">
      <MapView
        key={`${destination.name}-${origin}`}
        initialCenter={{ lat: destination.lat, lng: destination.lng }}
        initialZoom={11}
        className="h-[260px] sm:h-[310px]"
        onMapError={() => setMapIssue("map")}
        onMapReady={map => {
          if (!window.google) return;
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: destination.place }, (results, status) => {
            if (status === "OK" && results?.[0]) {
              const location = results[0].geometry.location;
              map.setCenter(location);
              new window.google.maps.Marker({ map, position: location, title: destination.name });
            }
          });
          if (!origin.trim()) {
            setMapIssue("route");
            return;
          }
          const renderer = new window.google.maps.DirectionsRenderer({
            map,
            preserveViewport: false,
            polylineOptions: { strokeColor: "#80578c", strokeOpacity: 0.75, strokeWeight: 4 },
          });
          const service = new window.google.maps.DirectionsService();
          service.route(
            {
              origin,
              destination: destination.place,
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === "OK" && result) {
                renderer.setDirections(result);
                setMapIssue(null);
              } else {
                setMapIssue("route");
              }
            },
          );
        }}
      />
      {mapIssue === "map" && (
        <div className="absolute inset-0 flex items-end overflow-hidden bg-[#5b4563] p-5 text-white">
          <img src={SCENIC_CAPE_IMAGE} alt="" className="absolute inset-0 size-full object-cover opacity-35 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#3f284b]/90 via-[#604c69]/65 to-[#ca9db4]/30" />
          <div className="relative max-w-sm">
            <p className="font-mono-label text-[9px] text-white/70">ROUTE SNAPSHOT</p>
            <p className="font-editorial mt-2 text-2xl leading-none">{origin || "Your starting point"} <span className="not-italic text-white/65">→</span> {destination.name}</p>
            <p className="mt-3 text-xs leading-5 text-white/80">The interactive map is unavailable in this browser session. Your trip chat and saved plans are still ready to use.</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-[#fffdfc]/88 px-3 py-2.5 text-xs text-[#5c4666] shadow-sm backdrop-blur-md">
        <span className="flex items-center gap-1.5"><Route className="size-3.5" /> {mapIssue === "loading" ? "Drawing your route…" : mapIssue === "route" ? "Add a clear start point for directions" : mapIssue === "map" ? "Map unavailable — chat still works" : "Route context ready"}</span>
        <span className="font-mono-label text-[9px]">MAP VIEW</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: GREETING }]);
  const [activeConversationId, setActiveConversationId] = useState<number>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(destinations[0]);
  const [routeOrigin, setRouteOrigin] = useState(destinations[0].origin);
  const [routeDestination, setRouteDestination] = useState(destinations[0].place);

  const conversations = trpc.travel.conversations.useQuery(undefined, { enabled: isAuthenticated });
  const itineraries = trpc.travel.itineraries.useQuery(undefined, { enabled: isAuthenticated });
  const conversationMessages = trpc.travel.messages.useQuery(
    { conversationId: activeConversationId ?? 0 },
    { enabled: isAuthenticated && Boolean(activeConversationId) },
  );

  useEffect(() => {
    if (!conversationMessages.data) return;
    setMessages(conversationMessages.data.map(message => ({ role: message.role, content: message.content })));
  }, [conversationMessages.data]);

  const chat = trpc.travel.chat.useMutation({
    onSuccess: result => {
      setMessages(current => [...current, { role: "assistant", content: result.reply }]);
      if (result.conversationId) setActiveConversationId(result.conversationId);
      if (result.destination) {
        const destination = getDestinationFromText(result.destination);
        setSelectedDestination(destination);
        setRouteDestination(destination.place);
        setRouteOrigin(destination.origin);
      }
      if (isAuthenticated) {
        void utils.travel.conversations.invalidate();
        void utils.travel.itineraries.invalidate();
      }
      if (result.itineraryId) toast.success("Itinerary saved to your Travel Shelf");
    },
    onError: error => {
      setMessages(current => current.slice(0, -1));
      toast.error(error.message || "Travel Mate needs a moment. Please try again.");
    },
  });

  const latestAssistantMessage = [...messages].reverse().find(message => message.role === "assistant" && message.content !== GREETING);
  const savePlan = trpc.travel.saveItinerary.useMutation({
    onSuccess: () => {
      void utils.travel.itineraries.invalidate();
      toast.success("Your itinerary is safely on the Travel Shelf");
    },
    onError: error => toast.error(error.message || "Your plan could not be saved just yet."),
  });

  const routeSummary = useMemo(() => selectedDestination.note, [selectedDestination]);

  function sendMessage(content: string) {
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    chat.mutate({
      messages: nextMessages.filter(
        (message): message is { role: "user" | "assistant"; content: string } => message.role !== "system",
      ).slice(-60),
      conversationId: activeConversationId,
    });
  }

  function startNewTrip() {
    setActiveConversationId(undefined);
    setMessages([{ role: "assistant", content: GREETING }]);
    setMenuOpen(false);
  }

  function openConversation(conversationId: number) {
    setActiveConversationId(conversationId);
    setMenuOpen(false);
  }

  function chooseDestination(destination: (typeof destinations)[number]) {
    setSelectedDestination(destination);
    setRouteDestination(destination.place);
    setRouteOrigin(destination.origin);
  }

  function saveLatestPlan() {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!latestAssistantMessage) {
      toast.message("Ask Travel Mate for a trip plan first.");
      return;
    }
    savePlan.mutate({
      conversationId: activeConversationId,
      destination: selectedDestination.name,
      summary: latestAssistantMessage.content.replace(/[#*_`]/g, "").replace(/\n+/g, " ").slice(0, 250),
      itineraryBody: latestAssistantMessage.content,
    });
  }

  return (
    <div className="min-h-screen overflow-hidden text-[#34243f]">
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:linear-gradient(to_right,transparent_0,transparent_calc(50%-0.5px),rgba(83,54,100,0.07)_50%,transparent_calc(50%+0.5px),transparent_100%)] [background-size:180px_100%]" />

      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <button onClick={startNewTrip} className="group flex items-center gap-3 text-left" aria-label="Start a new trip chat">
          <span className="grid size-10 place-items-center rounded-full border border-[#8b6599]/35 bg-white/65 text-[#765084] shadow-sm transition-transform duration-200 group-hover:-rotate-6">
            <Compass className="size-5" />
          </span>
          <span>
            <span className="font-editorial block text-[1.3rem] leading-none tracking-tight">Travel Mate</span>
            <span className="font-mono-label mt-1 block text-[8px] text-[#765d7e]">TRIP INTELLIGENCE</span>
          </span>
        </button>

        <nav className="hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6c5773] md:flex">
          <a href="#planner" className="transition-colors hover:text-[#382342]">Plan a trip</a>
          <a href="#routes" className="transition-colors hover:text-[#382342]">Route context</a>
          <a href="#shelf" className="transition-colors hover:text-[#382342]">Travel shelf</a>
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {!authLoading && isAuthenticated ? (
            <>
              <span className="hidden max-w-28 truncate text-sm text-[#6a5571] lg:inline">{user?.name || "Traveller"}</span>
              <Button variant="outline" size="sm" onClick={() => void logout()} className="border-[#856493]/35 bg-white/50 text-[#5e4668] hover:bg-white">
                <LogOut className="mr-1.5 size-3.5" /> Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={startLogin} className="rounded-full bg-[#62436f] px-4 text-white shadow-[0_8px_22px_rgba(98,67,111,0.22)] hover:bg-[#51355e]">
              Save your trips <ArrowUpRight className="ml-1.5 size-3.5" />
            </Button>
          )}
        </div>

        <button onClick={() => setMenuOpen(open => !open)} className="grid size-10 place-items-center rounded-full border border-[#8b6599]/30 bg-white/55 md:hidden" aria-label="Open navigation">
          {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </header>

      {menuOpen && (
        <div className="relative z-30 mx-5 rounded-2xl border border-[#8b6599]/25 bg-white/90 p-5 shadow-xl backdrop-blur-xl md:hidden">
          <div className="grid gap-3 text-sm text-[#5f4968]">
            <a href="#planner" onClick={() => setMenuOpen(false)}>Plan a trip</a>
            <a href="#routes" onClick={() => setMenuOpen(false)}>Route context</a>
            <a href="#shelf" onClick={() => setMenuOpen(false)}>Travel shelf</a>
            {!isAuthenticated && <button className="text-left font-medium text-[#51355e]" onClick={startLogin}>Sign in to save trips</button>}
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 lg:px-12">
        <section className="mb-8 grid items-end gap-8 pt-7 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div className="max-w-3xl">
            <p className="font-mono-label mb-5 text-[10px] text-[#806289]">A GENTLER WAY TO GO</p>
            <h1 className="font-editorial max-w-2xl text-[2.95rem] leading-[0.95] tracking-[-0.04em] text-[#34223d] sm:text-6xl lg:text-7xl">
              Plan beautifully.<br /><em className="font-normal text-[#7d5c85]">Spend wisely.</em>
            </h1>
          </div>
          <p className="max-w-md border-l border-[#886895]/35 pl-5 text-[15px] leading-7 text-[#6c5573] lg:mb-2 lg:ml-auto">
            Thoughtful trips with local context, sensible budgets, and the room to wander your own way.
          </p>
        </section>

        <section id="planner" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_345px]">
          <div className="editorial-card corner-brackets overflow-hidden rounded-[1.8rem] p-2 sm:p-3">
            <div className="flex items-center justify-between border-b border-[#8d6a98]/20 px-4 pb-3 pt-2 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#7b5a88]/10 text-[#795486]"><Sparkles className="size-4" /></span>
                <div>
                  <p className="font-editorial text-lg leading-none">Your trip studio</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#806789]">Personal, practical, unhurried</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveLatestPlan} disabled={!latestAssistantMessage || savePlan.isPending} className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#765084] transition-colors hover:text-[#422a4e] disabled:cursor-not-allowed disabled:opacity-40">{savePlan.isPending ? "Saving…" : "Save plan"}</button>
                <button onClick={startNewTrip} className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#765084] hover:text-[#422a4e]">New trip</button>
              </div>
            </div>
            <AIChatBox
              messages={messages}
              onSendMessage={sendMessage}
              isLoading={chat.isPending}
              placeholder="Tell me about the trip you’re dreaming of…"
              height="min(580px, 68vh)"
              className="border-0 bg-transparent shadow-none"
              suggestedPrompts={starters}
            />
          </div>

          <aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <div className="editorial-card rounded-[1.6rem] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono-label text-[9px] text-[#84648d]">START HERE</p>
                <Plane className="size-4 text-[#80608a]" />
              </div>
              <h2 className="font-editorial text-2xl leading-tight">A good plan begins with four things.</h2>
              <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                {["Where from", "Where to", "How many days", "Budget in ZAR"].map((item, index) => (
                  <span key={item} className="rounded-xl border border-[#9b789f]/20 bg-white/50 px-3 py-2.5 text-[#644d6d]">
                    <span className="mr-1.5 font-mono-label text-[9px] text-[#9b7095]">0{index + 1}</span>{item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative min-h-[240px] overflow-hidden rounded-[1.6rem] border border-white/65 bg-[#6f5a77] p-5 text-white shadow-[0_16px_40px_rgba(77,54,86,0.16)] sm:p-6">
              <img src={SCENIC_CAPE_IMAGE} alt="Cape Peninsula coastline" className="absolute inset-0 size-full object-cover opacity-60 mix-blend-luminosity" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#4c3158]/75 via-[#64516f]/48 to-[#c49ab3]/35" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono-label text-[9px] text-white/75">TRAVEL NOTE</span>
                  <MapPin className="size-4" />
                </div>
                <div>
                  <p className="font-editorial text-3xl leading-none">The journey is part of the plan.</p>
                  <p className="mt-3 max-w-[28ch] text-sm leading-5 text-white/80">Routes, local travel time, smart stays, and moments worth making time for.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section id="routes" className="mt-14 grid gap-6 lg:grid-cols-[0.73fr_1.27fr]">
          <div className="flex flex-col justify-between py-2 lg:py-6">
            <div>
              <p className="font-mono-label mb-4 text-[10px] text-[#806289]">ROUTE CONTEXT</p>
              <h2 className="font-editorial max-w-md text-4xl leading-[1.05] tracking-[-0.03em]">See the shape of the day before you arrive.</h2>
              <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#6c5573]">Start with the airport-to-centre picture, then ask Travel Mate to thread in beach days, hiking, food, culture, or a night out.</p>
            </div>
            <div className="mt-7 hidden items-center gap-3 lg:flex">
              <span className="grid size-10 place-items-center rounded-full border border-[#997aa0]/25 bg-white/55 text-[#775584]"><Timer className="size-4" /></span>
              <p className="text-sm text-[#66506e]"><strong className="font-medium text-[#402c4a]">Practical at heart.</strong><br />Estimated route context, not a fixed booking.</p>
            </div>
          </div>

          <div className="editorial-card rounded-[1.8rem] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2 pt-1 sm:px-3">
              <div>
                <p className="font-editorial text-xl">{selectedDestination.name}</p>
                <p className="mt-1 text-xs text-[#785e80]">{routeSummary}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {destinations.map(destination => (
                  <button
                    key={destination.name}
                    onClick={() => chooseDestination(destination)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all",
                      selectedDestination.name === destination.name
                        ? "border-[#765084] bg-[#765084] text-white"
                        : "border-[#9a769f]/25 bg-white/45 text-[#765d7e] hover:bg-white",
                    )}
                  >
                    {destination.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#775d7d]">Start point
                <input value={routeOrigin} onChange={event => setRouteOrigin(event.target.value)} placeholder="e.g. Cape Town International Airport" className="h-10 rounded-xl border border-[#9a769f]/25 bg-white/60 px-3 text-sm normal-case tracking-normal text-[#513b5a] outline-none focus:border-[#765084]" />
              </label>
              <label className="grid gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#775d7d]">Destination
                <input value={routeDestination} onChange={event => setRouteDestination(event.target.value)} placeholder="Where are you going?" className="h-10 rounded-xl border border-[#9a769f]/25 bg-white/60 px-3 text-sm normal-case tracking-normal text-[#513b5a] outline-none focus:border-[#765084]" />
              </label>
            </div>
            <RouteMap destination={{ ...selectedDestination, name: routeDestination || selectedDestination.name, place: routeDestination || selectedDestination.place }} origin={routeOrigin} />
          </div>
        </section>

        <section id="shelf" className="mt-14 border-t border-[#8c6b95]/25 pt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono-label mb-3 text-[10px] text-[#806289]">YOUR TRAVEL SHELF</p>
              <h2 className="font-editorial text-3xl">Keep the good ideas close.</h2>
            </div>
            {!isAuthenticated && (
              <button onClick={startLogin} className="inline-flex items-center gap-1 text-sm font-medium text-[#62436f] hover:text-[#3b2445]">
                Sign in to save plans <ChevronRight className="size-4" />
              </button>
            )}
          </div>

          {isAuthenticated ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="editorial-card rounded-[1.5rem] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#d9f0e7] text-[#527467]"><Bookmark className="size-4" /></span>
                  <div><h3 className="font-editorial text-xl">Saved itineraries</h3><p className="text-xs text-[#7a657f]">Plans you can return to</p></div>
                </div>
                {itineraries.isLoading ? <p className="text-sm text-[#75617c]">Loading your shelf…</p> : itineraries.data?.length ? (
                  <div className="grid gap-2.5">
                    {itineraries.data.map(itinerary => (
                      <button key={itinerary.id} onClick={() => setMessages([{ role: "assistant", content: itinerary.itineraryBody }])} className="rounded-xl border border-[#94739b]/20 bg-white/45 p-3 text-left transition-colors hover:bg-white">
                        <p className="font-medium text-[#513b5a]">{itinerary.destination}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#765f7b]">{itinerary.summary}</p>
                      </button>
                    ))}
                  </div>
                ) : <p className="rounded-xl bg-[#f4eaf1]/65 p-4 text-sm leading-6 text-[#755f79]">When you ask for a full trip plan, your itinerary will live here for your next planning session.</p>}
              </div>

              <div className="editorial-card rounded-[1.5rem] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#eee5f5] text-[#755781]"><History className="size-4" /></span>
                  <div><h3 className="font-editorial text-xl">Recent conversations</h3><p className="text-xs text-[#7a657f]">Pick up exactly where you paused</p></div>
                </div>
                {conversations.isLoading ? <p className="text-sm text-[#75617c]">Loading your conversations…</p> : conversations.data?.length ? (
                  <div className="grid gap-2.5">
                    {conversations.data.map(conversation => (
                      <button key={conversation.id} onClick={() => openConversation(conversation.id)} className="flex items-center justify-between gap-3 rounded-xl border border-[#94739b]/20 bg-white/45 p-3 text-left transition-colors hover:bg-white">
                        <span><span className="block font-medium text-[#513b5a]">{conversation.title}</span><span className="mt-1 block text-xs text-[#765f7b]">{conversation.destination || "Travel conversation"}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-[#80618b]" />
                      </button>
                    ))}
                  </div>
                ) : <p className="rounded-xl bg-[#eee5f5]/65 p-4 text-sm leading-6 text-[#755f79]">Your latest chats will appear here automatically once you are signed in.</p>}
              </div>
            </div>
          ) : (
            <div className="editorial-card grid gap-5 rounded-[1.5rem] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
              <div><p className="font-editorial text-2xl">A little library for your next chapter.</p><p className="mt-2 max-w-xl text-sm leading-6 text-[#725d79]">Sign in to keep every itinerary and continue your recent conversations across planning sessions.</p></div>
              <Button onClick={startLogin} className="rounded-full bg-[#62436f] px-5 text-white hover:bg-[#51355e]"><CircleDollarSign className="mr-2 size-4" />Save my plans</Button>
            </div>
          )}
        </section>

        <footer className="mt-14 flex flex-col gap-3 border-t border-[#8c6b95]/20 py-6 text-[10px] uppercase tracking-[0.13em] text-[#816a87] sm:flex-row sm:items-center sm:justify-between">
          <p>Travel Mate · Local feeling, clear planning</p>
          <p>For live transport and stay prices, check Travelstart or Skyscanner.</p>
        </footer>
      </main>
    </div>
  );
}
