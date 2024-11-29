from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from concurrent import futures
from typing import Optional, Dict, Union,Tuple
from pydantic import BaseModel, Field
import re
from concurrent.futures import ThreadPoolExecutor
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import time
import sys
import jwt
from bs4 import BeautifulSoup
import requests
import backoff
from vertexai.generative_models import GenerativeModel
import vertexai
from googlesearch import search
from app.config import settings
import os
import logging
import asyncio
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi_utils.tasks import repeat_every
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Request
from typing import Dict, List
import time
import asyncio
from threading import Lock
from functools import lru_cache
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks
from cachetools import TTLCache
from threading import Lock
from dotenv import load_dotenv
from fastapi.middleware.gzip import GZipMiddleware
from urllib.parse import quote_plus
from datetime import datetime, timedelta
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import concurrent.futures
import json
from fastapi.responses import JSONResponse
# Load environment variables
load_dotenv()


# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Search and Response API",
    description="API for searching and generating AI responses using Google Vertex AI",
    version="1.0.0"
)

# Define allowed origins
ALLOWED_ORIGINS = ["*",
    "https://huduku.asianetnews.com"
]

# Update the CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 30

if not GOOGLE_CLIENT_ID or not JWT_SECRET:
    raise ValueError("Missing required environment variables: GOOGLE_CLIENT_ID or JWT_SECRET")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 30
# Initialize Vertex AI
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
vertexai.init(
    project=settings.PROJECT_ID,
    location=settings.LOCATION
)

# Initialize the Gemini model
model = GenerativeModel(settings.GEMINI_MODEL)

TIME_SENSITIVE_KEYWORDS = [
    "latest", "recent", "current", "today", "now", "breaking",
    "update", "news", "development", "ongoing"
]

MAX_CONTENT_AGE_DAYS = 30
RECENT_CONTENT_BOOST = 2  # Boost factor for recent content

# Add time sensitivity to QueryParams
class QueryParams(BaseModel):
    query: str
    limit: Optional[int] = Field(default=10, gt=0, le=100)
    offset: Optional[int] = Field(default=0, ge=0)
    order_by: Optional[str] = Field(default="relevance")
    time_sensitive: Optional[bool] = Field(default=False)
    max_age_days: Optional[int] = Field(default=MAX_CONTENT_AGE_DAYS)


# Data model
class Todo(BaseModel):
    id: str
    item: str

class QueryParams(BaseModel):
    query: str
    limit: Optional[int] = Field(default=10, gt=0, le=100)
    offset: Optional[int] = Field(default=0, ge=0)
    order_by: Optional[str] = Field(default="relevance")

class SearchResult(BaseModel):
    url: str
    content: str
    index: int
    title: Optional[str]

class SearchResponse(BaseModel):
    sources: List[str]
    context: Dict[str, str]
    search_results: List[SearchResult]
    query_params: QueryParams

class Citation(BaseModel):
    number: int
    url: str  # Keep URL for internal reference
    text: str
    title: Optional[str]

class AIResponseWithCitations(BaseModel):
    answer: str
    conversation_id: str
    message_history: List[Dict[str, str]]
    citations: List[Citation]
    sources: List[str]
    query_params: QueryParams

# Add new models for conversation management
class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: float = Field(default_factory=time.time)

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    messages: List[Message] = []
    last_updated: float = Field(default_factory=time.time)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class GoogleToken(BaseModel):
    token: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None

# Add these to your existing models
class User(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CacheItem(BaseModel):
    search_results: Dict[str, str]
    generated_response: Optional[AIResponseWithCitations] = None  # Changed from str to AIResponseWithCitations
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Data models
class Query(BaseModel):
    query: str
    category: str
    icon: str
    color: str
    priority: int
    timestamp: str
    news_title: Optional[str] = None

class QueriesResponse(BaseModel):
    queries: List[Query]
    last_update: str
    next_update: str

# Add this to your in-memory storage
users: Dict[str, User] = {}
unified_cache = TTLCache(maxsize=200, ttl=300)  # 5 minutes cache

def create_jwt_token(data: dict) -> str:
    expiration = datetime.utcnow() + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode = data.copy()
    to_encode.update({"exp": expiration})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def parse_google_results(query: str) -> dict:
    """Asynchronous function to parse Google search results"""
    try:
        # Get search results using the default num_results from settings
        urls = list(search(query, num_results=settings.NUM_SEARCH))
        results = {}
        
        # Create a ThreadPoolExecutor for running synchronous requests
        with ThreadPoolExecutor() as executor:
            # Create a list of futures
            futures = [
                executor.submit(fetch_webpage_sync, url, settings.SEARCH_TIME_LIMIT)
                for url in urls
            ]
            
            # Wait for all futures to complete
            for future in futures:
                url, text = future.result()
                if text:
                    results[url] = text
        
        return results
    except Exception as e:
        logger.error(f"Error in parse_google_results: {e}")
        return {}

def fetch_webpage_sync(url: str, timeout: int) -> tuple:
    """Synchronous version of fetch_webpage"""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')
        paragraphs = soup.find_all('p')
        page_text = ' '.join([para.get_text() for para in paragraphs])
        return url, page_text
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
        return url, None

def format_conversation_history(messages: List[Message], max_messages: int = 5) -> str:
    """Format recent conversation history with proper context"""
    recent_messages = messages[-max_messages:] if len(messages) > max_messages else messages
    formatted_history = []
    
    for i, msg in enumerate(recent_messages):
        role = "User" if msg.role == "user" else "Assistant"
        # Add timestamp for context
        timestamp = datetime.fromtimestamp(msg.timestamp).strftime("%H:%M:%S")
        formatted_history.append(f"[{timestamp}] {role}: {msg.content}")
    
    return "\n".join(formatted_history)


# Add request locks and caches
generate_lock = Lock()
search_results_cache = TTLCache(maxsize=100, ttl=300)  # Cache for raw search results
generate_cache = TTLCache(maxsize=100, ttl=300)  # Cache for generated responses
search_cache = {}

CACHE_DURATION = timedelta(minutes=5)

async def cleanup_old_cache_entries():
    """Clean up expired cache entries"""
    try:
        # TTLCache handles expiration automatically
        search_results_cache.expire()
        generate_cache.expire()
    except Exception as e:
        logger.error(f"Error cleaning up cache: {e}")


# Add this function
def get_cached_search_results(query: str) -> Optional[dict]:
    """Get cached search results if they exist and are not expired"""
    if query in search_cache:
        timestamp, results = search_cache[query]
        if datetime.now() - timestamp < CACHE_DURATION:
            return results
        del search_cache[query]
    return None

async def perform_unified_search(query: str, time_sensitive: bool = False, max_age_days: int = MAX_CONTENT_AGE_DAYS) -> Dict[str, str]:
    """Enhanced unified search with better error handling and content validation"""
    cache_key = f"search_{quote_plus(query)}_{time_sensitive}_{max_age_days}"
    
    try:
        # Check cache first
        if cache_key in unified_cache:
            cached_item = unified_cache[cache_key]
            if isinstance(cached_item, CacheItem):
                return cached_item.search_results
        
        results = {}
        total_attempts = 0
        max_attempts = 15  # Maximum number of URLs to try
        

        site_specific_query = f"{query} site:*.asianetnews.com"
        site_specific_urls = list(search(site_specific_query, num_results=4))
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_to_url = {
                executor.submit(fetch_webpage_with_timestamp, url, settings.SEARCH_TIME_LIMIT): url
                for url in site_specific_urls
            }
            
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    content, timestamp = future.result()
                    if content and (not time_sensitive or is_content_fresh(timestamp, max_age_days)):
                        results[url] = content
                        total_attempts += 1
                except Exception as e:
                    logger.error(f"Error processing URL {url}: {e}")
        
        # If we need more results, try general search
        if len(results) < settings.NUM_SEARCH and total_attempts < max_attempts:
            remaining = settings.NUM_SEARCH - len(results)
            global_query = f"{query} -site:newsable.asianetnews.com"
            global_urls = list(search(global_query, num_results=remaining * 2))  # Get extra URLs in case some fail
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_url = {
                    executor.submit(fetch_webpage_with_timestamp, url, settings.SEARCH_TIME_LIMIT): url
                    for url in global_urls[:remaining * 2]
                }
                
                for future in concurrent.futures.as_completed(future_to_url):
                    if total_attempts >= max_attempts:
                        break
                        
                    url = future_to_url[future]
                    try:
                        content, timestamp = future.result()
                        if content and (not time_sensitive or is_content_fresh(timestamp, max_age_days)):
                            results[url] = content
                            total_attempts += 1
                    except Exception as e:
                        logger.error(f"Error processing URL {url}: {e}")
        
        if not results:
            logger.warning(f"No valid results found for query: {query}")
            # Return at least something if available
            return {url: "Content unavailable" for url in site_specific_urls[:1]}
        
        # Cache the results
        unified_cache[cache_key] = CacheItem(search_results=results)
        return results
        
    except Exception as e:
        logger.error(f"Error in perform_unified_search: {e}")
        return {}


def is_content_fresh(timestamp: Optional[datetime], max_age_days: int) -> bool:
    """Enhanced check if content is within the acceptable age range"""
    try:
        if not timestamp:
            return True  # If no timestamp, assume content is valid
            
        # Convert timestamp to UTC if it's not already
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
            
        current_time = datetime.now(datetime.timezone.utc)
        age = current_time - timestamp
        return age.days <= max_age_days
    except Exception as e:
        logger.warning(f"Error checking content freshness: {e}")
        return True  # If there's an error, don't filter out the content


def fetch_webpage_with_timestamp(url: str, timeout: int) -> Tuple[Optional[str], Optional[datetime]]:
    """Enhanced webpage fetcher with better timestamp extraction"""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Extract timestamp from multiple possible sources
        timestamp = None
        
        # Try multiple meta tag variations
        meta_dates = soup.find_all('meta', {
            'property': [
                'article:published_time',
                'og:published_time',
                'publication_date',
                'date',
                'datePublished'
            ]
        })
        
        for meta in meta_dates:
            try:
                date_str = meta.get('content')
                if date_str:
                    timestamp = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    break
            except (ValueError, AttributeError):
                continue
        
        # Extract content with better filtering
        content_elements = []
        
        # Get content from article tags
        article = soup.find('article')
        if article:
            paragraphs = article.find_all('p')
        else:
            paragraphs = soup.find_all('p')
        
        for p in paragraphs:
            text = p.get_text().strip()
            if len(text) > 50:  # Filter out short paragraphs
                content_elements.append(text)
        
        content = ' '.join(content_elements)
        
        if not content:
            logger.warning(f"No content found for URL: {url}")
            return None, None
            
        return content, timestamp
        
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
        return None, None



@app.post("/api/v1/search", response_model=SearchResponse)
async def search_query(query: QueryParams):
    """Optimized search endpoint"""
    try:
        # Get search results using unified function
        search_results = await perform_unified_search(query.query)
        
        # Format results with pagination
        all_results = [
            SearchResult(
                url=url,
                content=content[:settings.MAX_CONTENT],  # Limit content size
                index=idx,
                title=f"Source {idx + 1}"
            )
            for idx, (url, content) in enumerate(search_results.items())
        ]
        
        # Apply pagination
        start = query.offset
        end = start + query.limit
        paginated_results = all_results[start:end]
        
        return SearchResponse(
            sources=list(search_results.keys()),
            context=search_results,
            search_results=paginated_results,
            query_params=query
        )
        
    except Exception as e:
        logger.error(f"Error in search_query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_or_create_search_results(query: str) -> dict:
    """Get search results from cache or create new ones"""
    try:
        # Check cache first
        if query in search_results_cache:
            return search_results_cache[query]
        
        # If not in cache, perform search
        search_results = await parse_google_results(query)
        search_results_cache[query] = search_results
        return search_results
    except Exception as e:
        logger.error(f"Error in get_or_create_search_results: {e}")
        return {}

# Token settings
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# User management functions
def get_user(user_id: str) -> Optional[User]:
    """Get user from storage"""
    return users.get(user_id)

# Token functions
def create_access_token(data: dict) -> str:
    """Create access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Get current user from token"""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = get_user(user_id)
    if user is None:
        raise credentials_exception
    return user


# Add a simple in-memory store for conversations (replace with database in production)
conversations: Dict[str, Conversation] = {}

@app.post("/api/v1/generate", response_model=AIResponseWithCitations)
async def generate_response(
    query: QueryParams,
    background_tasks: BackgroundTasks,
    conversation_id: Optional[str] = None
):
    """Optimized generate endpoint with time context awareness"""
    cache_key = f"generate_{query.query}_{conversation_id}"
    
    try:
        # Check cache first
        if cache_key in unified_cache:
            cached_item = unified_cache[cache_key]
            if isinstance(cached_item, CacheItem) and cached_item.generated_response:
                return cached_item.generated_response
        
        # Get current time context
        time_context = get_current_time_context()
        
        # Parse time references from query
        time_ref = parse_time_reference(query.query)
        
        # Modify query if time reference found
        search_query = query.query
        if time_ref and time_ref["is_relative"]:
            search_query = f"{query.query} date:{time_ref['date']}"
        
        # Get search results using unified function with time sensitivity
        search_results = await perform_unified_search(
            search_query,
            time_sensitive="today" in query.query.lower() or "now" in query.query.lower()
        )
        
        if not search_results:
            logger.warning("No search results found")
            search_results = {}  # Ensure we have an empty dict rather than None
        
        # Get or create conversation
        conversation = conversations.get(conversation_id, Conversation())
        if not conversation_id:
            conversations[conversation.id] = conversation
        
        # Format conversation history
        conversation_history = format_conversation_history(conversation.messages)
        
        # Add user message
        conversation.messages.append(
            Message(role="user", content=query.query)
        )
        
        # Prepare citations and context
        citations = [
            Citation(
                number=i+1,
                url=url,
                text=content[:settings.MAX_CONTENT],
                title=f"Source {i+1}"
            )
            for i, (url, content) in enumerate(search_results.items())
        ]
        
        # Generate response with time context
        search_context = "\n".join([
            f"## Source {i+1}\n{text[:500]}"
            for i, text in enumerate(search_results.values())
        ]) if search_results else ""
        
        # Format prompt with time context
        prompt = cited_answer_prompt.format(
            current_time=time_context["current_time"],
            current_date=time_context["current_date"],
            day_of_week=time_context["day_of_week"],
            month=time_context["month"],
            year=time_context["year"],
            conversation_history=conversation_history,
            search_context=search_context,
            query=query.query
        )
        
        try:
            response = model.generate_content(
                prompt,
                generation_config={
                    "max_output_tokens": settings.MAX_TOKENS,
                    "temperature": 0.7,
                    "top_p": 0.95,
                }
            )
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            raise HTTPException(status_code=500, detail="Error generating response")
        
        # Add assistant response
        conversation.messages.append(
            Message(role="assistant", content=response.text)
        )
        
        result = AIResponseWithCitations(
            answer=response.text,
            conversation_id=conversation.id,
            message_history=[
                {"role": msg.role, "content": msg.content}
                for msg in conversation.messages
            ],
            citations=citations,
            sources=list(search_results.keys()),
            query_params=query
        )
        
        # Cache the result
        try:
            unified_cache[cache_key] = CacheItem(
                search_results=search_results,
                generated_response=result
            )
        except Exception as e:
            logger.error(f"Error caching result: {e}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error in generate_response: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.on_event("startup")
@repeat_every(seconds=3600)  # Run every hour
async def cleanup_old_conversations():
    """Cleanup old conversations periodically"""
    try:
        current_time = time.time()
        expired_conversations = [
            conv_id for conv_id, conv in conversations.items()
            if current_time - conv.last_updated > 3600  # Remove conversations older than 1 hour
        ]
        
        for conv_id in expired_conversations:
            logger.info(f"Removing expired conversation: {conv_id}")
            del conversations[conv_id]
            
        logger.info(f"Cleaned up {len(expired_conversations)} expired conversations")
    except Exception as e:
        logger.error(f"Error in cleanup_old_conversations: {e}")

@app.on_event("startup")
@repeat_every(seconds=300)  # Run every 5 minutes
async def cleanup_caches():
    """Cleanup expired cache entries"""
    try:
        unified_cache.expire()
    except Exception as e:
        logger.error(f"Error cleaning up caches: {e}")

# Add a new endpoint to get conversation history
@app.get("/api/v1/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get the history of a specific conversation"""
    try:
        if conversation_id not in conversations:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        conversation = conversations[conversation_id]
        return {
            "conversation_id": conversation_id,
            "messages": [
                {"role": msg.role, "content": msg.content}
                for msg in conversation.messages
            ],
            "last_updated": conversation.last_updated
        }
    except Exception as e:
        logger.error(f"Error in get_conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add a new endpoint to delete a conversation
@app.delete("/api/v1/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a specific conversation"""
    try:
        if conversation_id not in conversations:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        del conversations[conversation_id]
        return {"status": "success", "message": "Conversation deleted"}
    except Exception as e:
        logger.error(f"Error in delete_conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# In-memory storage
todos = []

# API endpoints
@app.get("/api/todos", response_model=List[Todo])
async def get_todos():
    return todos

@app.post("/api/todos", response_model=Todo)
async def create_todo(todo: Todo):
    todos.append(todo)
    return todo

@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: str, todo: Todo):
    for index, t in enumerate(todos):
        if t.id == todo_id:
            todos[index] = todo
            return {"message": "Todo updated successfully"}
    raise HTTPException(status_code=404, detail="Todo not found")

@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str):
    for index, todo in enumerate(todos):
        if todo.id == todo_id:
            todos.pop(index)
            return {"message": "Todo deleted successfully"}
    raise HTTPException(status_code=404, detail="Todo not found")

def extract_citations(text: str, citations: List[Citation]) -> List[Citation]:
    """Extract citations used in the response text"""
    used_citations = []
    citation_pattern = r'\[(\d+)\]'
    found_citations = set(re.findall(citation_pattern, text))
    
    for num_str in found_citations:
        num = int(num_str)
        for citation in citations:
            if citation.number == num:
                used_citations.append(citation)
                break
    
    return used_citations

@app.post("/api/v1/auth/google")
async def google_auth(google_token: GoogleToken):
    """Handle Google OAuth authentication"""
    try:
        logger.info("Received Google auth request")
        
        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            google_token.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )

        # Verify issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            return JSONResponse(
                status_code=400,
                content={"detail": "Invalid token issuer"},
                headers={
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                    "Access-Control-Allow-Credentials": "true"
                }
            )
        # Create user data
        user_data = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name", ""),
            "picture": idinfo.get("picture", "")
        }
        # Store user
        users[user_data["id"]] = User(**user_data)

        # Create access token
        access_token = create_access_token({"sub": user_data["id"]})

        return JSONResponse(
            content={
                "access_token": access_token,
                "token_type": "bearer",
                "user": user_data
            },
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    except ValueError as e:
        logger.error(f"Token verification failed: {e}")
        return JSONResponse(
            status_code=401,
            content={"detail": str(e)},
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return JSONResponse(
            status_code=400,
            content={"detail": str(e)},
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                "Access-Control-Allow-Credentials": "true"
            }
        )

# User endpoints
@app.get("/user/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        picture=current_user.picture
    )

@app.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Handle user logout"""
    return {"message": "Successfully logged out"}

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "type": "HTTPException",
            "status_code": exc.status_code
        }
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }

@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["Access-Control-Allow-Origin"] = "https://huduku.asianetnews.com"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept"
    
    return response

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "type": type(e).__name__
            }
        )

# Add these helper functions for time context
def get_current_time_context():
    """Get current time context information"""
    now = datetime.now()
    return {
        "current_time": now.strftime("%H:%M"),
        "current_date": now.strftime("%Y-%m-%d"),
        "day_of_week": now.strftime("%A"),
        "month": now.strftime("%B"),
        "year": now.strftime("%Y")
    }

def parse_time_reference(query: str) -> dict:
    """Parse time references from query"""
    time_refs = {
        "today": datetime.now(),
        "yesterday": datetime.now() - timedelta(days=1),
        "tomorrow": datetime.now() + timedelta(days=1),
        "this week": datetime.now() - timedelta(days=datetime.now().weekday()),
        "last week": datetime.now() - timedelta(days=datetime.now().weekday() + 7),
        "this month": datetime.now().replace(day=1),
        "last month": (datetime.now().replace(day=1) - timedelta(days=1)).replace(day=1)
    }
    
    query_lower = query.lower()
    for ref, date in time_refs.items():
        if ref in query_lower:
            return {
                "reference": ref,
                "date": date.strftime("%Y-%m-%d"),
                "is_relative": True
            }
    return None

# Add your prompts here (system_prompt_search, search_prompt, etc.)
system_prompt_search = """You are a helpful assistant whose primary goal is to decide if a user's query requires a Google search."""
search_prompt = """
Analyze the user's query and determine the most effective search strategy. Consider the current context:

Current Time: {current_time}
Current Date: {current_date}
Day: {day_of_week}
Month: {month}
Year: {year}

1. Time-Sensitive Queries:
   - For queries mentioning "today", "now", "current": Use current date {current_date}
   - For "yesterday": Use {yesterday_date}
   - For "this week": Consider dates from {week_start} to {current_date}
   - For "this month": Consider dates from {month_start} to {current_date}

2. Query Analysis Rules:
   - Identify temporal references (today, yesterday, this week, etc.)
   - Add appropriate date ranges to the search
   - Include location-specific context when relevant
   - Consider timezone differences for time-sensitive queries

3. Search Formatting:
   - Add date restrictions when time-sensitive
   - Include relevant temporal qualifiers
   - Specify date ranges when applicable

User Query: {query}

Output either:
1. A reformulated search query with appropriate time context
2. "ns" if no search is needed
"""

system_prompt_answer = """You are a helpful assistant who provides clear, concise, and well-structured answers."""

answer_prompt = """
You are an expert AI assistant. Provide comprehensive, accurate responses to queries using the following guidelines:

1. RESPONSE STRUCTURE:
   - Start immediately with a direct answer - no introductions or headings
   - Provide detailed information in a journalistic, unbiased tone
   - Include multiple relevant aspects of the topic
   - Keep total response under 200 words
   - Use clear paragraph breaks for readability


2. FORMATTING:
   - Use markdown for formatting
   - Use bullet points for lists
   - Include relevant statistics when available
   - Break information into digestible chunks
   - Use bold for important terms or dates

3. CONTENT GUIDELINES:
   - Be precise and factual
   - Include relevant dates, numbers, and statistics
   - Provide context when necessary
   - Address multiple aspects of the query
   - Avoid speculation or uncertain information

Previous Conversation:
{conversation_history}

Search Results:
{search_context}

Current Query: {query}

IMPORTANT:
- Never start with phrases like "According to..." or "Based on..."
- Never include references section
- Never explain or justify citations
- Never use hedging language
- Get straight to the point
- Write in the same language as the query
"""

system_prompt_cited_answer = """You are a helpful assistant who is expert at answering user's queries based on the cited context."""
cited_answer_prompt = """
Generate a clear and direct response based on the search context. Follow these strict guidelines:

1. RESPONSE STRUCTURE:
   - Start immediately with a direct answer - no introductions or headings
   - Provide detailed information in a journalistic, unbiased tone
   - Include multiple relevant aspects of the topic
   - Keep total response under 200 words
   - Use clear paragraph breaks for readability


2. FORMATTING:
   - Use markdown for formatting
   - Use bullet points for lists
   - Include relevant statistics when available
   - Break information into digestible chunks
   - Use bold for important terms or dates

3. CONTENT GUIDELINES:
   - Be precise and factual
   - Include relevant dates, numbers, and statistics
   - Provide context when necessary
   - Address multiple aspects of the query
   - Avoid speculation or uncertain information


Previous Conversation:
{conversation_history}

Search Results:
{search_context}

Current Query: {query}

Remember:
- DO NOT explain or reference the citations
- DO NOT add URLs or links
- Keep the response natural and conversational
"""


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "detail": "An internal server error occurred"
        }
    )

def read_queries():
    try:
        # Get the absolute path to the data directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        file_path = os.path.join(parent_dir, 'data', 'queries.json')
        
        logger.info(f"Attempting to read queries from: {file_path}")
        
        # Check if directory exists, if not create it
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.warning(f"Queries file not found at {file_path}")
            # Create default queries file
            default_queries = {
                "queries": [
                    {
                        "query": "Free Fire MAX: Free diamonds and skins via codes?",
                        "category": "TECHNOLOGY",
                        "icon": "trending-up",
                        "color": "blue",
                        "priority": 1,
                        "timestamp": datetime.now().isoformat(),
                       
                    },
                    {
                        "query": "Can *Bhool Bhulaiyaa 3* overtake *Singham Again*?",
                        "category": "ENTERTAINMENT",
                        "icon": "tv",
                        "color": "purple",
                        "priority": 2,
                        "timestamp": datetime.now().isoformat(),
                       
                    },
                    {
                        "query": "Will Swiggy or Nykaa lead Monday's market buzz?",
                        "category": "BUSINESS",
                        "icon": "trending-up",
                        "color": "green",
                        "priority": 3,
                        "timestamp": datetime.now().isoformat(),
                        
                    },
                    {
                        "query": "Can Modi's slogan sway India's Muslim vote globally?",
                        "category": "WORLD",
                        "icon": "globe",
                        "color": "yellow",
                        "priority": 4,
                        "timestamp": datetime.now().isoformat(),
                       
                    }
                ],
                "last_update": datetime.now().isoformat(),
                "next_update": (datetime.now() + timedelta(minutes=30)).isoformat()
            }
            with open(file_path, 'w') as f:
                json.dump(default_queries, f, indent=4)
            logger.info("Created default queries file")
            return default_queries
            
        with open(file_path, 'r') as file:
            data = json.load(file)
            logger.info("Successfully read queries from file")
            return data
    except Exception as e:
        logger.error(f"Error reading queries: {str(e)}")
        return None
# File path configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
QUERIES_FILE = os.path.join(DATA_DIR, 'queries.json')

# Default queries
DEFAULT_QUERIES = {
    "queries": [
        {
            "query": "Free Fire MAX: Free diamonds and skins via codes?",
            "category": "TECHNOLOGY",
            "icon": "trending-up",
            "color": "blue",
            "priority": 1,
            "timestamp": datetime.now().isoformat()
        },
        {
            "query": "Can *Bhool Bhulaiyaa 3* overtake *Singham Again*?",
            "category": "ENTERTAINMENT",
            "icon": "tv",
            "color": "purple",
            "priority": 2,
            "timestamp": datetime.now().isoformat()
        },
        {
            "query": "Will Swiggy or Nykaa lead Monday's market buzz?",
            "category": "BUSINESS",
            "icon": "trending-up",
            "color": "green",
            "priority": 3,
            "timestamp": datetime.now().isoformat()
        },
        {
            "query": "Can Modi's slogan sway India's Muslim vote globally?",
            "category": "WORLD",
            "icon": "globe",
            "color": "yellow",
            "priority": 4,
            "timestamp": datetime.now().isoformat()
        }
    ],
    "last_update": datetime.now().isoformat(),
    "next_update": (datetime.now() + timedelta(minutes=30)).isoformat()
}

def ensure_data_directory():
    """Ensure the data directory exists"""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        logger.info(f"Data directory ensured at: {DATA_DIR}")
    except Exception as e:
        logger.error(f"Error creating data directory: {e}")
        raise

def create_default_queries():
    """Create default queries file"""
    try:
        with open(QUERIES_FILE, 'w') as f:
            json.dump(DEFAULT_QUERIES, f, indent=4)
        logger.info("Created default queries file")
        return DEFAULT_QUERIES
    except Exception as e:
        logger.error(f"Error creating default queries: {e}")
        raise

def read_queries():
    """Read queries from file"""
    try:
        with open(QUERIES_FILE, 'r') as f:
            data = json.load(f)
        logger.info("Successfully read queries from file")
        return data
    except Exception as e:
        logger.error(f"Error reading queries: {e}")
        raise
@app.get("/api/v1/suggested-queries")
async def get_suggested_queries(request: Request):
    logger.info("=== Starting suggested queries request ===")
    logger.info(f"Request headers: {request.headers}")
    
    try:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(QUERIES_FILE), exist_ok=True)
        
        # Get or create queries data
        if not os.path.exists(QUERIES_FILE):
            queries_data = {
                "queries": [
                    {
                        "query": "Free Fire MAX: Free diamonds and skins via codes?",
                        "category": "TECHNOLOGY",
                        "icon": "trending-up",
                        "color": "blue",
                        "priority": 1,
                        "timestamp": datetime.now().isoformat()
                    },
                    {
                        "query": "Can *Bhool Bhulaiyaa 3* overtake *Singham Again*?",
                        "category": "ENTERTAINMENT",
                        "icon": "tv",
                        "color": "purple",
                        "priority": 2,
                        "timestamp": datetime.now().isoformat()
                    },
                    {
                        "query": "Will Swiggy or Nykaa lead Monday's market buzz?",
                        "category": "BUSINESS",
                        "icon": "trending-up",
                        "color": "green",
                        "priority": 3,
                        "timestamp": datetime.now().isoformat()
                    },
                    {
                        "query": "Can Modi's slogan sway India's Muslim vote globally?",
                        "category": "WORLD",
                        "icon": "globe",
                        "color": "yellow",
                        "priority": 4,
                        "timestamp": datetime.now().isoformat()
                    }
                ],
                "last_update": datetime.now().isoformat(),
                "next_update": (datetime.now() + timedelta(minutes=30)).isoformat()
            }
            
            with open(QUERIES_FILE, 'w') as f:
                json.dump(queries_data, f, indent=4)
        else:
            with open(QUERIES_FILE, 'r') as f:
                queries_data = json.load(f)
        
        return JSONResponse(
            content=queries_data,
            headers={
                "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_suggested_queries: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
            headers={
                "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    
@app.options("/api/v1/suggested-queries")
async def suggested_queries_options():
    """Handle OPTIONS request for suggested queries"""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "detail": "An internal server error occurred"
        },
        headers={
            "Access-Control-Allow-Origin": "https://huduku.asianetnews.com",
            "Access-Control-Allow-Credentials": "true"
        }
    )

# Startup event to ensure data directory exists
@app.on_event("startup")
async def startup_event():
    """Run startup tasks"""
    try:
        ensure_data_directory()
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
