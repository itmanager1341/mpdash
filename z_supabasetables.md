| table_name             | column_name              | data_type                |
| ---------------------- | ------------------------ | ------------------------ |
| api_keys               | id                       | uuid                     |
| api_keys               | name                     | text                     |
| api_keys               | service                  | text                     |
| api_keys               | key_masked               | text                     |
| api_keys               | is_active                | boolean                  |
| api_keys               | created_at               | timestamp with time zone |
| api_keys               | secret_stored            | boolean                  |
| articles               | id                       | uuid                     |
| articles               | title                    | text                     |
| articles               | content_variants         | jsonb                    |
| articles               | status                   | text                     |
| articles               | related_trends           | ARRAY                    |
| articles               | fred_data                | jsonb                    |
| articles               | linked_prior_articles    | ARRAY                    |
| articles               | created_at               | timestamp with time zone |
| articles               | updated_at               | timestamp with time zone |
| articles               | published_at             | date                     |
| articles               | embedding                | USER-DEFINED             |
| articles               | source_news_id           | uuid                     |
| articles               | destinations             | ARRAY                    |
| articles               | publication_targets      | ARRAY                    |
| articles               | source_system            | text                     |
| articles               | editor_brief_id          | uuid                     |
| editor_briefs          | id                       | uuid                     |
| editor_briefs          | theme                    | text                     |
| editor_briefs          | summary                  | text                     |
| editor_briefs          | outline                  | text                     |
| editor_briefs          | sources                  | ARRAY                    |
| editor_briefs          | suggested_articles       | ARRAY                    |
| editor_briefs          | status                   | text                     |
| editor_briefs          | created_at               | timestamp with time zone |
| editor_briefs          | title                    | text                     |
| editor_briefs          | content_variants         | jsonb                    |
| editor_briefs          | source_type              | text                     |
| editor_briefs          | source_id                | uuid                     |
| editor_briefs          | destinations             | ARRAY                    |
| editor_briefs          | updated_at               | timestamp with time zone |
| keyword_clusters       | id                       | uuid                     |
| keyword_clusters       | primary_theme            | text                     |
| keyword_clusters       | sub_theme                | text                     |
| keyword_clusters       | keywords                 | ARRAY                    |
| keyword_clusters       | professions              | ARRAY                    |
| keyword_clusters       | description              | text                     |
| keyword_clusters       | created_at               | timestamp with time zone |
| keyword_plans          | id                       | uuid                     |
| keyword_plans          | title                    | text                     |
| keyword_plans          | description              | text                     |
| keyword_plans          | start_date               | date                     |
| keyword_plans          | end_date                 | date                     |
| keyword_plans          | priority                 | text                     |
| keyword_plans          | status                   | text                     |
| keyword_plans          | associated_clusters      | ARRAY                    |
| keyword_plans          | assigned_to              | text                     |
| keyword_plans          | created_at               | timestamp with time zone |
| keyword_tracking       | id                       | uuid                     |
| keyword_tracking       | keyword                  | text                     |
| keyword_tracking       | category                 | text                     |
| keyword_tracking       | priority                 | text                     |
| keyword_tracking       | article_count            | integer                  |
| keyword_tracking       | last_searched_date       | date                     |
| keyword_tracking       | status                   | text                     |
| keyword_tracking       | created_at               | timestamp with time zone |
| llm_prompts            | id                       | uuid                     |
| llm_prompts            | function_name            | text                     |
| llm_prompts            | model                    | text                     |
| llm_prompts            | prompt_text              | text                     |
| llm_prompts            | include_clusters         | boolean                  |
| llm_prompts            | include_tracking_summary | boolean                  |
| llm_prompts            | include_sources_map      | boolean                  |
| llm_prompts            | is_active                | boolean                  |
| llm_prompts            | created_at               | timestamp with time zone |
| llm_prompts            | updated_at               | timestamp with time zone |
| llm_prompts            | last_updated_by          | text                     |
| news                   | id                       | uuid                     |
| news                   | headline                 | text                     |
| news                   | url                      | text                     |
| news                   | summary                  | text                     |
| news                   | perplexity_score         | numeric                  |
| news                   | timestamp                | timestamp with time zone |
| news                   | matched_clusters         | ARRAY                    |
| news                   | source                   | text                     |
| news                   | is_competitor_covered    | boolean                  |
| news                   | destinations             | ARRAY                    |
| news                   | status                   | text                     |
| news                   | content_variants         | jsonb                    |
| news_approval_stats    | approval_date            | date                     |
| news_approval_stats    | mpdaily_count            | bigint                   |
| news_approval_stats    | magazine_count           | bigint                   |
| news_approval_stats    | website_count            | bigint                   |
| news_approval_stats    | dismissed_count          | bigint                   |
| news_approval_stats    | total_reviewed           | bigint                   |
| profiles               | id                       | uuid                     |
| profiles               | first_name               | text                     |
| profiles               | last_name                | text                     |
| profiles               | email                    | text                     |
| profiles               | avatar_url               | text                     |
| profiles               | created_at               | timestamp with time zone |
| profiles               | updated_at               | timestamp with time zone |
| scheduled_job_settings | id                       | uuid                     |
| scheduled_job_settings | job_name                 | text                     |
| scheduled_job_settings | is_enabled               | boolean                  |
| scheduled_job_settings | schedule                 | text                     |
| scheduled_job_settings | parameters               | jsonb                    |
| scheduled_job_settings | last_run                 | timestamp with time zone |
| scheduled_job_settings | created_at               | timestamp with time zone |
| scheduled_job_settings | updated_at               | timestamp with time zone |
| sources                | id                       | uuid                     |
| sources                | source_name              | text                     |
| sources                | source_url               | text                     |
| sources                | source_type              | text                     |
| sources                | priority_tier            | integer                  |
| sources                | cluster_alignment        | ARRAY                    |
| sources                | created_at               | timestamp with time zone |
| user_roles             | id                       | uuid                     |
| user_roles             | user_id                  | uuid                     |
| user_roles             | role                     | USER-DEFINED             |
| user_roles             | created_at               | timestamp with time zone |
