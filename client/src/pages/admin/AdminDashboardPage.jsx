import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getCurrentUser } from "../../utils/auth";
import { getAdminStats, getAllEvents, approveEvent, declineEvent, adminDeleteEvent, getAllUsers, getUserDetails, deleteUser, unattendUserFromEvent, getAnalytics } from "../../api";

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("events");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    pendingApprovals: 0,
    popularCategory: { name: "N/A", count: 0 },
  });
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  // Memoize user to prevent unnecessary re-renders - only parse once
  const user = useMemo(() => getCurrentUser(), []);

  // Memoize loadData to prevent recreation on every render
  const loadData = useCallback(async () => {
    try {
      setEventsLoading(true);
      console.log("Loading admin data...");
      
      // Load stats first, then events separately to see which one fails
      try {
        const statsData = await getAdminStats();
        console.log("Stats data:", statsData);
        setStats(statsData || {
          totalUsers: 0,
          totalEvents: 0,
          pendingApprovals: 0,
          popularCategory: { name: "N/A", count: 0 },
        });
      } catch (statsErr) {
        console.error("Failed to load stats:", statsErr);
        setStats({
          totalUsers: 0,
          totalEvents: 0,
          pendingApprovals: 0,
          popularCategory: { name: "N/A", count: 0 },
        });
      }
      
      try {
        const eventsData = await getAllEvents();
        console.log("Events data:", eventsData);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      } catch (eventsErr) {
        console.error("Failed to load events:", eventsErr);
        alert(`Failed to load events: ${eventsErr.message || "Unknown error"}`);
        setEvents([]);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
      console.error("Error details:", err.message, err.stack);
      // Don't show alert here since we're handling errors individually above
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Check authentication and authorization only once
  useEffect(() => {
    try {
      // Check if user is admin
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      if (user.role !== "admin") {
        navigate("/", { replace: true });
        return;
      }

      setLoading(false);
      
      // Load data only once after auth check passes
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadData();
      }
    } catch (err) {
      console.error("AdminDashboardPage error:", err);
      setError(err.message);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadData]);

  const handleApprove = async (eventId) => {
    if (!window.confirm("Are you sure you want to approve this event?")) return;
    try {
      console.log("Approving event:", eventId);
      await approveEvent(eventId);
      alert("Event approved successfully!");
      await loadData(); // Reload data
    } catch (err) {
      console.error("Failed to approve event:", err);
      alert(err.message || "Failed to approve event");
    }
  };

  const handleDecline = async (eventId) => {
    if (!window.confirm("Are you sure you want to decline this event?")) return;
    try {
      console.log("Declining event:", eventId);
      await declineEvent(eventId);
      alert("Event declined successfully!");
      await loadData(); // Reload data
    } catch (err) {
      console.error("Failed to decline event:", err);
      alert(err.message || "Failed to decline event");
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
    try {
      console.log("Deleting event:", eventId);
      await adminDeleteEvent(eventId);
      alert("Event deleted successfully!");
      await loadData(); // Reload data
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert(err.message || "Failed to delete event");
    }
  };

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const usersData = await getAllUsers();
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error("Failed to load users:", err);
      alert(`Failed to load users: ${err.message || "Unknown error"}`);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleUserClick = async (userId) => {
    try {
      setUserDetailsLoading(true);
      const details = await getUserDetails(userId);
      setUserDetails(details);
      setSelectedUser(userId);
      setDeleteConfirmText("");
    } catch (err) {
      console.error("Failed to load user details:", err);
      alert(err.message || "Failed to load user details");
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !userDetails) return;
    
    if (userDetails.user.role === "admin") {
      alert("Cannot delete admin users");
      return;
    }

    if (deleteConfirmText.toLowerCase() !== "confirm") {
      alert('Please type "confirm" to delete this user');
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to delete ${userDetails.user.firstName} ${userDetails.user.lastName}? This will permanently delete their account and all associated events. This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteUser(selectedUser);
      alert("User deleted successfully!");
      setSelectedUser(null);
      setUserDetails(null);
      setDeleteConfirmText("");
      await loadUsers();
      await loadData(); // Reload stats
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnattendUser = async (eventId) => {
    if (!selectedUser || !userDetails) return;
    
    if (!window.confirm("Are you sure you want to unattend this user from this event?")) {
      return;
    }

    try {
      await unattendUserFromEvent(selectedUser, eventId);
      alert("User unattended successfully!");
      // Reload user details
      await handleUserClick(selectedUser);
    } catch (err) {
      console.error("Failed to unattend user:", err);
      alert(err.message || "Failed to unattend user");
    }
  };

  const handleDeleteEventFromUser = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }

    try {
      await adminDeleteEvent(eventId);
      alert("Event deleted successfully!");
      // Reload user details
      if (selectedUser) {
        await handleUserClick(selectedUser);
      }
      await loadData(); // Reload stats
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert(err.message || "Failed to delete event");
    }
  };

  // Load users when users tab is active
  useEffect(() => {
    if (activeTab === "users" && users.length === 0 && !usersLoading) {
      loadUsers();
    }
  }, [activeTab, users.length, usersLoading, loadUsers]);

  // Load analytics when analytics tab is active
  const loadAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const analyticsData = await getAnalytics();
      setAnalytics(analyticsData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      alert(`Failed to load analytics: ${err.message || "Unknown error"}`);
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "analytics" && analytics === null && !analyticsLoading) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      Campus: "bg-green-100 text-green-800",
      Tech: "bg-green-100 text-green-800",
      Concerts: "bg-green-100 text-green-800",
      Charity: "bg-green-100 text-green-800",
      Sports: "bg-green-100 text-green-800",
      Fairs: "bg-orange-100 text-orange-800",
      Music: "bg-green-100 text-green-800",
      Food: "bg-green-100 text-green-800",
      Arts: "bg-green-100 text-green-800",
      Business: "bg-green-100 text-green-800",
      Networking: "bg-green-100 text-green-800",
      Workshop: "bg-green-100 text-green-800",
      Conference: "bg-green-100 text-green-800",
      Festival: "bg-green-100 text-green-800",
      Other: "bg-gray-100 text-gray-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status) => {
    if (status === "approved") return "bg-green-100 text-green-800";
    if (status === "pending") return "bg-orange-100 text-orange-800";
    if (status === "declined") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 border-r border-gray-200 flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Admin Panel</h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <button
              onClick={() => setActiveTab("events")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "events"
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
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
              Events
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "users"
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Users
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "reports"
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Reports
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === "analytics"
                  ? "bg-green-50 text-green-700 font-medium"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
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
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Analytics
            </button>
          </div>
        </nav>

        {/* Back to Site */}
        <div className="p-4 border-t border-gray-200">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
          >
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Back to Site
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#f9fafb' }}>
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">Manage events, users, and platform analytics</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
                Export Data
              </button>
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.firstName?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Users */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
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
                  className="text-gray-400"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">{stats.totalUsers}</p>
              <p className="text-sm text-green-600 flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                +12% this month
              </p>
            </div>

            {/* Total Events */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Total Events</h3>
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
                  className="text-gray-400"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">{stats.totalEvents}</p>
              <p className="text-sm text-green-600 flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                +8% this month
              </p>
            </div>

            {/* Pending Approval */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Pending Approval</h3>
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
                  className="text-gray-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">{stats.pendingApprovals}</p>
              <p className="text-sm text-red-600">Requires attention</p>
            </div>

            {/* Popular Category */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Popular Category</h3>
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
                  className="text-gray-400"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">{stats.popularCategory.name}</p>
              <p className="text-sm text-gray-600">{stats.popularCategory.count} events</p>
            </div>
          </div>

          {/* Event Management Section */}
          {activeTab === "events" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Event Management</h2>
                    <p className="text-sm text-gray-600">Review and manage all platform events</p>
                  </div>
                </div>
                {/* Search Bar */}
                <div className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search events by title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {eventsLoading ? (
                  <div className="p-8 text-center text-gray-600">Loading events...</div>
                ) : (() => {
                  // Filter events based on search query
                  const filteredEvents = searchQuery.trim()
                    ? events.filter((event) =>
                        event.title?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    : events;
                  
                  return filteredEvents.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">
                      {searchQuery ? `No events found matching "${searchQuery}"` : "No events found"}
                    </div>
                  ) : (
                    <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Organizer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{event.title}</div>
                            <div className="text-sm text-gray-500">
                              {event.rsvp_count || 0} attending
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{event.organizer_name || "N/A"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(
                                event.category
                              )}`}
                            >
                              {event.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(event.starts_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                event.status
                              )}`}
                            >
                              {event.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {event.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(event.id)}
                                    className="text-green-600 hover:text-green-900"
                                    title="Approve"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDecline(event.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Decline"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDelete(event.id)}
                                className="text-gray-600 hover:text-red-600"
                                title="Delete"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Users Section */}
          {activeTab === "users" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">User Management</h2>
                    <p className="text-sm text-gray-600">View and manage platform users</p>
                  </div>
                </div>
                {/* Search Bar */}
                <div className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users by email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2e6b4e] focus:border-transparent"
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    {userSearchQuery && (
                      <button
                        onClick={() => setUserSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {usersLoading ? (
                  <div className="p-8 text-center text-gray-600">Loading users...</div>
                ) : (() => {
                  const filteredUsers = userSearchQuery.trim()
                    ? users.filter((user) =>
                        user.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                    : users;
                  
                  return filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-600">
                      {userSearchQuery ? `No users found matching "${userSearchQuery}"` : "No users found"}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Joined
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                          <tr 
                            key={user.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleUserClick(user.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {user.first_name} {user.last_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{user.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  user.role === "admin"
                                    ? "bg-purple-100 text-purple-800"
                                    : user.role === "organizer"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(user.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Analytics Section */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {analyticsLoading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading analytics...</p>
                </div>
              ) : analytics ? (
                <>
                  {/* Key Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                      <h3 className="text-sm font-medium text-blue-100 mb-2">Engagement Rate</h3>
                      <p className="text-3xl font-bold mb-1">
                        {analytics.totals.totalEvents > 0 
                          ? Math.round((analytics.totals.totalRsvps / analytics.totals.totalEvents) * 10) / 10
                          : 0}
                      </p>
                      <p className="text-sm text-blue-100">RSVPs per event</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                      <h3 className="text-sm font-medium text-green-100 mb-2">Approval Rate</h3>
                      <p className="text-3xl font-bold mb-1">
                        {analytics.totals.totalEvents > 0
                          ? Math.round((analytics.totals.approvedEvents / analytics.totals.totalEvents) * 100)
                          : 0}%
                      </p>
                      <p className="text-sm text-green-100">Events approved</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                      <h3 className="text-sm font-medium text-purple-100 mb-2">User Activity</h3>
                      <p className="text-3xl font-bold mb-1">
                        {analytics.totals.totalUsers > 0
                          ? Math.round((analytics.totals.totalEvents / analytics.totals.totalUsers) * 10) / 10
                          : 0}
                      </p>
                      <p className="text-sm text-purple-100">Events per user</p>
                    </div>
                  </div>

                  {/* Growth Trends */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Growth Trends</h3>
                        <p className="text-sm text-gray-600 mt-1">Platform activity over the last 12 months</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Events Chart */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Events Created</h4>
                        {analytics.eventsOverTime.length > 0 ? (
                          <div className="flex items-end gap-1.5 h-48">
                            {analytics.eventsOverTime.map((item, index) => {
                              const maxCount = Math.max(...analytics.eventsOverTime.map(e => parseInt(e.count)), 1);
                              const height = maxCount > 0 ? (parseInt(item.count) / maxCount) * 100 : 0;
                              const monthLabel = new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' });
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center group">
                                  <div className="w-full flex flex-col items-center justify-end h-full relative">
                                    <div
                                      className="w-full bg-gradient-to-t from-[#2e6b4e] to-[#3a8a6a] rounded-t hover:from-[#255a43] hover:to-[#2e6b4e] transition-all cursor-pointer shadow-sm"
                                      style={{ height: `${height}%`, minHeight: height > 0 ? '8px' : '0' }}
                                      title={`${monthLabel}: ${item.count} events`}
                                    >
                                      <span className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-2 py-1 rounded shadow-md z-10">
                                        {item.count}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight">
                                    {monthLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-8">No data</p>
                        )}
                      </div>

                      {/* Users Chart */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">New Users</h4>
                        {analytics.usersOverTime.length > 0 ? (
                          <div className="flex items-end gap-1.5 h-48">
                            {analytics.usersOverTime.map((item, index) => {
                              const maxCount = Math.max(...analytics.usersOverTime.map(u => parseInt(u.count)), 1);
                              const height = maxCount > 0 ? (parseInt(item.count) / maxCount) * 100 : 0;
                              const monthLabel = new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' });
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center group">
                                  <div className="w-full flex flex-col items-center justify-end h-full relative">
                                    <div
                                      className="w-full bg-gradient-to-t from-blue-500 to-blue-600 rounded-t hover:from-blue-600 hover:to-blue-700 transition-all cursor-pointer shadow-sm"
                                      style={{ height: `${height}%`, minHeight: height > 0 ? '8px' : '0' }}
                                      title={`${monthLabel}: ${item.count} users`}
                                    >
                                      <span className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-2 py-1 rounded shadow-md z-10">
                                        {item.count}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight">
                                    {monthLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-8">No data</p>
                        )}
                      </div>

                      {/* RSVPs Chart */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">RSVPs</h4>
                        {analytics.rsvpsOverTime.length > 0 ? (
                          <div className="flex items-end gap-1.5 h-48">
                            {analytics.rsvpsOverTime.map((item, index) => {
                              const maxCount = Math.max(...analytics.rsvpsOverTime.map(r => parseInt(r.count)), 1);
                              const height = maxCount > 0 ? (parseInt(item.count) / maxCount) * 100 : 0;
                              const monthLabel = new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' });
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center group">
                                  <div className="w-full flex flex-col items-center justify-end h-full relative">
                                    <div
                                      className="w-full bg-gradient-to-t from-purple-500 to-purple-600 rounded-t hover:from-purple-600 hover:to-purple-700 transition-all cursor-pointer shadow-sm"
                                      style={{ height: `${height}%`, minHeight: height > 0 ? '8px' : '0' }}
                                      title={`${monthLabel}: ${item.count} RSVPs`}
                                    >
                                      <span className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-2 py-1 rounded shadow-md z-10">
                                        {item.count}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight">
                                    {monthLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-8">No data</p>
                        )}
                      </div>
                    </div>
                  </div>


                  {/* Distribution Analysis */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Events by Category */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Category Distribution</h3>
                      <p className="text-sm text-gray-600 mb-4">Most popular event categories</p>
                      {analytics.eventsByCategory.length > 0 ? (
                        <div className="space-y-3">
                          {analytics.eventsByCategory.slice(0, 8).map((item, index) => {
                            const maxCount = Math.max(...analytics.eventsByCategory.map(e => parseInt(e.count)), 1);
                            const width = maxCount > 0 ? (parseInt(item.count) / maxCount) * 100 : 0;
                            const percentage = analytics.totals.approvedEvents > 0 
                              ? Math.round((parseInt(item.count) / analytics.totals.approvedEvents) * 100)
                              : 0;
                            return (
                              <div key={index} className="flex items-center gap-3">
                                <div className="w-28 text-sm font-medium text-gray-700 truncate">{item.category}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-[#2e6b4e] to-[#3a8a6a] h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3 shadow-sm"
                                    style={{ width: `${width}%` }}
                                  >
                                    {width > 20 && (
                                      <span className="text-xs text-white font-semibold">{item.count}</span>
                                    )}
                                  </div>
                                  {width <= 20 && (
                                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-700 font-semibold">
                                      {item.count}
                                    </span>
                                  )}
                                </div>
                                <div className="w-12 text-right text-xs font-semibold text-gray-600">{percentage}%</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-8">No data available</p>
                      )}
                    </div>

                    {/* Events by Status */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Status Overview</h3>
                      <p className="text-sm text-gray-600 mb-4">Event approval pipeline</p>
                      {analytics.eventsByStatus.length > 0 ? (
                        <div className="space-y-4">
                          {analytics.eventsByStatus.map((item, index) => {
                            const percentage = analytics.totals.totalEvents > 0
                              ? Math.round((parseInt(item.count) / analytics.totals.totalEvents) * 100)
                              : 0;
                            return (
                              <div key={index} className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                                      {item.status.toUpperCase()}
                                    </span>
                                    <span className="text-2xl font-bold text-gray-900">{item.count}</span>
                                  </div>
                                  <span className="text-lg font-semibold text-gray-600">{percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className={`h-2.5 rounded-full transition-all duration-500 ${
                                      item.status === 'approved' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                      item.status === 'pending' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                      'bg-gradient-to-r from-red-500 to-red-600'
                                    }`}
                                    style={{
                                      width: `${percentage}%`
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm text-center py-8">No data available</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-600">Failed to load analytics data</p>
                </div>
              )}
            </div>
          )}

          {/* Placeholder for other tabs */}
          {activeTab !== "events" && activeTab !== "users" && activeTab !== "analytics" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} section coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">User Details</h2>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserDetails(null);
                  setDeleteConfirmText("");
                }}
                className="text-gray-400 hover:text-gray-600"
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {userDetailsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading user details...</p>
                </div>
              ) : userDetails ? (
                <>
                  {/* User Info */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">User Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="text-base font-medium text-gray-900">
                          {userDetails.user.firstName} {userDetails.user.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="text-base font-medium text-gray-900">{userDetails.user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Role</p>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            userDetails.user.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : userDetails.user.role === "organizer"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {userDetails.user.role}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Joined</p>
                        <p className="text-base font-medium text-gray-900">
                          {formatDate(userDetails.user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pending Events */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Pending Event Listings ({userDetails.pendingEvents?.length || 0})
                    </h3>
                    {!userDetails.pendingEvents || userDetails.pendingEvents.length === 0 ? (
                      <p className="text-gray-600 text-sm">No pending events</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetails.pendingEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{event.title}</p>
                                <p className="text-sm text-gray-600">
                                  {event.category} • {formatDate(event.starts_at)} • {event.rsvp_count || 0} attending
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                                  {event.status}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEventFromUser(event.id);
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete event"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Created Events */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Active Event Listings ({userDetails.createdEvents.length})
                    </h3>
                    {userDetails.createdEvents.length === 0 ? (
                      <p className="text-gray-600 text-sm">No active events created</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetails.createdEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{event.title}</p>
                                <p className="text-sm text-gray-600">
                                  {event.category} • {formatDate(event.starts_at)} • {event.rsvp_count || 0} attending
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                                  {event.status}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEventFromUser(event.id);
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete event"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attending Events */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Events Attending ({userDetails.attendingEvents.length})
                    </h3>
                    {userDetails.attendingEvents.length === 0 ? (
                      <p className="text-gray-600 text-sm">Not attending any events</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetails.attendingEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{event.title}</p>
                                <p className="text-sm text-gray-600">
                                  {event.category} • {formatDate(event.starts_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                                  {event.status}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnattendUser(event.id);
                                  }}
                                  className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Unattend user from event"
                                >
                                  Unattend
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete User Section */}
                  {userDetails.user.role !== "admin" && (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800 mb-4">
                          Deleting this user will permanently remove their account and all associated events. This action cannot be undone.
                        </p>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type "confirm" to delete this user:
                          </label>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type 'confirm' to delete"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                        </div>
                        <button
                          onClick={handleDeleteUser}
                          disabled={isDeleting || deleteConfirmText.toLowerCase() !== "confirm"}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? "Deleting..." : "Delete User"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
