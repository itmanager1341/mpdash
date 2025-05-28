
# API Management System

## Overview
The MP Editorial Dashboard integrates with several external APIs to enhance functionality. The API Management system allows administrators to securely store API keys and test connections.

## Supported Services

1. **Perplexity API**: Used for news discovery and semantic search
   - Key format: Starts with `pplx-`
   - Primary use: Fetching relevant mortgage industry news

2. **OpenAI API**: Used for content generation and enhancement
   - Primary use: Creating article drafts and summaries

3. **FRED API**: Used for economic data
   - Primary use: Incorporating economic indicators into articles

4. **Other Services**: Support for additional APIs (HubSpot, etc.)

## API Key Management

- **Storage**: API keys are stored securely in Supabase Edge Function secrets
- **Database**: Metadata about keys (masked version, service name) stored in `api_keys` table
- **Security**: Full key values are never exposed in the frontend or database

## Usage Flow

1. Admin adds API key through the Admin Settings interface
2. Key is stored as a Supabase secret and metadata in the database
3. Edge functions access the keys directly from environment variables
4. API interactions are performed exclusively through Edge Functions

## Testing Capabilities

Each service has testing functionality to verify:
- API key validity
- Connection status
- Basic functionality
