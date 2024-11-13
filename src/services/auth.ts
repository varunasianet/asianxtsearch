interface User {
    id: string;
    email: string;
    name: string;
    picture?: string;
  }
  
  interface AuthResponse {
    user: User;
    status: string;
  }
  
  const API_BASE_URL = 'https://huduku.asianetnews.com/api/v1';
  
  export async function validateAuthToken(token: string): Promise<User> {
    try {
      if (!token) {
        throw new Error('No token provided');
      }
  
      const response = await fetch(`${API_BASE_URL}/auth/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || 'Invalid or expired token');
      }
  
      const data: AuthResponse = await response.json();
      
      if (!data.user || !data.user.id || !data.user.email || !data.user.name) {
        throw new Error('Invalid user data received');
      }
  
      return data.user;
    } catch (error) {
      console.error('Auth validation failed:', error);
      throw error;
    }
  }