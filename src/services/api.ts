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

interface ApiError {
  name: string;
  message: string;
  stack?: string;
}


// Error handler utility
const handleApiError = async (response: Response, defaultMessage: string): Promise<never> => {
  try {
    const errorData = await response.json();
    throw new Error(errorData.detail || defaultMessage);
  } catch (error) {
    throw new Error(defaultMessage);
  }
};


// Helper function to handle errors
const handleError = (error: unknown, context: string): never => {
  const apiError: ApiError = {
    name: error instanceof Error ? error.name : 'Unknown Error',
    message: error instanceof Error ? error.message : 'An unknown error occurred',
    stack: error instanceof Error ? error.stack : undefined
  };
  
  console.error(`${context}:`, apiError);
  throw error;
};


export const api = {
  async search(params: QueryParams) {
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Search failed');
    }
    return response.json();
  },

  async generate(params: QueryParams, conversationId?: string): Promise<GenerateResponse> {
    const url = `${API_BASE_URL}/generate${conversationId ? `?conversation_id=${conversationId}` : ''}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Generation failed');
    }
    return response.json();
  },

  async getConversation(conversationId: string) {
    const response = await fetch(`${API_BASE_URL}/conversation/${conversationId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to fetch conversation');
    }
    return response.json();
  },

  async getSuggestedQueries(): Promise<SuggestedQueriesResponse> {
    console.log('=== Starting getSuggestedQueries API call ===');
    try {
        const url = `${API_BASE_URL}/suggested-queries`;
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://huduku.asianetnews.com'
            },
            credentials: 'include',
            mode: 'cors',
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch suggested queries: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        return data;
    } catch (error) {
        console.error('API Error details:', error);
        throw error;
    }
},

  async deleteConversation(conversationId: string) {
    const response = await fetch(`${API_BASE_URL}/conversation/${conversationId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete conversation');
    }
    return response.json();
  },
};
