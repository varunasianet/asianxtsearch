const API_BASE_URL = 'https://huduku.asianetnews.com/api/v1';

interface QueryParams {
  query: string;
  limit?: number;
  offset?: number;
  order_by?: string;
}

interface Citation {
  number: number;
  url: string;
  text: string;
  title: string;
}

interface GenerateResponse {
  answer: string;
  conversation_id: string;
  message_history: Array<{ role: string; content: string }>;
  citations: Citation[];
  sources: string[];
  query_params: QueryParams;
}

interface SuggestedQuery {
  query: string;
  category: string;
  icon: string;
  color: string;
  priority: number;
  timestamp?: string;
  news_title?: string;
}

interface SuggestedQueriesResponse {
  queries: SuggestedQuery[];
  last_update: string;
  next_update: string;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const api = {
  async search(params: QueryParams) {
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  },

  async generate(params: QueryParams, conversationId?: string): Promise<GenerateResponse> {
    try {
      const url = `${API_BASE_URL}/generate${conversationId ? `?conversation_id=${conversationId}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Generation failed:', error);
      throw error;
    }
  },

  async getConversation(conversationId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation/${conversationId}`, {
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      throw error;
    }
  },

  async getSuggestedQueries(): Promise<SuggestedQueriesResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/suggested-queries`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      return handleResponse<SuggestedQueriesResponse>(response);
    } catch (error) {
      console.error('Failed to fetch suggested queries:', error);
      throw error;
    }
  },

  async deleteConversation(conversationId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  },
};