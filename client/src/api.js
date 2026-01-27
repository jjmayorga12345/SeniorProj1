const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseUrl = `${API_URL}/api`;

// Get authentication token from localStorage
function getAuthToken() {
  return localStorage.getItem("eventure_token");
}

// Build fetch options with Authorization header if token exists
function getFetchOptions(customOptions = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...customOptions.headers,
  };

  // Attach Authorization header if token exists
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    ...customOptions,
    headers,
    credentials: "include",
  };
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

export async function login(email, password) {
  try {
    const emailNormalized = normalizeEmail(email);
    const response = await fetch(`${baseUrl}/auth/login`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({ email: emailNormalized, password }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function register({ firstName, lastName, email, password, role }) {
  try {
    const emailNormalized = normalizeEmail(email);
    const body = { firstName, lastName, email: emailNormalized, password };
    if (role) body.role = role;

    const response = await fetch(`${baseUrl}/auth/register`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify(body),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function logout() {
  try {
    const response = await fetch(`${baseUrl}/auth/logout`, {
      ...getFetchOptions(),
      method: "POST",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function forgotPassword(email) {
  try {
    const emailNormalized = normalizeEmail(email);
    const response = await fetch(`${baseUrl}/auth/forgot-password`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({ email: emailNormalized }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function resetPasswordWithCode(email, code, newPassword) {
  try {
    const emailNormalized = normalizeEmail(email);
    const response = await fetch(`${baseUrl}/auth/reset-password-with-code`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({
        email: emailNormalized,
        code: String(code),
        newPassword,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Verify reset code
export async function verifyResetCode({ email, code }) {
  try {
    const emailNormalized = normalizeEmail(email);
    const response = await fetch(`${baseUrl}/auth/verify-reset-code`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({
        email: emailNormalized,
        code: String(code),
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Profile API functions
export async function getProfile() {
  try {
    const response = await fetch(`${baseUrl}/auth/profile`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Change Password API functions
export async function requestChangePasswordCode() {
  try {
    const response = await fetch(`${baseUrl}/auth/change-password-request`, {
      ...getFetchOptions(),
      method: "POST",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function changePassword(code, newPassword) {
  try {
    const response = await fetch(`${baseUrl}/auth/change-password`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({
        code: String(code),
        newPassword,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Delete Account API functions
export async function requestDeleteAccountCode() {
  try {
    const response = await fetch(`${baseUrl}/auth/delete-account-request`, {
      ...getFetchOptions(),
      method: "POST",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function deleteAccount(code) {
  try {
    const response = await fetch(`${baseUrl}/auth/delete-account`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({
        code: String(code),
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Get all categories
export async function getCategories() {
  try {
    const response = await fetch(`${baseUrl}/events/categories`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Reset password using /api/auth/reset-password endpoint
export async function resetPassword({ email, code, newPassword }) {
  try {
    const emailNormalized = normalizeEmail(email);
    const response = await fetch(`${baseUrl}/auth/reset-password`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify({
        email: emailNormalized,
        code: String(code),
        newPassword,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

function toQueryString(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    usp.set(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// Fetch events
export async function getEvents(params) {
  try {
    const response = await fetch(`${baseUrl}/events${toQueryString(params)}`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function getEventById(id) {
  try {
    const response = await fetch(`${baseUrl}/events/${id}`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Favorites API functions
export async function getFavorites() {
  try {
    const response = await fetch(`${baseUrl}/favorites`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function addFavorite(eventId) {
  try {
    const eventIdNum = parseInt(eventId, 10);
    if (isNaN(eventIdNum)) {
      throw new Error("Invalid event ID");
    }
    
    const response = await fetch(`${baseUrl}/favorites/${eventIdNum}`, {
      ...getFetchOptions(),
      method: "POST",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function removeFavorite(eventId) {
  try {
    const eventIdNum = parseInt(eventId, 10);
    if (isNaN(eventIdNum)) {
      throw new Error("Invalid event ID");
    }
    
    const response = await fetch(`${baseUrl}/favorites/${eventIdNum}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function checkFavorite(eventId) {
  try {
    const eventIdNum = parseInt(eventId, 10);
    if (isNaN(eventIdNum)) {
      throw new Error("Invalid event ID");
    }
    
    const response = await fetch(`${baseUrl}/favorites/check/${eventIdNum}`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function clearAllFavorites() {
  try {
    const response = await fetch(`${baseUrl}/favorites`, {
      ...getFetchOptions(),
      method: "DELETE",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// My Events API functions
export async function getMyEvents() {
  try {
    const response = await fetch(`${baseUrl}/events/my`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function getAttendingEvents() {
  try {
    const response = await fetch(`${baseUrl}/events/attending`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// deleteEvent for organizers (delete their own events)
export async function deleteEvent(eventId) {
  try {
    const eventIdNum = parseInt(eventId, 10);
    if (isNaN(eventIdNum)) {
      throw new Error("Invalid event ID");
    }
    
    const response = await fetch(`${baseUrl}/events/${eventIdNum}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Upload Event Image API function
export async function uploadEventImage(imageFile) {
  try {
    const formData = new FormData();
    formData.append("image", imageFile);

    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/upload/event-image`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Create Event API function
export async function createEvent(eventData) {
  try {
    const response = await fetch(`${baseUrl}/events`, {
      ...getFetchOptions(),
      method: "POST",
      body: JSON.stringify(eventData),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Update Event API function
export async function updateEvent(eventId, eventData) {
  try {
    const response = await fetch(`${baseUrl}/events/${eventId}`, {
      ...getFetchOptions(),
      method: "PUT",
      body: JSON.stringify(eventData),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// RSVP API functions
export async function rsvpToEvent(eventId) {
  try {
    const response = await fetch(`${baseUrl}/rsvp/${eventId}`, {
      ...getFetchOptions(),
      method: "POST",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function cancelRSVP(eventId) {
  try {
    const response = await fetch(`${baseUrl}/rsvp/${eventId}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function checkRSVPStatus(eventId) {
  try {
    const response = await fetch(`${baseUrl}/rsvp/${eventId}`, {
      ...getFetchOptions(),
      method: "GET",
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Admin API functions
export async function getAdminStats() {
  try {
    console.log("Fetching admin stats from:", `${baseUrl}/admin/stats`);
    const response = await fetch(`${baseUrl}/admin/stats`, {
      ...getFetchOptions(),
      method: "GET",
    });
    console.log("Stats response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      console.error("Stats error response:", errorData);
      throw new Error(errorData.message || `Failed to fetch stats: ${response.status}`);
    }
    
    return await handleResponse(response);
  } catch (error) {
    console.error("getAdminStats error:", error);
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function getAllEvents() {
  try {
    console.log("Fetching all events from:", `${baseUrl}/admin/events`);
    const response = await fetch(`${baseUrl}/admin/events`, {
      ...getFetchOptions(),
      method: "GET",
    });
    console.log("Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      console.error("Error response:", errorData);
      throw new Error(errorData.message || `Failed to fetch events: ${response.status}`);
    }
    
    return await handleResponse(response);
  } catch (error) {
    console.error("getAllEvents error:", error);
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function approveEvent(eventId) {
  try {
    const response = await fetch(`${baseUrl}/admin/events/${eventId}/approve`, {
      ...getFetchOptions(),
      method: "PUT",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function declineEvent(eventId) {
  try {
    const response = await fetch(`${baseUrl}/admin/events/${eventId}/decline`, {
      ...getFetchOptions(),
      method: "PUT",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Admin deleteEvent - admins can delete any event
export async function adminDeleteEvent(eventId) {
  try {
    const response = await fetch(`${baseUrl}/admin/events/${eventId}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Admin Users API functions
export async function getAllUsers() {
  try {
    const response = await fetch(`${baseUrl}/admin/users`, {
      ...getFetchOptions(),
      method: "GET",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function getUserDetails(userId) {
  try {
    const response = await fetch(`${baseUrl}/admin/users/${userId}`, {
      ...getFetchOptions(),
      method: "GET",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function deleteUser(userId) {
  try {
    const response = await fetch(`${baseUrl}/admin/users/${userId}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function unattendUserFromEvent(userId, eventId) {
  try {
    const response = await fetch(`${baseUrl}/admin/users/${userId}/unattend/${eventId}`, {
      ...getFetchOptions(),
      method: "DELETE",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function getAnalytics() {
  try {
    const response = await fetch(`${baseUrl}/admin/analytics`, {
      ...getFetchOptions(),
      method: "GET",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Hero Background Settings API functions
export async function getHeroSettings() {
  try {
    // Public endpoint - no auth required
    const response = await fetch(`${baseUrl}/admin/settings/hero`, {
      method: "GET",
      credentials: "include",
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function updateHeroSettings({ type, color, image }) {
  try {
    const response = await fetch(`${baseUrl}/admin/settings/hero`, {
      ...getFetchOptions(),
      method: "PUT",
      body: JSON.stringify({ type, color, image }),
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function uploadHeroImage(imageFile) {
  try {
    const formData = new FormData();
    formData.append("image", imageFile);

    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/upload/hero-image`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Profile API functions
export async function updateProfileSettings({ showContactInfo }) {
  try {
    const response = await fetch(`${baseUrl}/auth/profile`, {
      ...getFetchOptions(),
      method: "PUT",
      body: JSON.stringify({ showContactInfo }),
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function uploadProfilePicture(imageFile) {
  try {
    const formData = new FormData();
    formData.append("image", imageFile);

    const token = getAuthToken();
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/upload/profile-picture`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

// Export getFetchOptions for use in other API calls
export { getFetchOptions };
