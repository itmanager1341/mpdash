
# Administrator Guide

## System Setup

### API Configuration
1. Access the Admin Settings panel
2. Navigate to the API Keys Manager
3. Add required API keys:
   - Perplexity API (required for news discovery)
   - OpenAI API (required for content generation)
   - FRED API (optional for economic data)
   - HubSpot API (optional for email integration)

### Content Categories
1. Define keyword clusters in the database
2. Set up primary and secondary themes
3. Associate keywords with professional audiences

### Source Management
1. Configure trusted news sources
2. Assign priority tiers to sources
3. Link sources to relevant keyword clusters

## Scheduled Operations

### News Import
1. Configure import frequency (recommended: daily)
2. Set minimum relevance score threshold
3. Enable/disable duplicate checking

### Data Refresh
1. Set FRED data update frequency
2. Configure data series to track
3. Set up anomaly detection thresholds

## User Management

### Editor Accounts
1. Create accounts for editorial team members
2. Assign appropriate permissions
3. Configure notification preferences

### Access Controls
1. Review database access policies
2. Manage API key visibility
3. Set up audit logging

## System Maintenance

### Performance Monitoring
1. Review database query performance
2. Monitor edge function execution times
3. Check API quota usage

### Database Management
1. Implement regular backup schedule
2. Monitor table sizes
3. Archive old content according to policy
