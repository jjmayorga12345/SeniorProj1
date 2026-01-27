import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../components/layout/AppShell";
import EventCard from "../../components/events/EventCard";
import { getEvents } from "../../api";

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

const CATEGORIES = ["All", "Music", "Food", "Tech", "Sports", "Arts"];

function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getEvents();
        setEvents(data || []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setError(err.message || "Failed to load events");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        buildFullAddress(event).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || event.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-[#0f172b]">Events</h1>

        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search events by title or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
            />
          </div>

          {/* Category Dropdown */}
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#45556c]">Loading events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
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
            <p className="text-[#45556c] text-lg mb-2">No events found</p>
            <p className="text-sm text-[#62748e]">
              Try adjusting your search or category filter.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default EventsPage;
