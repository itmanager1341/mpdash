
# Supabase Integration

## Database Schema

### Core Tables

1. **news**:
   - Contains trending news articles from external sources
   - Includes AI-generated metrics and matched clusters
   - Tracks approval status

2. **articles**:
   - Editorial content at various workflow stages
   - Includes content variants and related trends
   - Tracks publication status

3. **editor_briefs**:
   - Planning documents for upcoming articles
   - Contains outlines, summaries, and suggested sources
   - Links to related news items

4. **keyword_clusters**:
   - Categorization system for content topics
   - Organized by primary and secondary themes
   - Used for content matching and discovery

5. **sources**:
   - External content sources with priority tiers
   - Tracks source reliability and relevance
   - Links to keyword clusters for targeting

6. **api_keys**:
   - Stores metadata about external API integrations
   - Tracks active status and creation date
   - Masks actual key values for security

## Edge Functions

1. **News Processing**:
   - `fetch-perplexity-news`: Discovers new content from external sources
   - `generate-article`: Creates draft content from news items

2. **API Management**:
   - `test-perplexity-key`: Validates Perplexity API connectivity
   - `list-api-keys`: Retrieves API key metadata
   - `toggle-api-key-status`: Activates/deactivates API keys
   - `delete-api-key`: Removes API key entries

## Real-time Features

- Subscriptions for instant news updates
- Live updates to editorial queue
- Real-time collaboration indicators

## Security Model

- Row Level Security (RLS) policies for data access control
- Service role access for administrative functions
- Public access limited to published content only
