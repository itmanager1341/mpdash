
import { useEffect, useState } from "react";
import { FileText, Edit, Search, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import DocumentViewer from "@/components/documentation/DocumentViewer";
import DocumentEditor from "@/components/documentation/DocumentEditor";
import { useIsMobile } from "@/hooks/use-mobile";

// Define knowledge file types
type KnowledgeFile = {
  id: string;
  title: string;
  filePath: string;
  category: "core" | "domain" | "technical" | "user";
  description: string;
  lastUpdated?: string;
  content: string; // Store content directly in the knowledge file object
};

// Knowledge base content - embedded directly instead of fetching from external files
const knowledgeFiles: KnowledgeFile[] = [
  {
    id: "app",
    title: "Application Overview",
    filePath: "app.knowledge.md",
    category: "core",
    description: "Overall application structure, features, and architecture",
    lastUpdated: "2025-03-15",
    content: `
# MP Editorial Dashboard

## Application Overview
The MP Editorial Dashboard is a comprehensive content management system designed for MortgagePoint's editorial team. It supports content creation, planning, and publication across three main channels:

- **MPDaily**: Daily news email sent to subscribers
- **MPMagazine**: Monthly print and feature web publication
- **MortgagePoint.com**: Main website content

## Core Features

1. **Today's Briefing**: AI-curated news suggestions with quick approval actions
2. **Content Planning**: Tools for MPDaily and Magazine planning
3. **Content Calendar**: Visualization of publishing schedule across channels
4. **Performance Dashboard**: Metrics and analytics for published content
5. **Admin Settings**: System configuration and API management

## Architecture
- Frontend: React application with Tailwind CSS and shadcn/ui components
- Backend: Supabase for data storage, authentication, and serverless functions
- AI Integration: Perplexity API for news discovery, OpenAI for content generation
`
  },
  {
    id: "api-management",
    title: "API Management",
    filePath: "api-management.knowledge.md",
    category: "core",
    description: "API key management system, supported services, and usage patterns",
    lastUpdated: "2025-04-02",
    content: `
# API Management System

## Overview
The MP Editorial Dashboard integrates with several external APIs to enhance functionality. The API Management system allows administrators to securely store API keys and test connections.

## Supported Services

1. **Perplexity API**: Used for news discovery and semantic search
   - Key format: Starts with \`pplx-\`
   - Primary use: Fetching relevant mortgage industry news

2. **OpenAI API**: Used for content generation and enhancement
   - Primary use: Creating article drafts and summaries

3. **FRED API**: Used for economic data
   - Primary use: Incorporating economic indicators into articles

4. **Other Services**: Support for additional APIs (HubSpot, etc.)

## API Key Management

- **Storage**: API keys are stored securely in Supabase Edge Function secrets
- **Database**: Metadata about keys (masked version, service name) stored in \`api_keys\` table
- **Security**: Full key values are never exposed in the frontend or database

## Usage Flow

1. Admin adds API key through the Admin Settings interface
2. Key is stored as a Supabase secret and metadata in the database
3. Edge functions access the keys directly from environment variables
4. API interactions are performed exclusively through Edge Functions

## Testing Capabilities

Each service has testing functionality to verify:
- API key validity
- Connection status
- Basic functionality
`
  },
  {
    id: "news-workflow",
    title: "News Workflow",
    filePath: "news-workflow.knowledge.md",
    category: "core",
    description: "News importing, approval, and generation processes",
    lastUpdated: "2025-04-10",
    content: `
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
- \`suggested\`: AI-recommended but not reviewed
- \`queued_mpdaily\`: Approved for MPDaily email
- \`queued_magazine\`: Routed to Magazine planning
- \`drafted\`: Content written but not reviewed
- \`approved\`: Ready for publishing
- \`published\`: Live on platform
- \`archived\`: No longer active
`
  },
  {
    id: "ai-models",
    title: "AI Models & LLMs",
    filePath: "ai-models-reference.knowledge.md",
    category: "technical",
    description: "AI models and LLMs used throughout the platform with workflow integration details",
    lastUpdated: "2025-05-05",
    content: `
# AI Models & LLMs Reference

## Workflow Integration Table

| **Workflow Step**                         | **Purpose**                                                            | **LLM/Model Used**           | **Invocation Layer**              |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| **Trend Discovery**                       | Find 5–10 timely and relevant articles daily                           | Perplexity API               | Supabase Edge Function or n8n     |
| **Trend Scoring**                         | Assign \`perplexity_score\` based on urgency, originality, impact        | Claude or GPT-4o             | Supabase function or n8n          |
| **News Summary + CTA**                    | Summarize news item + generate one-sentence CTA                        | Claude or GPT-4o             | \`compose_flash(news_id)\`          |
| **MPDaily Article Brief Creation**        | Create short-form email-ready article brief                            | Claude or GPT-4o             | \`create_article_brief()\`          |
| **Magazine Feature Research Pack**        | Build long-form outlines with context + sources                        | Claude + Perplexity API      | \`generate_deep_pack(issue_theme)\` |
| **Similarity Search from Archive**        | Find related past MP articles via embedding vector search              | OpenAI Embedding v3-small    | Supabase Edge Function            |
| **AI Draft Enrichment (After Selection)** | Expand brief into full-length article, suggest references              | Claude                       | Claude MCP pipeline               |
| **Performance Analysis**                  | Evaluate articles post-publish: score, cluster health, engagement      | GPT-4o or Claude             | \`score_article_performance()\`     |
| **AI-Enhanced Formatting for Publishing** | Rephrase/structure content for MPDaily email or WordPress layout       | GPT-4o or GPT-3.5            | \`format_for_mp_article()\`         |
| **Competitor Awareness Detection**        | Tag trade-sourced articles as \`is_competitor_covered\`                  | Logic-based or GPT-3.5       | Within \`news\` ingestion process   |
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
`
  },
  {
    id: "mortgage-industry",
    title: "Mortgage Industry",
    filePath: "mortgage-industry.knowledge.md",
    category: "domain",
    description: "Key terms, concepts, and trends in the mortgage industry",
    lastUpdated: "2025-03-28",
    content: `
# Mortgage Industry Reference

## Key Industry Terms and Concepts

### Core Mortgage Types
1. **Conventional Mortgages**
   - Conforming: Meet Fannie Mae/Freddie Mac guidelines
   - Non-conforming: Exceed loan limits or other criteria
   - Fixed-rate: Constant interest rate throughout term
   - Adjustable-rate (ARM): Rate adjusts periodically

2. **Government-backed Loans**
   - FHA: Federal Housing Administration
   - VA: Veterans Affairs
   - USDA: U.S. Department of Agriculture

### Industry Stakeholders
1. **Originators**
   - Banks
   - Non-bank lenders
   - Credit unions
   - Mortgage brokers

2. **Servicers**
   - Handle payment collection
   - Manage escrow accounts
   - Process loss mitigation

3. **Secondary Market Entities**
   - GSEs (Fannie Mae, Freddie Mac)
   - Ginnie Mae
   - Private investors

### Regulatory Bodies
1. **Federal**
   - Consumer Financial Protection Bureau (CFPB)
   - Federal Housing Finance Agency (FHFA)
   - Department of Housing and Urban Development (HUD)
   - Federal Reserve

2. **State**
   - State banking departments
   - Licensing authorities

## Current Industry Trends
1. **Digital Transformation**
   - eClosings and Remote Online Notarization (RON)
   - Automated underwriting
   - Blockchain applications

2. **Market Dynamics**
   - Interest rate environment
   - Housing supply constraints
   - Affordability challenges

3. **Regulatory Focus Areas**
   - Fair lending
   - Servicing standards
   - Climate risk
   - AI/ML governance

## Key Economic Indicators
1. **Housing Market**
   - Home price indices (Case-Shiller, FHFA, CoreLogic)
   - Housing starts and permits
   - Existing home sales

2. **Mortgage Market**
   - Mortgage rates
   - Mortgage application volume
   - Delinquency and foreclosure rates
`
  },
  {
    id: "editorial-workflow",
    title: "Editorial Workflow",
    filePath: "editorial-workflow.knowledge.md",
    category: "domain",
    description: "Editorial workflows, content types, and publication standards",
    lastUpdated: "2025-04-18",
    content: `
# Editorial Workflow Guide

## Content Types

1. **News Updates**:
   - Brief, timely updates on industry developments
   - Typical length: 150-300 words
   - Primary channel: MPDaily

2. **Analysis Articles**:
   - In-depth examination of trends or events
   - Typical length: 800-1200 words
   - Primary channels: Magazine, Website

3. **Feature Stories**:
   - Comprehensive coverage of major topics
   - Typical length: 1500+ words
   - Primary channel: Magazine

4. **Data Reports**:
   - Data-driven analysis with visualizations
   - Typical length: 600-1000 words
   - Primary channels: Website, Magazine

## Editorial Calendar Planning

1. **Daily Planning (MPDaily)**:
   - Morning meeting: Review AI suggestions
   - Mid-day: Finalize selections
   - Afternoon: Schedule next day's email

2. **Magazine Planning**:
   - Monthly theme selection (6 weeks before publication)
   - Article assignments (4 weeks before publication)
   - Draft submissions (2 weeks before publication)
   - Final edits (1 week before publication)

3. **Website Planning**:
   - Weekly content calendar review
   - Coverage gap analysis
   - Evergreen content planning

## Content Standards

1. **Style Guide**:
   - AP Style with industry-specific modifications
   - Formal but accessible tone
   - Data-backed statements

2. **Source Requirements**:
   - Primary sources preferred
   - Minimum of 2 sources per article
   - Competitor attribution guidelines

3. **Editorial Voice**:
   - Authoritative but not academic
   - Practical focus on industry applications
   - Reader-focused (addressing "so what?" factor)

## Approval Process

1. **First Review**: Content editor
2. **Second Review**: Subject matter expert (for technical accuracy)
3. **Final Approval**: Managing editor
4. **Publication**: According to channel-specific schedule
`
  },
  {
    id: "supabase-integration",
    title: "Supabase Integration",
    filePath: "supabase-integration.knowledge.md",
    category: "technical",
    description: "Database schema, edge functions, and API usage patterns",
    lastUpdated: "2025-03-22",
    content: `
# Supabase Integration

## Database Schema

### Core Tables
1. **news**
   - Stores trending news articles from external sources
   - Contains AI-generated metrics and metadata
   - Key fields: title, url, source, summary, perplexity_score

2. **articles**
   - Editorial content at various workflow stages
   - Linked to news sources when applicable
   - Key fields: title, content, status, author_id, published_at

3. **editor_briefs**
   - Planning documents for upcoming content
   - Key fields: theme, target_date, outline, references

4. **keyword_clusters**
   - Categorization system for content organization
   - Hierarchical structure with parent-child relationships
   - Key fields: name, description, parent_cluster_id

### Supporting Tables
1. **keyword_tracking**
   - Monitors performance of specific keywords over time
   - Key fields: keyword, mention_count, sentiment_score

2. **sources**
   - External content providers with prioritization data
   - Key fields: name, url, priority_tier, reliability_score

## Edge Functions

### News Processing
1. **fetch-perplexity-news**
   - Queries Perplexity API for relevant industry news
   - Filters and scores results before database insertion
   - Invoked on schedule or manual trigger

2. **test-perplexity-key**
   - Validates Perplexity API key functionality
   - Returns sample results and status information

### Content Generation
1. **generate-article**
   - Creates draft content from news items
   - Supports multiple output formats (MPDaily, Magazine)
   - Integrates FRED economic data when relevant

### API Key Management
1. **set-api-key**
   - Securely stores API keys as environment variables
   - Creates masked database records for reference

2. **list-api-keys**
   - Returns metadata about stored API keys
   - Does not expose actual key values

## Security Implementation
1. **Row Level Security**
   - Editor-specific content visibility
   - Role-based access controls
   - Audit logging for sensitive operations

2. **API Key Protection**
   - Keys stored as edge function environment variables
   - Never exposed in client-side code or database values
   - Masked representations for UI display
`
  },
  {
    id: "ai-integration",
    title: "AI Integration",
    filePath: "ai-integration.knowledge.md",
    category: "technical",
    description: "How we use OpenAI and Perplexity APIs, prompt patterns, and best practices",
    lastUpdated: "2025-04-05",
    content: `
# AI Integration

## AI Services

1. **Perplexity API**
   - **Purpose**: News discovery and semantic search
   - **Implementation**: Edge function for fetching relevant industry news
   - **Key Features**:
     - Relevance scoring
     - Customizable search parameters
     - Structured data extraction

2. **OpenAI API**
   - **Purpose**: Content generation and enhancement
   - **Implementation**: Edge function for creating article drafts
   - **Key Features**:
     - Format-specific content generation
     - Audience-targeted writing style
     - Data integration capabilities

## Prompt Engineering

### News Discovery Prompts
- Focus on mortgage industry relevance
- Emphasis on recency and impact
- Filtering for duplication and quality

### Content Generation Prompts
1. **MPDaily Format**:
   - Concise, email-friendly format
   - Clear headline
   - 3-4 sentence summary
   - 2-3 bullet points
   - Call-to-action

2. **Magazine Format**:
   - Comprehensive article structure
   - Executive summary
   - Section headers with descriptions
   - Expert source suggestions
   - Data point recommendations

## AI Workflow Integration

1. **Content Suggestion**:
   - AI identifies relevant news
   - Ranks by relevance to audience
   - Flags competitor coverage

2. **Content Enhancement**:
   - AI generates draft content
   - Integrates economic data
   - Suggests related content

3. **Performance Optimization**:
   - AI analyzes content performance
   - Suggests optimization strategies
   - Identifies trending topics

## AI Configuration

- Temperature settings for different content types
- Token limits optimized by content format
- Model selection based on task complexity
- Frequency and presence penalties for diversity
`
  },
  {
    id: "admin-guide",
    title: "Administrator Guide",
    filePath: "admin-guide.knowledge.md",
    category: "user",
    description: "How to configure and administer the system",
    lastUpdated: "2025-04-12",
    content: `
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
`
  },
  {
    id: "editor-guide",
    title: "Editor Guide",
    filePath: "editor-guide.knowledge.md",
    category: "user",
    description: "How editors should use the different features of the platform",
    lastUpdated: "2025-04-20",
    content: `
# Editor's Guide

## Daily Workflow

### Morning Routine
1. Review Today's Briefing
   - Approve high-priority news items (max 5)
   - Route items to appropriate channels
   - Dismiss irrelevant suggestions

2. Check MPDaily Queue
   - Review scheduled items
   - Adjust ordering if needed
   - Ensure balanced content mix

### Afternoon Tasks
1. Generate article drafts for approved items
   - Select appropriate format (MPDaily/Magazine)
   - Review and edit AI-generated content
   - Add editorial context where needed

2. Update Content Calendar
   - Check for coverage gaps
   - Identify potential conflicts
   - Balance content categories

## Publication Tools

### MPDaily Planner
- Drag-to-reorder functionality for email content
- HTML preview of email format
- AM/PM timing toggle
- Campaign tagging options

### Magazine Planner
- Kanban board organized by issue
- Theme tagging system
- Editor assignment function
- Source bundling tool

### Content Calendar
- Month/week toggle views
- Color-coding by publication channel
- Quick preview/edit capabilities
- Conflict detection

## Content Enhancement

### Using AI Generation
1. Select a news item as the source
2. Choose target format
3. Review generated content
4. Customize as needed:
   - Edit headline for clarity
   - Enhance key points
   - Add editorial perspective

### Incorporating Economic Data
1. Access FRED data integration
2. Select relevant indicators
3. Choose visualization format
4. Add contextual analysis

## Performance Analysis

1. Review content metrics:
   - Open rates for MPDaily items
   - Read time for Magazine articles
   - Click-through rates for calls-to-action

2. Identify patterns:
   - Best-performing topics
   - Optimal publication times
   - Most engaging formats

3. Apply insights to future planning:
   - Topic selection
   - Content formatting
   - Distribution timing
`
  }
];

export default function Documentation() {
  const isMobile = useIsMobile();
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentCategory, setCurrentCategory] = useState<"all" | "core" | "domain" | "technical" | "user">("all");
  const [openFileInfo, setOpenFileInfo] = useState(false);

  // Filter files based on search and category
  const filteredFiles = knowledgeFiles.filter(file => {
    const matchesSearch = searchQuery === "" || 
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      file.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = currentCategory === "all" || file.category === currentCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Select first file on initial load if none selected
  useEffect(() => {
    if (!selectedFile && filteredFiles.length > 0) {
      setSelectedFile(filteredFiles[0]);
    }
  }, [filteredFiles, selectedFile]);

  // Handle document save
  const handleSaveDocument = async (content: string, title: string) => {
    if (!selectedFile) return;
    
    try {
      // In a real implementation, this would save to your storage
      toast.success("Document saved successfully");
      
      // Update the content in our local state
      const updatedFiles = knowledgeFiles.map(file => {
        if (file.id === selectedFile.id) {
          return { ...file, content, title };
        }
        return file;
      });
      
      // In a real implementation, we would persist this change to the server
      
      setMode("view");
    } catch (error) {
      console.error("Error saving document:", error);
      toast.error("Failed to save document");
    }
  };

  // File info component that shows in either dialog or drawer based on device
  const FileInfoContent = () => (
    <>
      {selectedFile && (
        <>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Document Details</h3>
              <p className="text-sm text-muted-foreground">Information about this document</p>
            </div>
            <Separator />
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium">Title</dt>
                <dd className="text-base">{selectedFile.title}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Category</dt>
                <dd className="text-base capitalize">{selectedFile.category}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium">File Path</dt>
                <dd className="text-base font-mono text-sm bg-muted p-1 rounded">{selectedFile.filePath}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Last Updated</dt>
                <dd className="text-base">{selectedFile.lastUpdated || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Description</dt>
                <dd className="text-base">{selectedFile.description}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Documentation & Guides</h1>
            {selectedFile && mode === "view" && (
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setOpenFileInfo(true)}
                >
                  <Info className="mr-2 h-4 w-4" />
                  Info
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setMode("edit")}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left sidebar with document list */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>Documentation and guides</CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <Tabs defaultValue="all" onValueChange={(value) => setCurrentCategory(value as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="core">Core</TabsTrigger>
                    <TabsTrigger value="domain">Domain</TabsTrigger>
                    <TabsTrigger value="technical">Technical</TabsTrigger>
                    <TabsTrigger value="user">User</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
              
              <ScrollArea className="h-[60vh]">
                <div className="px-4 py-2">
                  {filteredFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents found
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredFiles.map((file) => (
                        <div key={file.id}>
                          <Button
                            variant={selectedFile?.id === file.id ? "secondary" : "ghost"}
                            className="w-full justify-start text-left"
                            onClick={() => {
                              setSelectedFile(file);
                              setMode("view"); // Reset to view mode when changing files
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            <span className="truncate">{file.title}</span>
                          </Button>
                          <Separator className="my-1" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Right content area */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>{selectedFile?.title || "Select a document"}</CardTitle>
                <CardDescription>{selectedFile?.description || ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedFile ? (
                  mode === "view" ? (
                    <ScrollArea className="h-[60vh] pr-4">
                      <DocumentViewer 
                        content={selectedFile.content || ""} 
                        lastUpdated={selectedFile.lastUpdated}
                      />
                    </ScrollArea>
                  ) : (
                    <DocumentEditor 
                      initialContent={selectedFile.content || ""} 
                      initialTitle={selectedFile.title}
                      onSave={handleSaveDocument} 
                      onCancel={() => setMode("view")}
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Select a document to view</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a document from the sidebar to view its contents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Responsive file info dialog/drawer */}
      {isMobile ? (
        <Drawer open={openFileInfo} onOpenChange={setOpenFileInfo}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Document Information</DrawerTitle>
              <DrawerDescription>Details about the selected document</DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <FileInfoContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={openFileInfo} onOpenChange={setOpenFileInfo}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Document Information</DialogTitle>
              <DialogDescription>Details about the selected document</DialogDescription>
            </DialogHeader>
            <FileInfoContent />
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
