import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        "destructive-outline":
          "border border-destructive/30 text-destructive bg-destructive/5 shadow-xs hover:bg-destructive/10 hover:border-destructive/50 dark:bg-destructive/10 dark:border-destructive/30 dark:hover:bg-destructive/20 dark:hover:border-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        prominent:
          "min-h-10 gap-1 border border-[hsl(var(--accent)/0.78)] bg-[hsl(var(--accent))] text-white shadow-[0_12px_24px_-16px_hsl(var(--accent)/0.96)] hover:bg-[hsl(var(--accent)/0.9)] hover:shadow-[0_14px_28px_-16px_hsl(var(--accent)/1)] focus-visible:ring-[hsl(var(--accent)/0.45)]",
        proposal:
          "min-h-10 gap-1.5 border border-[rgb(var(--proposal-cta-border))] bg-[rgb(var(--proposal-cta))] text-[rgb(var(--proposal-cta-foreground))] shadow-[0_12px_24px_-16px_rgb(var(--proposal-cta)/0.95)] hover:bg-[rgb(var(--proposal-cta-hover))] hover:shadow-[0_14px_28px_-16px_rgb(var(--proposal-cta)/1)] focus-visible:ring-[rgb(var(--proposal-cta-ring))]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "min-h-11 px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
