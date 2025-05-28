
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    
    if (!url) {
      throw new Error('URL is required')
    }

    console.log(`Attempting to scrape: ${url}`)

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`)
    }

    const html = await response.text()
    
    // Basic content extraction using regex patterns
    // In production, you might want to use a more sophisticated parser
    
    // Try to extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Try to extract author
    const authorMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i) ||
                       html.match(/<span[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/by\s+([A-Za-z\s]+)/i)
    
    const author = authorMatch ? authorMatch[1].trim() : ''

    // Try to extract publication date
    const dateMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i) ||
                     html.match(/<time[^>]*datetime="([^"]+)"/i) ||
                     html.match(/<meta[^>]*name="date"[^>]*content="([^"]+)"/i)
    
    const publishedDate = dateMatch ? dateMatch[1] : ''

    // Extract main content - look for common article containers
    let content = ''
    const contentPatterns = [
      /<article[^>]*>(.*?)<\/article>/is,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>(.*?)<\/div>/is,
      /<main[^>]*>(.*?)<\/main>/is
    ]

    for (const pattern of contentPatterns) {
      const match = html.match(pattern)
      if (match) {
        content = match[1]
        break
      }
    }

    // Clean up content - remove HTML tags and extra whitespace
    content = content
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Limit content length
    if (content.length > 10000) {
      content = content.substring(0, 10000) + '...'
    }

    const result = {
      success: true,
      data: {
        title: title || 'Could not extract title',
        author: author || 'Unknown',
        content: content || 'Could not extract content',
        publishedDate: publishedDate || null,
        scrapedAt: new Date().toISOString()
      }
    }

    console.log('Scraping result:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Scraping error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        data: null
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400
      }
    )
  }
})
