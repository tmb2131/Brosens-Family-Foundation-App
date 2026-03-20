import { cn } from "@/lib/utils";

type Variant = "fixed" | "wide-sidebar" | "narrow-sidebar";
type Breakpoint = "lg" | "xl" | "2xl";

interface PageWithSidebarProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  /** Column layout preset. Default: `"fixed"` (1fr + 320px). */
  variant?: Variant;
  /** Breakpoint at which the two-column grid activates. Default: `"lg"`. */
  breakpoint?: Breakpoint;
  /** Pin the sidebar with `position: sticky`. Default: `false`. */
  sticky?: boolean;
  /**
   * Hide the sidebar below the breakpoint (each page renders its own
   * mobile-specific alternative inline). Set to `false` when the sidebar
   * should simply stack below the main content on narrow viewports.
   * Default: `true`.
   */
  collapsible?: boolean;
  className?: string;
}

const colsClass: Record<Breakpoint, Record<Variant, string>> = {
  lg: {
    fixed: "lg:grid-cols-[1fr_320px]",
    "wide-sidebar": "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]",
    "narrow-sidebar": "lg:grid-cols-[minmax(0,2fr)_minmax(16rem,0.75fr)]",
  },
  xl: {
    fixed: "xl:grid-cols-[1fr_320px]",
    "wide-sidebar": "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]",
    "narrow-sidebar": "xl:grid-cols-[minmax(0,2fr)_minmax(16rem,0.75fr)]",
  },
  "2xl": {
    fixed: "2xl:grid-cols-[1fr_320px]",
    "wide-sidebar": "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]",
    "narrow-sidebar": "2xl:grid-cols-[minmax(0,2fr)_minmax(16rem,0.75fr)]",
  },
};

const gridClass: Record<Breakpoint, string> = {
  lg: "lg:grid",
  xl: "xl:grid",
  "2xl": "2xl:grid",
};

const hideClass: Record<Breakpoint, string> = {
  lg: "hidden lg:grid",
  xl: "hidden xl:grid",
  "2xl": "hidden 2xl:grid",
};

const stickyClass: Record<Breakpoint, string> = {
  lg: "lg:sticky lg:top-6",
  xl: "xl:sticky xl:top-6",
  "2xl": "2xl:sticky 2xl:top-6",
};

export function PageWithSidebar({
  children,
  sidebar,
  variant = "fixed",
  breakpoint = "lg",
  sticky = false,
  collapsible = true,
  className,
}: PageWithSidebarProps) {
  const sidebarContent = sticky ? (
    <div className={stickyClass[breakpoint]}>{sidebar}</div>
  ) : (
    sidebar
  );

  return (
    <div
      className={cn(
        "gap-3",
        collapsible ? gridClass[breakpoint] : "grid",
        colsClass[breakpoint][variant],
        className,
      )}
    >
      {children}
      {collapsible ? (
        <div className={hideClass[breakpoint]}>{sidebarContent}</div>
      ) : (
        sidebarContent
      )}
    </div>
  );
}
