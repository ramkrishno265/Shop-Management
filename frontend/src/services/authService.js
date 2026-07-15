import api from './api';

export const authService = {
  // লগইন API কল
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data; 
  },

  // সাইন-আপ API কল
  signUp: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  // কারেন্ট ইউজারের প্রোফাইল আনা (টেস্ট বা প্রোফাইল পেজের জন্য)
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  }
};