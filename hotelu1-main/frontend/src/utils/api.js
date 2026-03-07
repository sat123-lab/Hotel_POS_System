const API_URL = "https://hotel-pos-system.onrender.com";

export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem("token");

  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers
    }
  }).then(response => {
    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }
    return response;
  });
};

export const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`API Request: ${API_URL}${url}`, { method: options.method || 'GET', headers: { ...headers, Authorization: headers.Authorization ? '***' : undefined } });

    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
    });

    console.log(`API Response: ${response.status} ${response.statusText}`, response.url);

    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Expected JSON but got:", text.substring(0, 200));
      throw new Error("Invalid response format: Expected JSON but received HTML or text");
    }

    const data = await response.json();
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error("Invalid response format");
    }
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export { API_URL };
export default API_URL;
