import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getHeroSettings, updateHeroSettings, uploadHeroImage, getEvents } from "../../api";
import { getUserRole } from "../../utils/auth";
import EventCard from "../../components/events/EventCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${API_URL}${imagePath}`;
}

// Preset categories (same as CreateEventPage)
const CATEGORIES = [
  "Music",
  "Food",
  "Tech",
  "Sports",
  "Arts",
  "Business",
  "Campus",
  "Concerts",
  "Networking",
  "Workshop",
  "Conference",
  "Festival",
  "Other",
];

// Category icons mapping
const CATEGORY_ICONS = {
  Music: "🎵",
  Food: "🍔",
  Tech: "💻",
  Sports: "⚽",
  Arts: "🎨",
  Business: "💼",
  Campus: "🏫",
  Concerts: "🎤",
  Networking: "🤝",
  Workshop: "🔧",
  Conference: "📊",
  Festival: "🎪",
  Other: "📅",
};


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

function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("");
  const [mostAttendedEvent, setMostAttendedEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);



  // Fetch the most attended event
  useEffect(() => {
    const fetchMostAttendedEvent = async () => {
      try {
        setLoadingEvent(true);
        // Fetch all approved public events with their RSVP counts
        // The API already filters for approved and public events by default
        const events = await getEvents();
        
        if (events && events.length > 0) {
          // Find the event with the highest rsvp_count
          const mostAttended = events.reduce((max, event) => {
            const currentCount = event.rsvp_count || 0;
            const maxCount = max.rsvp_count || 0;
            return currentCount > maxCount ? event : max;
          }, events[0]);
          
          setMostAttendedEvent(mostAttended);
        }
      } catch (err) {
        console.error("Failed to fetch most attended event:", err);
      } finally {
        setLoadingEvent(false);
      }
    };

    fetchMostAttendedEvent();
  }, []);


  const handleCategoryClick = (category) => {
    navigate(`/browse?category=${encodeURIComponent(category)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section 
        className="relative text-white overflow-hidden"
        style={{
          backgroundImage: "url(/hero-background.png)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          minHeight: "400px",
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Discover Amazing Events Near You
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              Find and join exciting events happening in your area
            </p>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="bg-white border-b border-[#e2e8f0] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base placeholder:text-[rgba(10,10,10,0.5)] focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
              />
            </div>
            <div className="w-full md:w-48">
              <select className="w-full h-12 px-4 rounded-lg border border-[#cad5e2] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent cursor-pointer">
                <option>All Categories</option>
                <option>Music</option>
                <option>Food</option>
                <option>Tech</option>
              </select>
            </div>
            <button className="px-6 py-3 bg-[#2e6b4e] text-white rounded-lg font-medium hover:bg-[#255a43] transition-colors whitespace-nowrap">
              Search
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {["Today", "This Week", "Free", "Nearby", "Popular"].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter === selectedFilter ? "" : filter)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedFilter === filter
                    ? "bg-[#2e6b4e] text-white"
                    : "bg-gray-100 text-[#314158] hover:bg-gray-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section with Most Attended Event */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Story Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-[#0f172b] mb-4">How Eventure Was Started</h2>
            <div className="prose prose-lg max-w-none text-[#45556c]">
              <p className="text-lg leading-relaxed mb-4">
                Eventure began as a simple idea in a college dorm room. Three friends, frustrated by the difficulty of discovering local events and connecting with their community, decided to build something better.
              </p>
              <p className="text-lg leading-relaxed mb-4">
                What started as a weekend project quickly grew into a passion. We realized that finding events shouldn't be complicated—whether you're looking for a music festival, a tech meetup, a food tasting, or a networking event, everything should be in one place, easy to browse, and simple to join.
              </p>
              <p className="text-lg leading-relaxed mb-4">
                Today, Eventure has become a thriving platform where thousands of people discover amazing events every day. We've built a community that brings people together, helps organizers reach their audiences, and makes every day an opportunity to experience something new.
              </p>
              <p className="text-lg leading-relaxed">
                Our mission is simple: <strong className="text-[#2e6b4e]">to make event discovery effortless and community connection meaningful.</strong> Join us on this journey, and let's discover amazing events together.
              </p>
            </div>
          </div>

          {/* Most Attended Event Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-[#0f172b] mb-6">Current Most Attended Event</h2>
            {loadingEvent ? (
              <div className="text-center py-12">
                <p className="text-[#45556c]">Loading event...</p>
              </div>
            ) : mostAttendedEvent ? (
              <Link
                to={`/events/${mostAttendedEvent.id}`}
                className="focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:rounded-2xl block"
              >
                <EventCard
                  title={mostAttendedEvent.title}
                  date={formatEventDate(mostAttendedEvent.starts_at)}
                  location={buildFullAddress(mostAttendedEvent)}
                  category={mostAttendedEvent.category}
                  imageUrl={getImageUrl(mostAttendedEvent.main_image)}
                  capacity={mostAttendedEvent.capacity}
                  rsvpCount={mostAttendedEvent.rsvp_count || 0}
                  price={mostAttendedEvent.ticket_price || 0}
                  eventId={mostAttendedEvent.id}
                />
              </Link>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#45556c]">No events available yet</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Browse by Category */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#0f172b] mb-6">Browse by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-6 text-center hover:shadow-md hover:border-[#2e6b4e] transition-all group"
              >
                <div className="text-4xl mb-2">{CATEGORY_ICONS[category] || "📅"}</div>
                <p className="text-sm font-medium text-[#0f172b] group-hover:text-[#2e6b4e] transition-colors">
                  {category}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Subscribe */}
      <section className="bg-[#2e6b4e] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Stay Updated with New Events
            </h2>
            <p className="text-white/90 mb-6">
              Subscribe to our newsletter and never miss an exciting event
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 h-12 px-4 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
              <button className="px-6 py-3 bg-white text-[#2e6b4e] rounded-lg font-medium hover:bg-gray-100 transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172b] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img 
                  src="/eventure-logo.png" 
                  alt="Eventure" 
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-sm text-gray-400">
                Discover and join amazing events near you.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Explore</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/browse" className="hover:text-white transition-colors">
                    Browse Events
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-white transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-white transition-colors">
                    Categories
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-white transition-colors">
                    Help
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Eventure. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default HomePage;
