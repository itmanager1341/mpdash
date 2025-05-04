
# MP Editorial Dashboard

## Setup

### Required API Keys

To use all features of the MP Editorial Dashboard, you need to configure the following API keys in your Supabase project:

1. **OpenAI API Key**: Used for generating article content and summaries.
   - Get your key from: https://platform.openai.com/api-keys

2. **Perplexity API Key**: Used for fetching trending news articles.
   - Get your key from: https://www.perplexity.ai/settings/api

3. **FRED API Key**: Used for fetching economic data.
   - Get your key from: https://fred.stlouisfed.org/docs/api/api_key.html

### Setting Up API Keys in Supabase

1. Go to your Supabase project dashboard
2. Navigate to Settings > API > Edge Functions
3. Add the following secrets:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `PERPLEXITY_API_KEY`: Your Perplexity API key
   - `FRED_API_KEY`: Your FRED API key

## Features

- **Today's Briefing**: AI-curated news articles based on relevance and priority
- **MPDaily Planner**: Email newsletter planning and scheduling
- **Magazine Planner**: Content planning for magazine issues
- **Content Calendar**: Visual planning for all content types
- **Performance Dashboard**: Analytics and metrics for published content
- **Admin Settings**: Configure API keys, AI settings, and automation

## Development

### Running Locally

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm run dev`

### Adding News Items

1. Use the News Importer in Admin Settings to manually add news items
2. Enable scheduled imports to automatically fetch news from Perplexity API
3. Set minimum relevance score to filter out less important news

## Troubleshooting

If you encounter issues with the API connections, check the following:

1. Verify that your API keys are correctly configured in Supabase
2. Check the Supabase Edge Function logs for any errors
3. Ensure you have sufficient API quota remaining
