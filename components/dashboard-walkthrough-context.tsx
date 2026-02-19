"use client";

import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

type StartWalkthrough = () => void;

type DashboardWalkthroughContextValue = {
  registerStartWalkthrough: (fn: StartWalkthrough) => void;
  startWalkthrough: () => void;
};

const DashboardWalkthroughContext = createContext<DashboardWalkthroughContextValue | null>(null);

export function DashboardWalkthroughProvider({ children }: PropsWithChildren) {
  const startRef = useRef<StartWalkthrough | null>(null);

  const registerStartWalkthrough = useCallback((fn: StartWalkthrough) => {
    startRef.current = fn;
    return () => {
      startRef.current = null;
    };
  }, []);

  const startWalkthrough = useCallback(() => {
    startRef.current?.();
  }, []);

  const value: DashboardWalkthroughContextValue = {
    registerStartWalkthrough,
    startWalkthrough
  };

  return (
    <DashboardWalkthroughContext.Provider value={value}>
      {children}
    </DashboardWalkthroughContext.Provider>
  );
}

export function useDashboardWalkthrough(): DashboardWalkthroughContextValue {
  const resolved = useContext(DashboardWalkthroughContext);
  if (resolved == null) throw new Error("useDashboardWalkthrough must be used within DashboardWalkthroughProvider");
  return resolved;
}
