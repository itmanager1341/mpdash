
# AI Models & LLMs Reference

## Workflow Integration Table

| **Workflow Step**                         | **Purpose**                                                            | **LLM/Model Used**           | **Invocation Layer**              |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| **Trend Discovery**                       | Find 5–10 timely and relevant articles daily                           | Perplexity API               | Supabase Edge Function or n8n     |
| **Trend Scoring**                         | Assign `perplexity_score` based on urgency, originality, impact        | Claude or GPT-4o             | Supabase function or n8n          |
| **News Summary + CTA**                    | Summarize news item + generate one-sentence CTA                        | Claude or GPT-4o             | `compose_flash(news_id)`          |
| **MPDaily Article Brief Creation**        | Create short-form email-ready article brief                            | Claude or GPT-4o             | `create_article_brief()`          |
| **Magazine Feature Research Pack**        | Build long-form outlines with context + sources                        | Claude + Perplexity API      | `generate_deep_pack(issue_theme)` |
| **Similarity Search from Archive**        | Find related past MP articles via embedding vector search              | OpenAI Embedding v3-small    | Supabase Edge Function            |
| **AI Draft Enrichment (After Selection)** | Expand brief into full-length article, suggest references              | Claude                       | Claude MCP pipeline               |
| **Performance Analysis**                  | Evaluate articles post-publish: score, cluster health, engagement      | GPT-4o or Claude             | `score_article_performance()`     |
| **AI-Enhanced Formatting for Publishing** | Rephrase/structure content for MPDaily email or WordPress layout       | GPT-4o or GPT-3.5            | `format_for_mp_article()`         |
| **Competitor Awareness Detection**        | Tag trade-sourced articles as `is_competitor_covered`                  | Logic-based or GPT-3.5       | Within `news` ingestion process   |
| **System-wide Prompting in Lovable.dev**  | Trigger all of the above from UI modules (cards, queue, planner, etc.) | GPT-4o / Claude (contextual) | Lovable + Supabase Integration    |

## Integration Details

The MP Editorial Dashboard integrates multiple AI models and LLMs for various content workflow tasks. The table above shows which models are used at each stage of the editorial process.

### Key Points:

1. **Model Selection**: Models are chosen based on the specific requirements of each task:
   - Perplexity API for search and discovery
   - Claude or GPT-4o for quality content generation
   - Simpler models for routine formatting tasks

2. **Invocation Methods**: 
   - Supabase Edge Functions for real-time processing
   - Scheduled n8n workflows for batch operations
   - Direct API calls for interactive UI features

3. **Performance Considerations**:
   - More powerful models (Claude, GPT-4o) are used for high-value generation tasks
   - Lightweight models are preferred for routine operations
   - Embedding models optimize similarity search and clustering
