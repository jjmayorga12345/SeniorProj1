import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { getEvents, getCategories, checkFavorite, addFavorite, removeFavorite, checkRSVPStatus } from "../../api";
import EventCard from "../../components/events/EventCard";

const RADIUS_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${API_URL}${imagePath}`;
}

function BrowseEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [radius, setRadius] = useState(10); // Default 10 miles
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "All");
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState(["All"]);
  const [favoritesMap, setFavoritesMap] = useState({});
  const [rsvpMap, setRsvpMap] = useState({});

  useEffect(() => {
    getCategories().then((list) => setCategories(["All", ...(list || [])])).catch(() => {});
  }, []);

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!localStorage.getItem("eventure_token");
  };

  // Handle event card click - redirect to login if not authenticated
  const handleEventClick = (e, eventId) => {
    if (!isAuthenticated()) {
      e.preventDefault();
      navigate("/login", { state: { returnTo: `/events/${eventId}` } });
    }
    // If authenticated, let the Link handle navigation normally
  };

  // Handle ZIP input - strip non-digits and cap at 5
  const handleZipChange = (e) => {
    const value = e.target.value;
    const digitsOnly = value.replace(/\D/g, "").slice(0, 5);
    setZipCode(digitsOnly);
  };

  // Check if ZIP is valid (exactly 5 digits)
  const isValidZip = /^\d{5}$/.test(zipCode);

  // Check favorite status for events
  const checkFavoritesForEvents = async (eventIds) => {
    // Check if user is authenticated first
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      // Not authenticated, set all to false
      const newFavoritesMap = {};
      eventIds.forEach((id) => {
        newFavoritesMap[id] = false;
      });
      setFavoritesMap(newFavoritesMap);
      return;
    }

    try {
      const favoriteChecks = await Promise.all(
        eventIds.map(async (id) => {
          try {
            const result = await checkFavorite(id);
            return { id, isFavorited: result.isFavorited || false };
          } catch (err) {
            // Log error for debugging
            console.warn(`Failed to check favorite for event ${id}:`, err.message);
            // If error, default to false
            return { id, isFavorited: false };
          }
        })
      );
      
      const newFavoritesMap = {};
      favoriteChecks.forEach(({ id, isFavorited }) => {
        newFavoritesMap[id] = isFavorited;
      });
      setFavoritesMap(newFavoritesMap);
    } catch (err) {
      console.error("Failed to check favorites:", err);
      // On error, set all to false
      const newFavoritesMap = {};
      eventIds.forEach((id) => {
        newFavoritesMap[id] = false;
      });
      setFavoritesMap(newFavoritesMap);
    }
  };

  // Check RSVP status for events
  const checkRSVPsForEvents = async (eventIds) => {
    // Check if user is authenticated first
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      // Not authenticated, set all to false
      const newRsvpMap = {};
      eventIds.forEach((id) => {
        newRsvpMap[id] = false;
      });
      setRsvpMap(newRsvpMap);
      return;
    }

    try {
      const rsvpChecks = await Promise.all(
        eventIds.map(async (id) => {
          try {
            const result = await checkRSVPStatus(id);
            return { id, isRsvped: result.isRsvped || false };
          } catch (err) {
            // Log error for debugging
            console.warn(`Failed to check RSVP for event ${id}:`, err.message);
            // If error, default to false
            return { id, isRsvped: false };
          }
        })
      );
      
      const newRsvpMap = {};
      rsvpChecks.forEach(({ id, isRsvped }) => {
        newRsvpMap[id] = isRsvped;
      });
      setRsvpMap(newRsvpMap);
    } catch (err) {
      console.error("Failed to check RSVPs:", err);
      // On error, set all to false
      const newRsvpMap = {};
      eventIds.forEach((id) => {
        newRsvpMap[id] = false;
      });
      setRsvpMap(newRsvpMap);
    }
  };

  // Update URL when category changes
  useEffect(() => {
    if (selectedCategory && selectedCategory !== "All") {
      setSearchParams({ category: selectedCategory });
    } else {
      setSearchParams({});
    }
  }, [selectedCategory, setSearchParams]);

  // Fetch events when filters change (category, zip, radius)
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        
        // If ZIP is invalid (not 5 digits), show 0 results without API call
        if (zipCode && !isValidZip) {
          setEvents([]);
          setLoading(false);
          return;
        }

        const params = {};
        
        // Category filter
        if (selectedCategory && selectedCategory !== "All") {
          params.category = selectedCategory;
        }
        
        // Only call API if ZIP is valid (5 digits) and radius is set
        if (isValidZip && zipCode) {
          params.zip = zipCode;
          params.radius = radius;
        }
        // If ZIP is empty, fetch all events (no radius filter)

        const data = await getEvents(params);
        setEvents(data || []);
        
        // Check favorite status for filtered events
        if (data && data.length > 0) {
          const eventIds = data.map((e) => parseInt(e.id, 10)).filter((id) => !isNaN(id));
          if (eventIds.length > 0) {
            await checkFavoritesForEvents(eventIds);
            await checkRSVPsForEvents(eventIds);
          }
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setError(err.message || "Failed to load events");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [zipCode, radius, isValidZip, selectedCategory]);

  // Client-side search filter (API returns category/zip-filtered; we filter by search text)
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase().trim();
    return events.filter((event) => {
      const title = (event.title || "").toLowerCase();
      const desc = (event.description || "").toLowerCase();
      const addr = buildFullAddress(event).toLowerCase();
      const cat = (event.category || "").toLowerCase();
      const venue = (event.venue || "").toLowerCase();
      return (
        title.includes(q) ||
        desc.includes(q) ||
        addr.includes(q) ||
        cat.includes(q) ||
        venue.includes(q)
      );
    });
  }, [events, searchQuery]);

  // Handle favorite click
  const handleFavoriteClick = async (eventId, willBeFavorited) => {
    // Check if user is authenticated
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      alert("Please log in to favorite events");
      return;
    }

    try {
      if (willBeFavorited) {
        await addFavorite(eventId);
      } else {
        await removeFavorite(eventId);
      }
      // Update local state immediately for better UX
      setFavoritesMap((prev) => ({
        ...prev,
        [eventId]: willBeFavorited,
      }));
    } catch (err) {
      console.error("Failed to update favorite:", err);
      alert(err.message || "Failed to update favorite. Please try again.");
      // Revert the change on error
      setFavoritesMap((prev) => ({
        ...prev,
        [eventId]: !willBeFavorited,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* White Header Section */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-[#0f172b] mb-2">Browse Events</h1>
          <p className="text-base text-[#45556c]">
            Discover exciting events happening near you
          </p>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
              />
            </div>

            {/* ZIP Code Input */}
            <div className="w-full sm:w-48">
              <input
                type="text"
                placeholder="ZIP code (e.g., 02910)"
                value={zipCode}
                onChange={handleZipChange}
                maxLength={5}
                className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
              />
            </div>

            {/* Radius Dropdown (only show when valid ZIP is entered) */}
            {isValidZip && (
              <div className="w-full sm:w-32">
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number.parseInt(e.target.value, 10))}
                  className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent cursor-pointer"
                >
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r} miles
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Dropdown */}
            <div className="w-full sm:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Filters Button */}
            <button className="px-6 py-3 bg-white border border-[#cad5e2] text-[#314158] rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Header with View Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#45556c]">
            {loading ? "Loading..." : `Showing ${filteredEvents.length} events`}
          </p>

          {/* View Toggle Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "grid"
                  ? "bg-[#2e6b4e] text-white"
                  : "bg-white border border-[#cad5e2] text-[#314158] hover:bg-gray-50"
              }`}
              aria-label="Grid view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-[#2e6b4e] text-white"
                  : "bg-white border border-[#cad5e2] text-[#314158] hover:bg-gray-50"
              }`}
              aria-label="List view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Events Grid/List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-[#45556c]">Loading events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#45556c]">No events available yet</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={(e) => handleEventClick(e, event.id)}
                className="focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:rounded-2xl cursor-pointer"
              >
                {isAuthenticated() ? (
                  <Link
                    to={`/events/${event.id}`}
                    className="block"
                  >
                    <EventCard
                      eventId={parseInt(event.id, 10)}
                      title={event.title}
                      date={formatEventDate(event.starts_at)}
                      location={buildFullAddress(event)}
                      category={event.category}
                      price={null}
                      imageUrl={getImageUrl(event.main_image)}
                      isFavorited={favoritesMap[parseInt(event.id, 10)] || false}
                      isRsvped={rsvpMap[parseInt(event.id, 10)] || false}
                      onFavoriteClick={handleFavoriteClick}
                      capacity={event.capacity !== null && event.capacity !== undefined ? event.capacity : null}
                      rsvpCount={event.rsvp_count !== null && event.rsvp_count !== undefined ? event.rsvp_count : 0}
                    />
                  </Link>
                ) : (
                  <EventCard
                    eventId={parseInt(event.id, 10)}
                    title={event.title}
                    date={formatEventDate(event.starts_at)}
                    location={buildFullAddress(event)}
                    category={event.category}
                    price={null}
                    imageUrl={getImageUrl(event.main_image)}
                    isFavorited={false}
                    isRsvped={false}
                    onFavoriteClick={handleFavoriteClick}
                    capacity={event.capacity !== null && event.capacity !== undefined ? event.capacity : null}
                    rsvpCount={event.rsvp_count !== null && event.rsvp_count !== undefined ? event.rsvp_count : 0}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={(e) => handleEventClick(e, event.id)}
                className="block focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:rounded-2xl cursor-pointer"
              >
                {isAuthenticated() ? (
                  <Link
                    to={`/events/${event.id}`}
                    className="block"
                  >
                    <EventCard
                      eventId={parseInt(event.id, 10)}
                      title={event.title}
                      date={formatEventDate(event.starts_at)}
                      location={buildFullAddress(event)}
                      category={event.category}
                      price={null}
                      imageUrl={getImageUrl(event.main_image)}
                      viewMode="list"
                      isFavorited={favoritesMap[parseInt(event.id, 10)] || false}
                      isRsvped={rsvpMap[parseInt(event.id, 10)] || false}
                      onFavoriteClick={handleFavoriteClick}
                      capacity={event.capacity !== null && event.capacity !== undefined ? event.capacity : null}
                      rsvpCount={event.rsvp_count !== null && event.rsvp_count !== undefined ? event.rsvp_count : 0}
                    />
                  </Link>
                ) : (
                  <EventCard
                    eventId={parseInt(event.id, 10)}
                    title={event.title}
                    date={formatEventDate(event.starts_at)}
                    location={buildFullAddress(event)}
                    category={event.category}
                    price={null}
                    imageUrl={getImageUrl(event.main_image)}
                    viewMode="list"
                    isFavorited={false}
                    isRsvped={false}
                    onFavoriteClick={handleFavoriteClick}
                    capacity={event.capacity !== null && event.capacity !== undefined ? event.capacity : null}
                    rsvpCount={event.rsvp_count !== null && event.rsvp_count !== undefined ? event.rsvp_count : 0}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowseEventsPage;
