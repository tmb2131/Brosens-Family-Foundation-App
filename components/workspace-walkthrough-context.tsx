"use client";

import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

type StartWalkthrough = () => void;

type WorkspaceWalkthroughContextValue = {
  registerStartWalkthrough: (fn: StartWalkthrough) => void;
  startWalkthrough: () => void;
};

const WorkspaceWalkthroughContext = createContext<WorkspaceWalkthroughContextValue | null>(null);

export function WorkspaceWalkthroughProvider({ children }: PropsWithChildren) {
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

  const value: WorkspaceWalkthroughContextValue = {
    registerStartWalkthrough,
    startWalkthrough
  };

  return (
    <WorkspaceWalkthroughContext.Provider value={value}>
      {children}
    </WorkspaceWalkthroughContext.Provider>
  );
}

export function useWorkspaceWalkthrough(): WorkspaceWalkthroughContextValue {
  const resolved = useContext(WorkspaceWalkthroughContext);
  if (resolved == null) throw new Error("useWorkspaceWalkthrough must be used within WorkspaceWalkthroughProvider");
  return resolved;
}
