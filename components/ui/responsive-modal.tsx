"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer"

const MOBILE_BREAKPOINT = 640

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

// Shared context so ResponsiveModalContent/Close reuse the parent's media query
// result instead of each creating their own listener.
const IsMobileContext = React.createContext<boolean>(false)

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function ResponsiveModal({ open, onOpenChange, children }: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <IsMobileContext.Provider value={true}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      </IsMobileContext.Provider>
    )
  }

  return (
    <IsMobileContext.Provider value={false}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </IsMobileContext.Provider>
  )
}

interface ResponsiveModalContentProps {
  children: React.ReactNode
  className?: string
  dialogClassName?: string
  drawerClassName?: string
  showCloseButton?: boolean
  onInteractOutside?: (e: Event) => void
  "aria-labelledby"?: string
}

function ResponsiveModalContent({
  children,
  className,
  dialogClassName,
  drawerClassName,
  showCloseButton = true,
  onInteractOutside,
  "aria-labelledby": ariaLabelledby,
}: ResponsiveModalContentProps) {
  const isMobile = React.useContext(IsMobileContext)

  if (isMobile) {
    return (
      <DrawerContent
        className={cn(drawerClassName, className)}
        aria-labelledby={ariaLabelledby}
      >
        <div className="overflow-y-auto p-4 pb-[env(safe-area-inset-bottom,16px)]">
          {children}
        </div>
      </DrawerContent>
    )
  }

  return (
    <DialogContent
      className={cn(dialogClassName, className)}
      showCloseButton={showCloseButton}
      onInteractOutside={onInteractOutside}
      aria-labelledby={ariaLabelledby}
    >
      {children}
    </DialogContent>
  )
}

function ResponsiveModalClose(props: React.ComponentProps<"button">) {
  const isMobile = React.useContext(IsMobileContext)

  if (isMobile) {
    return <DrawerClose {...props} />
  }

  return <DialogClose {...props} />
}

export { ResponsiveModal, ResponsiveModalContent, ResponsiveModalClose, useIsMobile }
