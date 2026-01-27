import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getFavorites, removeFavorite, clearAllFavorites, checkRSVPStatus } from "../../api";
import AppShell from "../../components/layout/AppShell";
import EventCard from "../../components/events/EventCard";

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

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpMap, setRsvpMap] = useState({}); // { eventId: true/false }

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

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        setError("");
        
        // Check if user is authenticated
        const token = localStorage.getItem("eventure_token");
        if (!token) {
          setError("Please log in to view your favorites");
          setFavorites([]);
          setLoading(false);
          return;
        }
        
        const data = await getFavorites();
        setFavorites(data || []);
        
        // Check RSVP status for favorite events
        if (data && data.length > 0) {
          const eventIds = data.map((e) => parseInt(e.id, 10)).filter((id) => !isNaN(id));
          if (eventIds.length > 0) {
            await checkRSVPsForEvents(eventIds);
          }
        }
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
        // If it's an auth error, show a helpful message
        if (err.message && err.message.includes("Authentication")) {
          setError("Please log in to view your favorites");
        } else {
          setError(err.message || "Failed to load favorites");
        }
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  const handleFavoriteClick = async (eventId, willBeFavorited) => {
    try {
      if (!willBeFavorited) {
        await removeFavorite(eventId);
        setFavorites((prev) => prev.filter((e) => e.id !== eventId));
      }
    } catch (err) {
      console.error("Failed to remove favorite:", err);
      alert(err.message || "Failed to remove favorite. Please try again.");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all favorites?")) {
      return;
    }
    try {
      await clearAllFavorites();
      setFavorites([]);
    } catch (err) {
      console.error("Failed to clear favorites:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* White Header Section */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#0f172b] mb-2">Favorites</h1>
              <p className="text-base text-[#45556c]">
                Events you've saved for later
              </p>
            </div>
            {favorites.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-[#2e6b4e] hover:text-[#255a43] hover:underline transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-[#45556c]">Loading favorites...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              {error.includes("log in") && (
                <Link
                  to="/login"
                  className="inline-block px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors"
                >
                  Go to Login
                </Link>
              )}
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#62748e] mx-auto"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[#0f172b] mb-2">No favorites yet</h2>
              <p className="text-[#45556c] mb-6">Start saving events you're interested in!</p>
              <Link
                to="/browse"
                className="inline-block px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors"
              >
                Browse Events
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((event) => {
                const dateText = formatEventDate(event.starts_at);
                const addressText = buildFullAddress(event);
                const imageUrl = event.main_image ? getImageUrl(event.main_image) : null;
                const price = event.ticket_price || 0;
                const capacity = event.capacity;
                const rsvpCount = event.rsvp_count || 0;
                const isRsvped = rsvpMap[event.id] || false;

                return (
                  <EventCard
                    key={event.id}
                    eventId={event.id}
                    title={event.title}
                    date={dateText}
                    location={addressText}
                    category={event.category}
                    price={price}
                    imageUrl={imageUrl}
                    viewMode="grid"
                    isFavorited={true}
                    isRsvped={isRsvped}
                    onFavoriteClick={handleFavoriteClick}
                    capacity={capacity}
                    rsvpCount={rsvpCount}
                  />
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </div>
  );
}

export default FavoritesPage;
