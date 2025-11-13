const API_BASE_URL = "http://localhost:3001/api";

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include", // Include cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API call failed");
  }

  return data;
};

// Auth API
export const auth = {
  register: async (username, email, password) => {
    return apiCall("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  },

  login: async (username, password) => {
    return apiCall("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  logout: async () => {
    return apiCall("/auth/logout", {
      method: "POST",
    });
  },

  getCurrentUser: async () => {
    return apiCall("/auth/me");
  },
};

// Files API
export const files = {
  upload: async (fileList) => {
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }

    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: "POST",
      credentials: "include",
      body: formData, // Don't set Content-Type, browser will set it with boundary
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Upload failed");
    }
    return data;
  },

  list: async () => {
    return apiCall("/files");
  },

  download: async (fileId) => {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Download failed");
    }

    return response.blob();
  },

  delete: async (fileId) => {
    return apiCall(`/files/${fileId}`, {
      method: "DELETE",
    });
  },

  deleteAll: async () => {
    return apiCall("/files", {
      method: "DELETE",
    });
  },
};
