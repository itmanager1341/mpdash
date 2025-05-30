## Based on the editorial dashboard requirements, here are the proposed database tables and fields needed to track article and author performance metrics:

## Core Content Tables

**Articles Table**
- article_id (Primary Key)
- title
- author_id (Foreign Key)
- category_id (Foreign Key)
- publication_date
- last_updated
- word_count
- status (draft, published, archived)
- featured_image_url
- meta_description
- slug/url_path
- editor_id (Foreign Key)

**Authors Table**
- author_id (Primary Key)
- author_name
- email
- bio
- profile_image_url
- join_date
- author_type (staff, freelance, guest)
- social_media_handles
- expertise_tags

**Categories Table**
- category_id (Primary Key)
- category_name
- parent_category_id
- description

## Analytics and Performance Tables

**Article_Analytics Table**
- analytics_id (Primary Key)
- article_id (Foreign Key)
- date_recorded
- page_views
- unique_visitors
- time_on_page (seconds)
- bounce_rate
- scroll_depth_percentage
- exit_rate
- returning_visitors

**Traffic_Sources Table**
- source_id (Primary Key)
- article_id (Foreign Key)
- date_recorded
- source_type (organic, social, direct, referral, email)
- source_name (google, facebook, twitter, etc.)
- sessions
- page_views
- conversion_rate

**Social_Engagement Table**
- engagement_id (Primary Key)
- article_id (Foreign Key)
- platform (facebook, twitter, linkedin, instagram)
- shares_count
- likes_count
- comments_count
- date_recorded

**Reader_Interactions Table**
- interaction_id (Primary Key)
- article_id (Foreign Key)
- user_id (if available)
- interaction_type (comment, like, share, bookmark)
- timestamp
- content (for comments)
- sentiment_score

## Conversion and Business Metrics Tables

**Conversions Table**
- conversion_id (Primary Key)
- article_id (Foreign Key)
- user_id
- conversion_type (subscription, newsletter_signup, purchase)
- conversion_value
- timestamp
- attribution_model

**Email_Signups Table**
- signup_id (Primary Key)
- article_id (Foreign Key)
- email_address
- signup_date
- source_location (inline, popup, footer)

**Internal_Links Table**
- link_id (Primary Key)
- source_article_id (Foreign Key)
- target_article_id (Foreign Key)
- click_count
- date_recorded
- link_position

## Author Performance Tables

**Author_Performance_Daily Table**
- performance_id (Primary Key)
- author_id (Foreign Key)
- date_recorded
- total_views
- total_time_on_page
- average_bounce_rate
- articles_published
- total_social_shares
- total_comments

**Author_Rankings Table**
- ranking_id (Primary Key)
- author_id (Foreign Key)
- ranking_period (daily, weekly, monthly)
- period_start_date
- views_rank
- engagement_rank
- conversion_rank
- overall_score

## Content Quality and Feedback Tables

**Content_Feedback Table**
- feedback_id (Primary Key)
- article_id (Foreign Key)
- user_id
- rating (1-5 scale)
- feedback_text
- sentiment_score
- date_submitted

**SEO_Metrics Table**
- seo_id (Primary Key)
- article_id (Foreign Key)
- date_recorded
- organic_impressions
- organic_clicks
- average_position
- click_through_rate
- featured_snippet_appearances

**External_Citations Table**
- citation_id (Primary Key)
- article_id (Foreign Key)
- citing_domain
- citation_url
- citation_date
- citation_type (backlink, mention, quote)

## Dashboard Configuration Tables

**Dashboard_Widgets Table**
- widget_id (Primary Key)
- widget_name
- widget_type
- default_metrics
- refresh_interval

**User_Dashboard_Settings Table**
- setting_id (Primary Key)
- user_id (Foreign Key)
- widget_preferences
- default_date_range
- favorite_metrics

## Calculated Fields and Indexes

**Key Calculated Fields to Include:**
- engagement_score (composite of time_on_page, scroll_depth, social_shares)
- author_consistency_score (based on publishing frequency and performance variance)
- content_velocity (views per hour in first 24 hours)
- reader_retention_rate (percentage of readers who view multiple articles)
- conversion_attribution_score (weighted conversion value per article)

**Essential Database Indexes:**
- article_id + date_recorded (for time-series queries)
- author_id + publication_date (for author performance tracking)
- category_id + page_views (for category performance analysis)
- source_type + date_recorded (for traffic source analysis)

This table structure provides the foundation for tracking all primary and secondary metrics while maintaining data integrity and enabling efficient querying for dashboard generation.

---
Answer from Perplexity: pplx.ai/share
