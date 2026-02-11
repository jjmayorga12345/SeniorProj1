import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getEventById,
  checkFavorite,
  addFavorite,
  removeFavorite,
  rsvpToEvent,
  cancelRSVP,
  checkRSVPStatus,
  getEventReviews,
  postEventReview,
  getEventDiscussion,
  postEventDiscussion,
  followOrganizer,
  unfollowOrganizer,
  checkFollowStatus,
} from "../../api";
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
  const [activeTab, setActiveTab] = useState("details");
  const [reviews, setReviews] = useState({ reviews: [], averageRating: 0, totalCount: 0 });
  const [discussionPosts, setDiscussionPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [discussionSubmitting, setDiscussionSubmitting] = useState(false);

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
          setIsRsvped(false);
        }

        // Load reviews and discussion (public)
        try {
          const rev = await getEventReviews(id);
          setReviews({ reviews: rev.reviews || [], averageRating: rev.averageRating || 0, totalCount: rev.totalCount || 0 });
        } catch (e) {
          console.warn("Event reviews failed (ensure backend is redeployed and DB has event_reviews table):", e?.message || e);
          setReviews({ reviews: [], averageRating: 0, totalCount: 0 });
        }
        try {
          const disc = await getEventDiscussion(id);
          setDiscussionPosts(disc.posts || []);
        } catch (e) {
          console.warn("Event discussion failed (ensure backend is redeployed and DB has event_discussion table):", e?.message || e);
          setDiscussionPosts([]);
        }

        // Check follow status if event has organizer and user is logged in
        if (data.created_by != null && localStorage.getItem("eventure_token")) {
          try {
            const followCheck = await checkFollowStatus(data.created_by);
            setIsFollowing(followCheck.following === true);
          } catch (e) {
            console.warn("Follow check failed:", e?.message || e);
            setIsFollowing(false);
          }
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

  const handleFollowClick = async () => {
    if (!event?.created_by) return;
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      navigate("/login", { state: { returnTo: `/events/${id}` } });
      return;
    }
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowOrganizer(event.created_by);
        setIsFollowing(false);
      } else {
        await followOrganizer(event.created_by);
        setIsFollowing(true);
      }
    } catch (err) {
      alert(err.message || "Failed to update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      navigate("/login", { state: { returnTo: `/events/${id}` } });
      return;
    }
    try {
      setReviewSubmitting(true);
      await postEventReview(id, { rating: reviewForm.rating, comment: reviewForm.comment.trim() || null });
      const rev = await getEventReviews(id);
      setReviews({ reviews: rev.reviews || [], averageRating: rev.averageRating || 0, totalCount: rev.totalCount || 0 });
      setReviewForm((prev) => ({ ...prev, comment: "" }));
    } catch (err) {
      alert(err.message || "Failed to save review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDiscussionSubmit = async (e) => {
    e.preventDefault();
    const msg = discussionMessage.trim();
    if (!msg) return;
    const token = localStorage.getItem("eventure_token");
    if (!token) {
      navigate("/login", { state: { returnTo: `/events/${id}` } });
      return;
    }
    try {
      setDiscussionSubmitting(true);
      await postEventDiscussion(id, msg);
      setDiscussionMessage("");
      const disc = await getEventDiscussion(id);
      setDiscussionPosts(disc.posts || []);
    } catch (err) {
      alert(err.message || "Failed to post");
    } finally {
      setDiscussionSubmitting(false);
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
          {reviews.totalCount > 0 && (
            <div className="flex items-center gap-2 mt-2 text-[#45556c]">
              <span className="flex text-amber-500" aria-label={`${reviews.averageRating} out of 5 stars`}>
                {"★".repeat(Math.round(reviews.averageRating))}
                {"☆".repeat(5 - Math.round(reviews.averageRating))}
              </span>
              <span className="text-sm">({reviews.averageRating.toFixed(1)}) · {reviews.totalCount} review{reviews.totalCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Tabs: Details | Discussion | Reviews */}
        <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-2 mb-6">
          <p className="text-xs font-medium text-[#62748e] mb-2 px-2">Event info</p>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {["details", "discussion", "reviews"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? "bg-white text-[#2e6b4e] shadow-sm" : "text-[#45556c] hover:text-[#0f172b]"
                }`}
              >
                {tab === "details" ? "Details" : tab === "discussion" ? "Discussion" : "Reviews"}
              </button>
            ))}
          </div>
        </div>

        {/* Details tab content */}
        {activeTab === "details" && (
          <>
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
                {event.created_by && (
                  <button
                    type="button"
                    onClick={handleFollowClick}
                    disabled={followLoading}
                    className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isFollowing
                        ? "bg-gray-200 text-[#45556c] hover:bg-gray-300"
                        : "bg-[#2e6b4e] text-white hover:bg-[#255a43]"
                    } ${followLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                  </button>
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
          </>
        )}

        {/* Discussion tab */}
        {activeTab === "discussion" && (
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Discussion</h2>
            <p className="text-sm text-[#45556c] mb-4">Ask questions, coordinate carpools, or chat with other attendees.</p>
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {discussionPosts.length === 0 ? (
                <p className="text-[#62748e] text-sm">No posts yet. Be the first to ask a question!</p>
              ) : (
                discussionPosts.map((post) => (
                  <div key={post.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white font-semibold text-sm">
                      {post.user?.firstName?.[0] || ""}{post.user?.lastName?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0f172b]">
                        {post.user?.firstName} {post.user?.lastName}
                      </p>
                      <p className="text-sm text-[#45556c] whitespace-pre-wrap mt-1">{post.message}</p>
                      <p className="text-xs text-[#62748e] mt-1">
                        {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleDiscussionSubmit} className="flex gap-2">
              <input
                type="text"
                value={discussionMessage}
                onChange={(e) => setDiscussionMessage(e.target.value)}
                placeholder="Ask a question or share something..."
                className="flex-1 h-12 px-4 rounded-lg border border-[#cad5e2] text-base focus:outline-none focus:ring-2 focus:ring-[#2e6b4e]"
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={!discussionMessage.trim() || discussionSubmitting}
                className="px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] disabled:opacity-50"
              >
                {discussionSubmitting ? "Posting..." : "Post"}
              </button>
            </form>
          </div>
        )}

        {/* Reviews tab */}
        {activeTab === "reviews" && (
          <div className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Reviews</h2>
            {reviews.totalCount > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="flex text-amber-500 text-xl">
                  {"★".repeat(Math.round(reviews.averageRating))}
                  {"☆".repeat(5 - Math.round(reviews.averageRating))}
                </span>
                <span className="text-[#45556c]">{reviews.averageRating.toFixed(1)} · {reviews.totalCount} review{reviews.totalCount !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
              {reviews.reviews.length === 0 ? (
                <p className="text-[#62748e] text-sm">No reviews yet. Be the first to leave one!</p>
              ) : (
                reviews.reviews.map((r) => (
                  <div key={r.id} className="flex gap-3 p-3 border-b border-[#e2e8f0] last:border-0">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white font-semibold text-sm">
                      {r.user?.firstName?.[0] || ""}{r.user?.lastName?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0f172b]">{r.user?.firstName} {r.user?.lastName}</p>
                      <p className="text-amber-500 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                      {r.comment && <p className="text-sm text-[#45556c] mt-1">{r.comment}</p>}
                      <p className="text-xs text-[#62748e] mt-1">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleReviewSubmit} className="border-t border-[#e2e8f0] pt-4">
              <label className="block text-sm font-medium text-[#314158] mb-2">Your rating</label>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewForm((prev) => ({ ...prev, rating: star }))}
                    className={`text-2xl focus:outline-none ${star <= reviewForm.rating ? "text-amber-500" : "text-gray-300"}`}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    {star <= reviewForm.rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium text-[#314158] mb-2">Comment (optional)</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Share your experience..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-[#cad5e2] text-base focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] mb-3"
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] disabled:opacity-50"
              >
                {reviewSubmitting ? "Saving..." : "Submit review"}
              </button>
            </form>
          </div>
        )}

        {/* Always-visible Discussion section (so it shows even if tabs/build is wrong) */}
        <section className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6" aria-label="Discussion">
          <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Discussion</h2>
          <p className="text-sm text-[#45556c] mb-4">Ask questions, coordinate carpools, or chat with other attendees.</p>
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {discussionPosts.length === 0 ? (
              <p className="text-[#62748e] text-sm">No posts yet. Be the first to ask a question!</p>
            ) : (
              discussionPosts.map((post) => (
                <div key={post.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white font-semibold text-sm">
                    {post.user?.firstName?.[0] || ""}{post.user?.lastName?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0f172b]">
                      {post.user?.firstName} {post.user?.lastName}
                    </p>
                    <p className="text-sm text-[#45556c] whitespace-pre-wrap mt-1">{post.message}</p>
                    <p className="text-xs text-[#62748e] mt-1">
                      {post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleDiscussionSubmit} className="flex gap-2">
            <input
              type="text"
              value={discussionMessage}
              onChange={(e) => setDiscussionMessage(e.target.value)}
              placeholder="Ask a question or share something..."
              className="flex-1 h-12 px-4 rounded-lg border border-[#cad5e2] text-base focus:outline-none focus:ring-2 focus:ring-[#2e6b4e]"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={!discussionMessage.trim() || discussionSubmitting}
              className="px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] disabled:opacity-50"
            >
              {discussionSubmitting ? "Posting..." : "Post"}
            </button>
          </form>
        </section>

        {/* Always-visible Reviews section */}
        <section className="bg-white border border-[#e2e8f0] rounded-[14px] shadow-sm p-6 mb-6" aria-label="Reviews">
          <h2 className="text-xl font-semibold text-[#0f172b] mb-4">Reviews</h2>
          {reviews.totalCount > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="flex text-amber-500 text-xl">
                {"★".repeat(Math.round(reviews.averageRating))}
                {"☆".repeat(5 - Math.round(reviews.averageRating))}
              </span>
              <span className="text-[#45556c]">{reviews.averageRating.toFixed(1)} · {reviews.totalCount} review{reviews.totalCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
            {reviews.reviews.length === 0 ? (
              <p className="text-[#62748e] text-sm">No reviews yet. Be the first to leave one!</p>
            ) : (
              reviews.reviews.map((r) => (
                <div key={r.id} className="flex gap-3 p-3 border-b border-[#e2e8f0] last:border-0">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white font-semibold text-sm">
                    {r.user?.firstName?.[0] || ""}{r.user?.lastName?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0f172b]">{r.user?.firstName} {r.user?.lastName}</p>
                    <p className="text-amber-500 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>
                    {r.comment && <p className="text-sm text-[#45556c] mt-1">{r.comment}</p>}
                    <p className="text-xs text-[#62748e] mt-1">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleReviewSubmit} className="border-t border-[#e2e8f0] pt-4">
            <label className="block text-sm font-medium text-[#314158] mb-2">Your rating</label>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm((prev) => ({ ...prev, rating: star }))}
                  className={`text-2xl focus:outline-none ${star <= reviewForm.rating ? "text-amber-500" : "text-gray-300"}`}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  {star <= reviewForm.rating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium text-[#314158] mb-2">Comment (optional)</label>
            <textarea
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
              placeholder="Share your experience..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-[#cad5e2] text-base focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] mb-3"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={reviewSubmitting}
              className="px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] disabled:opacity-50"
            >
              {reviewSubmitting ? "Saving..." : "Submit review"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default EventDetailsPage;
