
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArticleData {
  title: string;
  url: string;
  excerpt: string;
  content: string;
  articleDate: string;
  featuredImageUrl?: string;
  wordCount: number;
  readTimeMinutes: number;
  websiteArticleId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { startDate, endDate } = await req.json();
    
    console.log(`Fetching articles from ${startDate} to ${endDate}`);

    // Create import log entry
    const { data: importLog, error: logError } = await supabase
      .from('article_import_logs')
      .insert({
        date_range_start: startDate,
        date_range_end: endDate,
        status: 'running',
        import_parameters: { startDate, endDate }
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating import log:', logError);
      throw logError;
    }

    // Generate potential URLs based on date range
    const articleUrls = await generateArticleUrls(startDate, endDate);
    console.log(`Generated ${articleUrls.length} potential URLs to check`);

    let articlesFound = 0;
    let articlesImported = 0;
    let articlesSkipped = 0;

    for (const url of articleUrls) {
      try {
        const articleData = await scrapeArticle(url);
        if (articleData) {
          articlesFound++;
          
          // Check if article already exists
          const { data: existingArticle } = await supabase
            .from('articles')
            .select('id')
            .eq('website_article_id', articleData.websiteArticleId)
            .single();

          if (existingArticle) {
            articlesSkipped++;
            console.log(`Article already exists: ${articleData.title}`);
            continue;
          }

          // Insert new article
          const { error: insertError } = await supabase
            .from('articles')
            .insert({
              title: articleData.title,
              source_url: articleData.url,
              website_article_id: articleData.websiteArticleId,
              article_date: articleData.articleDate,
              excerpt: articleData.excerpt,
              featured_image_url: articleData.featuredImageUrl,
              word_count: articleData.wordCount,
              read_time_minutes: articleData.readTimeMinutes,
              scraped_at: new Date().toISOString(),
              status: 'published',
              source_system: 'website',
              content_variants: {
                source_content: {
                  full_content: articleData.content,
                  original_title: articleData.title,
                  fetched_at: new Date().toISOString()
                },
                metadata: {
                  word_count: articleData.wordCount,
                  read_time: articleData.readTimeMinutes
                }
              }
            });

          if (insertError) {
            console.error(`Error inserting article ${articleData.title}:`, insertError);
          } else {
            articlesImported++;
            console.log(`Imported article: ${articleData.title}`);
          }
        }
      } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
      }
    }

    // Update import log
    await supabase
      .from('article_import_logs')
      .update({
        import_completed_at: new Date().toISOString(),
        articles_found: articlesFound,
        articles_imported: articlesImported,
        articles_skipped: articlesSkipped,
        status: 'completed'
      })
      .eq('id', importLog.id);

    return new Response(JSON.stringify({
      success: true,
      articlesFound,
      articlesImported,
      articlesSkipped,
      importLogId: importLog.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-website-articles:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateArticleUrls(startDate: string, endDate: string): Promise<string[]> {
  const urls: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Generate URLs for each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Try to find sitemap or RSS for this date range
    // For now, we'll use a basic approach to discover articles
    try {
      const sitemapUrl = `https://themortgagepoint.com/sitemap.xml`;
      const response = await fetch(sitemapUrl);
      if (response.ok) {
        const sitemapText = await response.text();
        // Extract URLs that match our date pattern
        const urlMatches = sitemapText.match(/https:\/\/themortgagepoint\.com\/\d{4}\/\d{2}\/\d{2}\/[^<]+/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            if (url.includes(`/${year}/${month}/${day}/`)) {
              urls.push(url);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sitemap:', error);
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

async function scrapeArticle(url: string): Promise<ArticleData | null> {
  try {
    console.log(`Scraping article: ${url}`);
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract article ID from URL
    const urlParts = url.split('/');
    const websiteArticleId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
    
    // Extract article date from URL pattern
    const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    const articleDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
    
    // Basic HTML parsing (in production, you'd want a more robust parser)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s*-\s*.*$/, '').trim() : '';
    
    // Extract meta description
    const excerptMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const excerpt = excerptMatch ? excerptMatch[1] : '';
    
    // Extract featured image
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    const featuredImageUrl = imageMatch ? imageMatch[1] : undefined;
    
    // Extract main content (this is a simplified approach)
    const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || 
                         html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    let content = contentMatch ? contentMatch[1] : '';
    
    // Clean up HTML tags for word count
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(' ').length;
    const readTimeMinutes = Math.max(1, Math.round(wordCount / 200)); // 200 words per minute
    
    if (!title || !content) {
      console.log(`Insufficient content found for ${url}`);
      return null;
    }
    
    return {
      title,
      url,
      excerpt,
      content,
      articleDate,
      featuredImageUrl,
      wordCount,
      readTimeMinutes,
      websiteArticleId
    };
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}
