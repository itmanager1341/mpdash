
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

### 2. Binary News Review
- **Simple Approve/Dismiss**: Editors review AI-suggested news items with only two options:
  - **Approve**: Add to news repository as source material
  - **Dismiss**: Permanently remove (deleted from system)
- **No routing decisions**: No need to choose between MPDaily, Magazine, or Website during review
- **No daily limits**: Editors can approve as many relevant items as needed
- **Focus on quality**: Decisions based on relevance, accuracy, and potential value as source material

### 3. News Repository Building
- **Source Corpus**: Approved news items stored in `news` table with complete metadata:
  - Original author and publication details
  - Source URL and publication date
  - Full article content and summary
  - Perplexity relevance scores
  - Matched keyword clusters
- **Research Foundation**: This corpus serves as the primary source for:
  - Article research and fact-checking
  - Citation and attribution
  - AI-assisted content generation
  - Trend analysis and topic development

## Article Creation Process

### 1. Editor Brief Creation
- **New Articles**: Editors create original articles in `editor_briefs` table
- **AI Assistance**: System helps generate article outlines using approved news sources
- **Source Integration**: Reference approved news items for research and citations

### 2. Content Development
- **Website Focus**: All articles target website publication as primary channel
- **Flexible Distribution**: Editors may later choose to include articles in:
  - MPDaily email (editor's discretion)
  - Magazine issues (editor's discretion)
- **AI Enhancement**: Content generation assisted by AI using news corpus

### 3. Publication Workflow
- **Single Channel**: Website as the primary and default publication target
- **Optional Distribution**: Secondary channels selected by editorial choice, not workflow requirement

## Status Tracking

News items move through simple statuses:
- `pending`: Awaiting editorial review
- `approved`: Added to source repository
- `dismissed`: Permanently removed (deleted)

Editor briefs follow separate article workflow:
- `draft`: Initial creation and development
- `review`: Editorial review process
- `approved`: Ready for publication
- `published`: Live on website
- `archived`: No longer active

## Key Benefits of Simplified Workflow

1. **Faster Decision Making**: Binary approve/dismiss reduces cognitive load
2. **Better Source Management**: Comprehensive news repository for research
3. **Flexible Publishing**: Website-first approach with optional distribution
4. **AI-Enhanced Creation**: Rich source corpus enables better AI assistance
5. **Reduced Complexity**: Eliminates multiple routing decisions during review
