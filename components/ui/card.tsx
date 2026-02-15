import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

/**
 * Legacy convenience component: renders glass-card styled section.
 * Used across the app for dashboard/workspace/meeting cards.
 */
function GlassCard({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <section className={cn("glass-card rounded-2xl p-4", className)}>{children}</section>
}

/**
 * Legacy convenience: small uppercase label inside a card.
 */
function CardLabel({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <h3 className={cn("text-sm uppercase tracking-wide text-muted-foreground", className)}>{children}</h3>
}

/**
 * Legacy convenience: prominent value display inside a card.
 */
function CardValue({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <p className={cn("mt-1 text-xl font-semibold", className)}>{children}</p>
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  GlassCard,
  CardLabel,
  CardValue,
}
