import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getUserRole } from "../../utils/auth";
import AppShell from "../../components/layout/AppShell";
import EventCard from "../../components/events/EventCard";
import { getEvents, getMyEvents } from "../../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${API_URL}${imagePath}`;
}

// Format date from database (starts_at) to readable format
function formatEventDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildFullAddress(event) {
  const address1 = String(event?.address_line1 ?? "").trim();
  if (!address1) {
    return String(event?.location ?? "").trim();
  }

  const parts = [];
  const venue = String(event?.venue ?? "").trim();
  const address2 = String(event?.address_line2 ?? "").trim();
  const city = String(event?.city ?? "").trim();
  const state = String(event?.state ?? "").trim();
  const zip = String(event?.zip_code ?? "").trim();

  if (venue) parts.push(venue);
  parts.push(address1);
  if (address2) parts.push(address2);
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  if (cityStateZip.trim()) parts.push(cityStateZip.trim());

  return parts.join(", ");
}

function DashboardPage() {
  const role = getUserRole();
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myEventsLoading, setMyEventsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch upcoming events for regular users
        if (role === "user") {
          const data = await getEvents({ limit: 3 });
          setEvents(data || []);
        }
        // Fetch user's events for organizers
        if (role === "organizer" || role === "admin") {
          setMyEventsLoading(true);
          try {
            const myData = await getMyEvents();
            setMyEvents(myData || []);
          } catch (err) {
            console.error("Failed to fetch my events:", err);
            setMyEvents([]);
          } finally {
            setMyEventsLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [role]);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-[#0f172b] mb-2">
            Welcome back!
          </h1>
          <p className="text-[#45556c]">
            {role === "admin"
              ? "Manage the platform and oversee events."
              : role === "organizer"
              ? "Create and manage your events."
              : "Discover and explore exciting events near you."}
          </p>
        </div>

        {/* User Role Content */}
        {role === "user" && (
          <>
            {/* Browse Categories */}
            <section>
              <h2 className="text-2xl font-semibold text-[#0f172b] mb-4">
                Browse
              </h2>
              <div className="flex flex-wrap gap-3 mb-6">
                {["Music", "Food", "Tech"].map((category) => (
                  <button
                    key={category}
                    className="px-4 py-2 bg-white border border-[#cad5e2] rounded-lg text-[#314158] hover:border-[#2e6b4e] hover:text-[#2e6b4e] transition-colors"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>

            {/* Upcoming Events */}
            <section>
              <h2 className="text-2xl font-semibold text-[#0f172b] mb-4">
                Upcoming Events
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-[#45556c]">Loading events...</p>
                </div>
              ) : events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:rounded-2xl"
                    >
                      <EventCard
                        eventId={parseInt(event.id, 10)}
                        title={event.title}
                        date={formatEventDate(event.starts_at)}
                        location={buildFullAddress(event)}
                        category={event.category}
                        price={event.ticket_price}
                        imageUrl={getImageUrl(event.main_image)}
                        capacity={event.capacity}
                        rsvpCount={event.rsvp_count || 0}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-12 text-center">
                  <p className="text-[#45556c]">No upcoming events available</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* Organizer Role Content */}
        {role === "organizer" && (
          <>
            {/* Create Event CTA */}
            <section>
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-[#0f172b] mb-2">
                  Create Your First Event
                </h2>
                <p className="text-[#45556c] mb-4">
                  Start organizing and share your event with the community.
                </p>
                <Link
                  to="/events/new"
                  className="inline-block px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors"
                >
                  Create Event
                </Link>
              </div>
            </section>

            {/* Your Events */}
            <section>
              <h2 className="text-2xl font-semibold text-[#0f172b] mb-4">
                Your Events
              </h2>
              {myEventsLoading ? (
                <div className="text-center py-12">
                  <p className="text-[#45556c]">Loading your events...</p>
                </div>
              ) : myEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myEvents.map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:rounded-2xl"
                    >
                      <EventCard
                        eventId={parseInt(event.id, 10)}
                        title={event.title}
                        date={formatEventDate(event.starts_at)}
                        location={buildFullAddress(event)}
                        category={event.category}
                        price={event.ticket_price}
                        imageUrl={getImageUrl(event.main_image)}
                        capacity={event.capacity}
                        rsvpCount={event.rsvp_count || 0}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">
                  <p className="text-[#45556c] mb-4">You haven't created any events yet.</p>
                  <Link
                    to="/events/new"
                    className="inline-block px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors"
                  >
                    Create your first event
                  </Link>
                </div>
              )}
            </section>
          </>
        )}

        {/* Admin Role Content */}
        {role === "admin" && (
          <section>
            <h2 className="text-2xl font-semibold text-[#0f172b] mb-4">
              Admin Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "User Management", icon: "👥" },
                { title: "Event Moderation", icon: "📋" },
                { title: "Reports", icon: "📊" },
              ].map((tool, index) => (
                <div
                  key={index}
                  className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 text-center"
                >
                  <div className="text-4xl mb-3">{tool.icon}</div>
                  <h3 className="font-semibold text-[#0f172b] mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-[#62748e]">Coming soon</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

export default DashboardPage;
