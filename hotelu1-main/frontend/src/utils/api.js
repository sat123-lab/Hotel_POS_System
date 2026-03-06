export const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      error.status = response.status;
      throw error;
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
