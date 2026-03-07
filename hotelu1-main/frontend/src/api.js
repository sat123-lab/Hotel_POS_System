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
    });
};

export default API_URL;
