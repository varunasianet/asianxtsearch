import sys
import os
from datetime import datetime, timedelta
from gnews import GNews
import vertexai
from vertexai.generative_models import GenerativeModel
import asyncio
import json
from typing import Dict, List
from tqdm import tqdm
import logging
import coloredlogs
from dotenv import load_dotenv
from google.oauth2 import service_account

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('news_service.log')
    ]
)
logger = logging.getLogger(__name__)
coloredlogs.install(level='INFO', logger=logger)

# Settings as direct variables
class Settings:
    def __init__(self):
        self.PROJECT_ID = os.getenv('PROJECT_ID')
        self.GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        self.LOCATION = os.getenv('LOCATION', 'us-central1')
        self.GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash-002')
        self.UPDATE_INTERVAL_MINUTES = int(os.getenv('UPDATE_INTERVAL_MINUTES', '30'))
        self.UPDATE_INTERVAL_SECONDS = self.UPDATE_INTERVAL_MINUTES * 60
        self.DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        self.QUERIES_FILE = os.path.join(self.DATA_DIR, 'queries.json')

        # Validate required settings
        if not self.PROJECT_ID or not self.GOOGLE_APPLICATION_CREDENTIALS:
            raise ValueError("Missing required environment variables: PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS")

# Create settings instance
settings = Settings()

class NewsQueryGenerator:
    def __init__(self):
        logger.info("Initializing NewsQueryGenerator...")
        self.settings = settings
        self.last_news_cache = {}
        
        # Initialize GNews
        logger.info("Setting up GNews client...")
        self.gnews = GNews(
            language='en',
            country='IN',
            period='1h',
            max_results=5
        )
        
        # Initialize Gemini
        logger.info("Initializing Gemini AI...")
        try:
            # Load credentials properly
            credentials = service_account.Credentials.from_service_account_file(
                self.settings.GOOGLE_APPLICATION_CREDENTIALS,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            
            # Initialize vertexai with proper credentials
            vertexai.init(
                project=self.settings.PROJECT_ID,
                location=self.settings.LOCATION,
                credentials=credentials
            )
            
            self.model = GenerativeModel(self.settings.GEMINI_MODEL)
            logger.info("Gemini AI initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini AI: {str(e)}")
            raise


        self.categories = [
            {"name": "TECHNOLOGY", "icon": "trending-up", "color": "blue", "priority": 1},
            {"name": "ENTERTAINMENT", "icon": "tv", "color": "purple", "priority": 2},
            {"name": "BUSINESS", "icon": "trending-up", "color": "green", "priority": 3},
            {"name": "WORLD", "icon": "globe", "color": "yellow", "priority": 4}
        ]
        
        self.current_queries = {
            "queries": [],
            "last_update": None,
            "next_update": None
        }
        
        # Ensure data directory exists
        os.makedirs(self.settings.DATA_DIR, exist_ok=True)
        logger.info("NewsQueryGenerator initialization complete")

    def _is_news_duplicate(self, category: str, news_title: str) -> bool:
        """Check if news is duplicate from last update"""
        if category in self.last_news_cache:
            return news_title in self.last_news_cache[category]
        return False

    def _update_news_cache(self, category: str, news_title: str):
        """Update the news cache"""
        if category not in self.last_news_cache:
            self.last_news_cache[category] = set()
        self.last_news_cache[category].add(news_title)

    async def get_fresh_news(self, category: str) -> List[Dict]:
        """Get fresh news that hasn't been used before"""
        try:
            if category == "WORLD":
                all_news = self.gnews.get_top_news()
            else:
                all_news = self.gnews.get_news_by_topic(category)

            fresh_news = []
            for news in all_news:
                if not self._is_news_duplicate(category, news['title']):
                    fresh_news.append(news)
                    self._update_news_cache(category, news['title'])
                    break  # Found a fresh news item

            if not fresh_news:
                # Clear cache and try again if no fresh news
                self.last_news_cache[category] = set()
                return [all_news[0]] if all_news else []

            return fresh_news

        except Exception as e:
            logger.error(f"Error fetching news for {category}: {str(e)}")
            return []

    async def generate_query_for_category(self, category: Dict) -> Dict:
        logger.info(f"Generating query for category: {category['name']}")
        try:
            # Get fresh news for the category
            news = await self.get_fresh_news(category['name'])
            
            if not news:
                logger.warning(f"No news found for category {category['name']}")
                return None
                
            logger.info(f"Found fresh news for {category['name']}")
            
            # Create dynamic prompt for Gemini
            news_text = f"{news[0]['title']}: {news[0].get('description', '')}"
            prompt = f"""Create a compelling, engaging question (under 10 words) about this recent news:
            {news_text}

            Make it relevant to {category['name']} category and interesting for readers.
            The question should:
            1. Be specific to the news content
            2. Not use any special characters like asterisks (*)
            3. Use plain text formatting
            4. Be direct and clear
            5. Maintain proper spacing between words

            Example good format: "Will Bhool Bhulaiyaa 3 overtake Singham Again?"
            Example bad format: "Can *Bhool Bhulaiyaa 3* catch *Singham Again*?"

            Generate a question following these guidelines."""
            
            # Get response from Gemini
            logger.info(f"Generating query using Gemini AI for {category['name']}...")
            response = await self.model.generate_content_async(prompt)
            query = response.text.strip().rstrip('?') + '?'
            
            logger.info(f"Generated query for {category['name']}: {query}")
            return {
                "query": query,
                "category": category["name"],
                "icon": category["icon"],
                "color": category["color"],
                "priority": category["priority"],
                "timestamp": datetime.now().isoformat(),
                "news_title": news[0]['title']
            }
        except Exception as e:
            logger.error(f"Error generating query for {category['name']}: {str(e)}")
            return None

    async def update_queries(self):
        logger.info("Starting query update process...")
        new_queries = []
        
        for category in tqdm(self.categories, desc="Processing categories"):
            query = await self.generate_query_for_category(category)
            if query:
                new_queries.append(query)
                logger.info(f"Added new query for {category['name']}")
            else:
                logger.warning(f"Failed to generate query for {category['name']}")
        
        if new_queries:
            current_time = datetime.now()
            self.current_queries = {
                "queries": new_queries,
                "last_update": current_time.isoformat(),
                "next_update": (current_time + timedelta(minutes=30)).isoformat()
            }
            self.save_queries()
            logger.info("Query update process completed with new queries")
        else:
            logger.warning("No new queries generated in this update")

    def save_queries(self):
        try:
            # Update the save path to match your structure
            save_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'queries.json')
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            logger.info(f"Saving queries to: {save_path}")
            with open(save_path, 'w') as f:
                json.dump(self.current_queries, f, indent=4)
            logger.info("Queries saved successfully")
        except Exception as e:
            logger.error(f"Error saving queries: {str(e)}")
            raise

    # Update the run_periodic_updates method in NewsQueryGenerator class
    async def run_periodic_updates(self):
        """Run periodic updates using asyncio"""
        while True:
            try:
                start_time = datetime.now()
                logger.info(f"Starting update at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                
                await self.update_queries()
                
                # Calculate next update time
                next_update = start_time + timedelta(minutes=self.settings.UPDATE_INTERVAL_MINUTES)
                logger.info(f"Next update scheduled for: {next_update.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # Calculate sleep duration
                sleep_seconds = self.settings.UPDATE_INTERVAL_SECONDS
                logger.info(f"Waiting {self.settings.UPDATE_INTERVAL_MINUTES} minutes until next update...")
                
                await asyncio.sleep(sleep_seconds)
                
            except Exception as e:
                logger.error(f"Error in periodic update: {str(e)}")
                # On error, wait for 1 minute before retrying
                logger.info("Waiting 1 minute before retry due to error...")
                await asyncio.sleep(60)

async def main():
    try:
        logger.info("Starting News Query Generator Service...")
        query_generator = NewsQueryGenerator()
        
        # Initial update
        logger.info("Performing initial query update...")
        await query_generator.update_queries()
        
        # Start periodic updates
        logger.info("Starting periodic updates...")
        await query_generator.run_periodic_updates()
    except Exception as e:
        logger.error(f"Main process error: {str(e)}")
        sys.exit(1)

# Usage
if __name__ == "__main__":
    logger.info("=== News Query Generator Service Starting ===")
    try:
        # Ensure data directory exists
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Service error: {str(e)}")
    finally:
        logger.info("=== News Query Generator Service Stopped ===")
