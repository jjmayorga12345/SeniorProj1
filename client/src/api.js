const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const baseUrl = `${API_URL}/api`;

const fetchOptions = {
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
};

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
    const response = await fetch(`${baseUrl}/auth/login`, {
      ...fetchOptions,
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    return await handleResponse(response);
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("Unable to connect to server. Please check if the server is running.");
    }
    throw error;
  }
}

export async function register({ email, password, firstName, lastName }) {
  try {
    const response = await fetch(`${baseUrl}/auth/register`, {
      ...fetchOptions,
      method: "POST",
      body: JSON.stringify({ email, password, firstName, lastName }),
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
      ...fetchOptions,
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
