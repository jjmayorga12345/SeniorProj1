import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { logout, getProfile } from "../../api";
import { getCurrentUser } from "../../utils/auth";
import RoleBadge from "../ui/RoleBadge";

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const isLoggedIn = !!user;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("eventure_token");
      localStorage.removeItem("eventure_user");
      setMobileMenuOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const navLinkClass = (path) => {
    const baseClass = "relative px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg";
    if (isActive(path)) {
      return `${baseClass} text-[#2e6b4e] bg-[#2e6b4e]/10`;
    }
    return `${baseClass} text-[#45556c] hover:text-[#2e6b4e] hover:bg-gray-50`;
  };

  const mobileNavLinkClass = (path) => {
    const baseClass = "block px-4 py-3 text-base font-medium transition-colors rounded-lg";
    if (isActive(path)) {
      return `${baseClass} text-[#2e6b4e] bg-[#2e6b4e]/10`;
    }
    return `${baseClass} text-[#45556c] hover:text-[#2e6b4e] hover:bg-gray-50`;
  };

  // Fetch profile to get latest profile picture
  useEffect(() => {
    if (isLoggedIn) {
      const fetchProfile = async () => {
        try {
          const profile = await getProfile();
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
          if (profile?.user?.profilePicture) {
            const pictureUrl = profile.user.profilePicture.startsWith("http")
              ? profile.user.profilePicture
              : `${API_URL}${profile.user.profilePicture}`;
            setProfilePictureUrl(pictureUrl);
          } else {
            setProfilePictureUrl(null);
          }
        } catch (err) {
          console.error("Failed to fetch profile:", err);
          // Fallback to user object from localStorage
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
          if (user?.profilePicture) {
            const pictureUrl = user.profilePicture.startsWith("http")
              ? user.profilePicture
              : `${API_URL}${user.profilePicture}`;
            setProfilePictureUrl(pictureUrl);
          } else {
            setProfilePictureUrl(null);
          }
        }
      };
      fetchProfile();
    } else {
      setProfilePictureUrl(null);
    }
  }, [isLoggedIn]);

  // Generate initials for avatar fallback
  const initials = user 
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "";

  return (
    <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2 group"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img 
              src="/eventure-logo.png" 
              alt="Eventure" 
              className="h-10 lg:h-12 w-auto shrink-0 transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={navLinkClass("/")}
            >
              Home
            </Link>
            <Link
              to="/browse"
              className={navLinkClass("/browse")}
            >
              Browse Events
            </Link>
            {isLoggedIn && (
              <>
                <Link
                  to="/favorites"
                  className={navLinkClass("/favorites")}
                >
                  Favorites
                </Link>
                <Link
                  to="/my-events"
                  className={navLinkClass("/my-events")}
                >
                  My Events
                </Link>
              </>
            )}
          </nav>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {(user.role === "organizer" || user.role === "admin") && (
                  <Link
                    to="/events/new"
                    className="px-4 py-2 bg-[#2e6b4e] text-white rounded-lg text-sm font-medium hover:bg-[#255a43] transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    + Create Event
                  </Link>
                )}
                <div className="flex items-center gap-3 pl-4 border-l border-[#e2e8f0]">
                  {/* Profile Picture Avatar */}
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#e2e8f0]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white text-sm font-semibold border-2 border-[#e2e8f0]">
                      {initials}
                    </div>
                  )}
                  
                  {/* Settings Icon with Dropdown */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setSettingsDropdownOpen(true)}
                    onMouseLeave={() => {
                      // Small delay to allow moving to dropdown
                      setTimeout(() => setSettingsDropdownOpen(false), 200);
                    }}
                  >
                    <button
                      className="p-1.5 text-[#ef4444] hover:text-[#dc2626] hover:bg-red-50 rounded-full transition-all duration-200"
                      aria-label="Settings"
                    >
                      <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                        />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu - with padding to bridge gap */}
                    {settingsDropdownOpen && (
                      <div 
                        className="absolute right-0 top-full pt-2 w-48 z-50"
                        onMouseEnter={() => setSettingsDropdownOpen(true)}
                        onMouseLeave={() => setSettingsDropdownOpen(false)}
                      >
                        <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-2">
                          <Link
                            to="/my-account"
                            className="block px-4 py-2 text-sm text-[#45556c] hover:bg-gray-50 hover:text-[#2e6b4e] transition-colors"
                            onClick={() => setSettingsDropdownOpen(false)}
                          >
                            My Account
                          </Link>
                          {user.role === "admin" && (
                            <Link
                              to="/admin"
                              className="block px-4 py-2 text-sm text-[#45556c] hover:bg-gray-50 hover:text-[#2e6b4e] transition-colors"
                              onClick={() => setSettingsDropdownOpen(false)}
                            >
                              Admin Panel
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#0f172b]">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-[#62748e]">{user.email}</p>
                  </div>
                  <RoleBadge role={user.role} />
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm text-[#62748e] hover:text-[#2e6b4e] hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm text-[#62748e] hover:text-[#2e6b4e] hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-[#2e6b4e] text-white rounded-lg text-sm font-medium hover:bg-[#255a43] transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-3">
            {isLoggedIn && (user.role === "organizer" || user.role === "admin") && (
              <Link
                to="/events/new"
                className="px-3 py-1.5 bg-[#2e6b4e] text-white rounded-lg text-xs font-medium hover:bg-[#255a43] transition-colors"
              >
                + Create
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#45556c] hover:text-[#2e6b4e] hover:bg-gray-50 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#e2e8f0] py-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-1">
              <Link
                to="/"
                className={mobileNavLinkClass("/")}
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/browse"
                className={mobileNavLinkClass("/browse")}
                onClick={() => setMobileMenuOpen(false)}
              >
                Browse Events
              </Link>
              {isLoggedIn ? (
                <>
                  <Link
                    to="/favorites"
                    className={mobileNavLinkClass("/favorites")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Favorites
                  </Link>
                  <Link
                    to="/my-events"
                    className={mobileNavLinkClass("/my-events")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Events
                  </Link>
                  <div className="px-4 py-3 border-t border-[#e2e8f0] mt-2">
                    <div className="flex items-center gap-3 mb-3">
                      {/* Profile Picture Avatar */}
                      {profilePictureUrl ? (
                        <img
                          src={profilePictureUrl}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#e2e8f0] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#2e6b4e] flex items-center justify-center text-white text-base font-semibold border-2 border-[#e2e8f0] shrink-0">
                          {initials}
                        </div>
                      )}
                      
                      {/* Settings Icon */}
                      <button
                        className="p-1.5 text-[#ef4444] hover:text-[#dc2626] hover:bg-red-50 rounded-full transition-all duration-200"
                        aria-label="Settings"
                        onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                      >
                        <svg 
                          className="w-5 h-5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                          />
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                          />
                        </svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0f172b] truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-[#62748e] truncate">{user.email}</p>
                      </div>
                      <RoleBadge role={user.role} />
                    </div>
                    
                    {/* Mobile Settings Dropdown */}
                    {settingsDropdownOpen && (
                      <div className="mb-3 bg-gray-50 rounded-lg py-2">
                        <Link
                          to="/my-account"
                          className="block px-4 py-2 text-sm text-[#45556c] hover:bg-gray-100 hover:text-[#2e6b4e] transition-colors"
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            setMobileMenuOpen(false);
                          }}
                        >
                          My Account
                        </Link>
                        {user.role === "admin" && (
                          <Link
                            to="/admin"
                            className="block px-4 py-2 text-sm text-[#45556c] hover:bg-gray-100 hover:text-[#2e6b4e] transition-colors"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              setMobileMenuOpen(false);
                            }}
                          >
                            Admin Panel
                          </Link>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-[#62748e] hover:text-[#2e6b4e] hover:bg-gray-50 rounded-lg transition-colors font-medium text-left"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-4 pt-3 border-t border-[#e2e8f0] mt-2 flex flex-col gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm text-[#62748e] hover:text-[#2e6b4e] hover:bg-gray-50 rounded-lg transition-colors font-medium text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 bg-[#2e6b4e] text-white rounded-lg text-sm font-medium hover:bg-[#255a43] transition-colors text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default NavBar;
