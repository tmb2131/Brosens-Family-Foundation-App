"use client";

import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

type StartWalkthrough = () => void;

type MobileWalkthroughContextValue = {
  registerStartWalkthrough: (fn: StartWalkthrough) => void;
  startWalkthrough: () => void;
};

const MobileWalkthroughContext = createContext<MobileWalkthroughContextValue | null>(null);

export function MobileWalkthroughProvider({ children }: PropsWithChildren) {
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

  const value: MobileWalkthroughContextValue = {
    registerStartWalkthrough,
    startWalkthrough
  };

  return (
    <MobileWalkthroughContext.Provider value={value}>
      {children}
    </MobileWalkthroughContext.Provider>
  );
}

export function useMobileWalkthrough(): MobileWalkthroughContextValue {
  const resolved = useContext(MobileWalkthroughContext);
  if (resolved == null) throw new Error("useMobileWalkthrough must be used within MobileWalkthroughProvider");
  return resolved;
}
