import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Calendar,
  Settings,
  ChevronDown,
  ChevronRight,
  Newspaper,
  BookOpen,
  Target,
  Database,
  Edit3,
  Users,
  Brain,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const navigation = [
  {
    name: "Today's Briefing",
    href: "/",
    icon: LayoutDashboard,
    description: "AI-curated news triage and approval"
  },
  {
    name: "Editorial Hub",
    href: "/editorial",
    icon: Edit3,
    description: "Create and enhance content from sources"
  },
  {
    name: "Content Planning",
    icon: Calendar,
    description: "Publication planning and scheduling",
    children: [
      {
        name: "MPDaily Planner",
        href: "/mpdaily-planner",
        icon: Newspaper,
        description: "Daily newsletter scheduling"
      },
      {
        name: "Magazine Planner", 
        href: "/magazine-planner",
        icon: BookOpen,
        description: "Monthly magazine planning"
      },
      {
        name: "Content Calendar",
        href: "/content-calendar",
        icon: Calendar,
        description: "Unified publication calendar"
      }
    ]
  },
  {
    name: "Analytics",
    icon: TrendingUp,
    description: "Performance insights and metrics",
    children: [
      {
        name: "Performance Dashboard",
        href: "/performance-dashboard",
        icon: TrendingUp,
        description: "Content performance metrics"
      }
    ]
  },
  {
    name: "Management",
    icon: Settings,
    description: "System configuration and settings",
    children: [
      {
        name: "Admin Dashboard",
        href: "/admin",
        icon: Users,
        description: "Core admin functions and controls"
      },
      {
        name: "LLM Management",
        href: "/llm-management",
        icon: Brain,
        description: "AI models, prompts, and usage"
      },
      {
        name: "Keyword Management",
        href: "/keyword-management",
        icon: Target,
        description: "Keywords, clusters, and prompts"
      },
      {
        name: "Editorial Settings",
        href: "/editorial-dashboard",
        icon: Database,
        description: "AI prompts and automation"
      },
      {
        name: "Admin Settings",
        href: "/admin-settings",
        icon: Settings,
        description: "System settings and configuration"
      },
      {
        name: "Documentation",
        href: "/documentation",
        icon: FileText,
        description: "User guides and documentation"
      }
    ]
  }
];

export default function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  const hasActiveChild = (children: any[]) => {
    return children?.some(child => isActiveRoute(child.href));
  };

  return (
    <div className="flex flex-col w-64 bg-background border-r h-full">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">MP Editorial</h1>
        <p className="text-sm text-muted-foreground">AI Dashboard</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            const isExpanded = expandedItems.includes(item.name);
            const hasActive = hasActiveChild(item.children);
            
            return (
              <Collapsible 
                key={item.name} 
                open={isExpanded || hasActive}
                onOpenChange={() => toggleExpanded(item.name)}
              >
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={cn(
                      "w-full justify-between h-auto p-3 text-left",
                      (isExpanded || hasActive) && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center">
                      <item.icon className="mr-3 h-4 w-4" />
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    {isExpanded || hasActive ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 mt-1">
                  {item.children.map((child) => (
                    <Button
                      key={child.href}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start h-auto p-3 text-left",
                        isActiveRoute(child.href) && "bg-accent text-accent-foreground"
                      )}
                      asChild
                    >
                      <Link to={child.href}>
                        <child.icon className="mr-3 h-4 w-4" />
                        <div>
                          <div className="font-medium">{child.name}</div>
                          <div className="text-xs text-muted-foreground">{child.description}</div>
                        </div>
                      </Link>
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "w-full justify-start h-auto p-3 text-left",
                isActiveRoute(item.href!) && "bg-accent text-accent-foreground"
              )}
              asChild
            >
              <Link to={item.href!}>
                <item.icon className="mr-3 h-4 w-4" />
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </Link>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
