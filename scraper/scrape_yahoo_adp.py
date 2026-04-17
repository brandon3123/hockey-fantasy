"""
Yahoo Fantasy Sports ADP scraper using OAuth 2.0.
Yahoo modern APIs use OAuth 2.0 instead of OAuth 1.0.
"""

import os
import json
import webbrowser
from typing import Dict, Optional
from dotenv import load_dotenv
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import requests

load_dotenv()

YAHOO_CLIENT_ID = os.getenv("YAHOO_CLIENT_ID")
YAHOO_CLIENT_SECRET = os.getenv("YAHOO_CLIENT_SECRET")

# Yahoo OAuth 2.0 endpoints
YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth"
YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token"

YAHOO_FANTASY_API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2"

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Local server to catch OAuth callback."""

    def do_GET(self):
        if self.path.startswith('/?code='):
            # Extract authorization code
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)

            if 'code' in params:
                self.server.auth_code = params['code'][0]

                # Send success response
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"<html><body><h1>Authorization successful!</h1><p>You can close this window.</p></body></html>")
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress server logs

def get_auth_code() -> str:
    """
    Step 1: Open browser for Yahoo authorization.
    Returns authorization code.
    """
    if not YAHOO_CLIENT_ID:
        raise ValueError("Yahoo client ID not found in .env file")

    # Build authorization URL
    auth_params = {
        'client_id': YAHOO_CLIENT_ID,
        'redirect_uri': 'http://localhost:8080',
        'response_type': 'code',
        'scope': 'fspt-r'  # Fantasy Sports read permission
    }

    auth_url = f"{YAHOO_AUTH_URL}?{urllib.parse.urlencode(auth_params)}"

    print(f"Opening browser for Yahoo authorization...")
    print(f"If browser doesn't open, visit: {auth_url}")

    # Start local server to catch callback
    server = HTTPServer(('localhost', 8080), OAuthCallbackHandler)
    server.auth_code = None
    server.timeout = 120  # 2 minute timeout

    # Open browser
    webbrowser.open(auth_url)

    # Wait for callback
    print("Waiting for authorization...")

    # Handle one request (the callback)
    server.handle_request()

    if hasattr(server, 'auth_code') and server.auth_code:
        print("✅ Authorization code received")
        server.server_close()
        return server.auth_code
    else:
        server.server_close()
        raise TimeoutError("Authorization timed out. Please try again.")

def get_access_token(auth_code: str) -> tuple[str, str]:
    """
    Step 2: Exchange authorization code for access token.

    Args:
        auth_code: From OAuth callback

    Returns:
        (access_token, refresh_token)
    """
    token_data = {
        'client_id': YAHOO_CLIENT_ID,
        'client_secret': YAHOO_CLIENT_SECRET,
        'code': auth_code,
        'grant_type': 'authorization_code',
        'redirect_uri': 'http://localhost:8080'
    }

    response = requests.post(YAHOO_TOKEN_URL, data=token_data)
    response.raise_for_status()

    token_response = response.json()

    access_token = token_response.get('access_token')
    refresh_token = token_response.get('refresh_token')

    if not access_token:
        raise ValueError("No access token in response")

    print(f"✅ Got access token!")

    return access_token, refresh_token

def make_yahoo_request(access_token: str, endpoint: str) -> Dict:
    """
    Make authenticated request to Yahoo Fantasy API.

    Args:
        access_token: OAuth 2.0 access token
        endpoint: API endpoint

    Returns:
        Parsed JSON response
    """
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    url = f"{YAHOO_FANTASY_API_BASE}{endpoint}"
    response = requests.get(url, headers=headers)

    if response.status_code == 401:
        raise ValueError("Access token expired. Please re-authorize.")

    response.raise_for_status()
    return response.json()

def scrape_yahoo_adp(access_token: str) -> Dict[str, float]:
    """
    Scrape ADP data from Yahoo Fantasy Sports.

    Args:
        access_token: OAuth 2.0 access token

    Returns:
        Dict mapping player name -> ADP value
    """
    print(f"Fetching ADP from Yahoo Fantasy Sports...")

    try:
        # Try to get user's fantasy games
        data = make_yahoo_request(access_token, "/users;use_login=1/games;game_codes=nhl")

        print(f"API Response structure: {list(data.keys())}")

        if 'fantasy_content' in data:
            games = data['fantasy_content'].get('users', {}).get('user', {}).get('games', {})

            print(f"Found games data: {games}")

            # Look for leagues within games
            if 'game' in games:
                game = games['game']
                if not isinstance(game, list):
                    game = [game]

                for g in game:
                    leagues = g.get('leagues', {})
                    print(f"Found leagues: {leagues}")

        # If no ADP found, return empty
        print("  No ADP data found - Yahoo Fantasy may not expose ADP via API")
        return {}

    except Exception as e:
        print(f"  Error scraping Yahoo ADP: {e}")
        return {}

def save_credentials(access_token: str, refresh_token: str):
    """Save OAuth credentials for reuse."""
    creds = {
        'access_token': access_token,
        'refresh_token': refresh_token
    }

    with open('.yahoo_credentials.json', 'w') as f:
        json.dump(creds, f)

    print(f"  Credentials saved to .yahoo_credentials.json")

def load_credentials() -> Optional[tuple[str, str]]:
    """Load saved OAuth credentials."""
    try:
        with open('.yahoo_credentials.json', 'r') as f:
            creds = json.load(f)
        return creds['access_token'], creds['refresh_token']
    except FileNotFoundError:
        return None

if __name__ == "__main__":
    # Check for existing credentials
    creds = load_credentials()

    if creds:
        access_token, refresh_token = creds
        print("Using saved OAuth credentials")
    else:
        # Step 1: Get authorization code via browser
        auth_code = get_auth_code()

        # Step 2: Get access token
        access_token, refresh_token = get_access_token(auth_code)

        # Save credentials for future use
        save_credentials(access_token, refresh_token)

    # Step 3: Fetch ADP data
    adp_data = scrape_yahoo_adp(access_token)

    if adp_data:
        print(f"\n✅ Successfully retrieved {len(adp_data)} ADP values")
    else:
        print("\n❌ Yahoo Fantasy API doesn't provide ADP data")
        print("Recommendation: Use existing player rankings as ADP proxy")
