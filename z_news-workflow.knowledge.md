
# News Workflow

## Overview
The editorial workflow centers on news discovery, binary review, and building a comprehensive source repository for article creation.

## Simplified News Process

### 1. News Discovery
- **Automated Import**: System uses Perplexity API to discover relevant news based on:
  - Keyword clusters and search prompts
  - Relevance scores
  - Publication recency
  - Safety limit of 20 items per search to prevent overload

- **Manual Addition**: Editors can manually add news items when needed

### 2. Binary News Review (Today's Briefing)
- **Simple Review Process**: Editors review AI-suggested news items with two options:
  - **Dismiss**: Permanently delete from system (not relevant/redundant)
  - **Enhance Content**: Move to source field enhancement for completion
- **No routing decisions**: No need to choose between MPDaily, Magazine, or Website during review
- **Focus on completeness**: Decisions based on relevance, accuracy, and potential value as source material

### 3. Source Field Enhancement
- **Human verification**: Ensure article source information is complete before passing to Editorial Hub
- **Source field fixes only**:
  - Original author field population
  - Content scraping retry if needed
  - Source attribution verification
  - Publication date correction
- **Article remains in news table**: Enhanced articles stay in news table as sources for Editorial Hub

### 4. Editorial Hub Integration
- **Source Repository**: Enhanced news items in news table serve as source material for:
  - Article research and fact-checking
  - Citation and attribution
  - AI-assisted content generation
  - Trend analysis and topic development
- **Article Creation**: New articles created in `editor_briefs` table using news sources as reference

## Status Tracking

News items move through simple statuses:
- `pending`: Awaiting editorial review
- `approved_for_editing`: Ready for source field enhancement
- `enhanced`: Complete source information, ready for Editorial Hub use
- Dismissed items are permanently deleted from system

## Key Benefits of Simplified Workflow

1. **Faster Decision Making**: Binary review reduces cognitive load
2. **Complete Source Management**: Human verification ensures quality source data
3. **Seamless Editorial Integration**: Enhanced news items ready for article creation
4. **Reduced Complexity**: Eliminates multiple routing decisions during review
5. **Quality Assurance**: Human-in-the-loop ensures completeness before Editorial Hub
