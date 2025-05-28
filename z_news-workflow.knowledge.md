
# News Workflow

## Overview
The editorial workflow begins with news discovery and continues through approval, drafting, and publication processes.

## News Discovery

1. **Automated Import**: System uses Perplexity API to discover relevant news based on:
   - Keyword clusters
   - Relevance scores
   - Publication recency

2. **Manual Addition**: Editors can manually add news items

## Editorial Processing

1. **News Approval**:
   - Editors review AI-suggested news items in Today's Briefing
   - Each item can be approved, routed to specific publication, or dismissed
   - Maximum of 5 approvals per day (quota system)

2. **Content Generation**:
   - Approved items can trigger AI-assisted draft generation
   - Generation can target MPDaily (concise format) or Magazine (expanded format)

3. **Editorial Review**:
   - Editors review and modify AI-generated content
   - Content can be enhanced with FRED economic data
   - Related trends and keyword clusters are attached automatically

## Publication Process

1. **MPDaily Workflow**:
   - Approved content enters the queue
   - Editors can prioritize and reorder items
   - Final email preview is generated before scheduling
   - Publication scheduled for AM or PM delivery

2. **Magazine Workflow**:
   - Content organized in kanban board by issue
   - Theme tagging and editor assignment
   - Print-specific preparation steps

## Status Tracking

Articles move through defined statuses:
- `suggested`: AI-recommended but not reviewed
- `queued_mpdaily`: Approved for MPDaily email
- `queued_magazine`: Routed to Magazine planning
- `drafted`: Content written but not reviewed
- `approved`: Ready for publishing
- `published`: Live on platform
- `archived`: No longer active
