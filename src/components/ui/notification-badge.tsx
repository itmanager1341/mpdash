
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const notificationBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ring-primary",
        secondary: "bg-secondary text-secondary-foreground ring-secondary",
        destructive: "bg-destructive text-destructive-foreground ring-destructive",
        outline: "bg-background text-foreground ring-muted-foreground",
      },
      size: {
        default: "h-5 w-5",
        sm: "h-4 w-4 text-[10px]",
        lg: "h-6 w-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface NotificationBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof notificationBadgeVariants> {}

function NotificationBadge({
  className,
  variant,
  size,
  ...props
}: NotificationBadgeProps) {
  return (
    <span
      className={cn(notificationBadgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { NotificationBadge, notificationBadgeVariants }
