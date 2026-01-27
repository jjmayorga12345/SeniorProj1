import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getEventById, checkFavorite, addFavorite, removeFavorite, rsvpToEvent, cancelRSVP, checkRSVPStatus } from "../../api";
import EventMap from "../../components/EventMap";
import { getUserRole } from "../../utils/auth";

function formatEventDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTimeRange(startsAt, endsAt) {
  if (!startsAt && !endsAt) return "";
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  const fmt = (d) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return fmt(start);
  return fmt(end);
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

function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isRsvped, setIsRsvped] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getEventById(id);
        setEvent(data);
        
        // Check if event is favorited
        try {
          const favoriteCheck = await checkFavorite(id);
          setIsFavorited(favoriteCheck.isFavorited);
        } catch (err) {
          // If not authenticated, default to false
          setIsFavorited(false);
        }

        // Check RSVP status
        try {
          const rsvpCheck = await checkRSVPStatus(id);
          setIsRsvped(rsvpCheck.isRsvped);
        } catch (err) {
          // If not authenticated, default to false
          setIsRsvped(false);
        }
      } catch (err) {
        console.error("Failed to fetch event:", err);
        setError(err.message || "Failed to load event");
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleFavoriteClick = async () => {
    // Check if user is authenticated
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      navigate("/login", { state: { returnTo: `/events/${id}` } });
      return;
    }

    try {
      const willBeFavorited = !isFavorited;
      if (willBeFavorited) {
        await addFavorite(id);
      } else {
        await removeFavorite(id);
      }
      setIsFavorited(willBeFavorited);
    } catch (err) {
      console.error("Failed to update favorite:", err);
      alert(err.message || "Failed to update favorite. Please try again.");
    }
  };

  const handleRSVP = async () => {
    // Check if user is authenticated
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      navigate("/login", { state: { returnTo: `/events/${id}` } });
      return;
    }

    try {
      setRsvpLoading(true);
      if (isRsvped) {
        await cancelRSVP(id);
        setIsRsvped(false);
        // Refresh event to update RSVP count
        const updatedEvent = await getEventById(id);
        setEvent(updatedEvent);
      } else {
        await rsvpToEvent(id);
        setIsRsvped(true);
        // Refresh event to update RSVP count
        const updatedEvent = await getEventById(id);
        setEvent(updatedEvent);
      }
    } catch (err) {
      console.error("Failed to update RSVP:", err);
      alert(err.message || "Failed to update RSVP. Please try again.");
    } finally {
      setRsvpLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">
          <p className="text-[#45556c]">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-[#0f172b] mb-4">Event not found</h1>
          {error ? (
            <p className="text-[#45556c] mb-6">{error}</p>
          ) : (
            <p className="text-[#45556c] mb-6">
              The event you're looking for doesn't exist or has been removed.
            </p>
          )}
        </div>
      </div>
    );
  }

  const addressText = buildFullAddress(event);
  const dateText = formatEventDate(event.starts_at);
  const timeText = formatEventTimeRange(event.starts_at, event.ends_at);

  // Collect all available images (main_image + image_2, image_3, image_4)
  const allImages = [
    event.main_image,
    event.image_2,
    event.image_3,
    event.image_4,
  ].filter(Boolean); // Remove null/undefined values

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${API_URL}${imagePath}`;
  };

  const nextImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const prevImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }
  };

  return (
    <div className="font-[Arimo,sans-serif]">
      {/* Main Content */}
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero/Banner Area with Image Slideshow */}
        <div className="relative w-full h-80 rounded-[14px] overflow-hidden mb-6 bg-gradient-to-br from-[#2e6b4e] to-[#255a43]">
          {allImages.length > 0 ? (
            <>
              <img
                src={getImageUrl(allImages[currentImageIndex])}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              {/* Navigation arrows (only show if more than 1 image) */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                    aria-label="Previous image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                    aria-label="Next image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  {/* Image indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {allImages.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? "w-8 bg-white"
                            : "w-2 bg-white/50 hover:bg-white/75"
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/70 text-lg">Event Image</span>
            </div>
          )}
        </div>

        {/* Title and Category */}
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#0f172b] mb-3">{event.title}</h1>
              <span className="inline-block px-3 py-1 bg-[#2e6b4e]/10 text-[#2e6b4e] text-sm font-medium rounded-full">
                {event.category}
              </span>
            </div>
            <button
              onClick={handleFavoriteClick}
              className="p-3 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={isFavorited ? "#ef4444" : "none"}
                stroke={isFavorited ? "#ef4444" : "currentColor"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#45556c]"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* Date/Time Row */}
          <div className="flex items-center gap-2 text-[#45556c] mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="font-medium">{dateText}</span>
            {timeText ? <span className="text-[#62748e]">•</span> : null}
            {timeText ? <span>{timeText}</span> : null}
          </div>

          {/* Location Row */}
          <div className="flex items-center gap-2 text-[#45556c] mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="font-medium">{addressText}</span>
          </div>

          {/* Action Area: RSVP Button and Attendance */}
          <div className="pt-4 border-t border-[#e2e8f0]">
            {/* Attendance Count */}
            {event.capacity && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-[#45556c] mb-2">
                  <span className="font-medium">Attending</span>
                  <span>
                    {event.rsvp_count || 0} / {event.capacity}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#2e6b4e] h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((event.rsvp_count || 0) / event.capacity) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {!event.capacity && (event.rsvp_count > 0) && (
              <div className="mb-4 text-sm text-[#45556c]">
                <span className="font-medium">{event.rsvp_count}</span> attending
              </div>
            )}
            
            <button
              onClick={handleRSVP}
              disabled={rsvpLoading}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-colors text-base ${
                isRsvped
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[#2e6b4e] text-white hover:bg-[#255a43]"
              } ${rsvpLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {rsvpLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRsvped ? "Cancelling..." : "RSVPing..."}
                </span>
              ) : isRsvped ? (
                "Cancel RSVP"
              ) : (
                "RSVP"
              )}
            </button>
          </div>
        </div>

        {/* About This Event Section */}
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#0f172b] mb-4">About this event</h2>
          <p className="text-[#45556c] leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </div>

        {/* Organizer Info Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Organizer</h2>
          {event.organizer ? (
            <div className="flex items-center gap-4">
              {event.organizer.profilePicture ? (
                <img 
                  src={event.organizer.profilePicture.startsWith("http") 
                    ? event.organizer.profilePicture 
                    : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${event.organizer.profilePicture}`}
                  alt={`${event.organizer.firstName} ${event.organizer.lastName}`}
                  className="h-16 w-16 rounded-full object-cover border-2 border-[#e2e8f0] shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {event.organizer.firstName?.[0] || ""}{event.organizer.lastName?.[0] || ""}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-[#0f172b]">
                  {event.organizer.firstName} {event.organizer.lastName}
                </p>
                {event.organizer.showContactInfo && event.organizer.email && (
                  <a 
                    href={`mailto:${event.organizer.email}`}
                    className="text-sm text-[#2e6b4e] hover:underline mt-1 block"
                  >
                    {event.organizer.email}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img 
                src="/eventure-logo.png" 
                alt="Eventure" 
                className="h-12 w-auto shrink-0"
              />
              <div>
                <p className="text-sm text-[#45556c]">Organizer details coming soon</p>
              </div>
            </div>
          )}
        </div>

        {/* Map/Location Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6">
          <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Location</h2>
          <EventMap
            address={event.address_line1}
            venue={event.venue}
            city={event.city}
            state={event.state}
            zipCode={event.zip_code}
            lat={event.lat}
            lng={event.lng}
          />
        </div>
      </div>
    </div>
  );
}

export default EventDetailsPage;
