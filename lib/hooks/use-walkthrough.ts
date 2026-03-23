"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export interface WalkthroughStep {
  target: string;
  targetFallback?: string;
  title: string;
  body: string;
}

export interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseWalkthroughOptions {
  steps: readonly WalkthroughStep[];
  /** Called when the walkthrough is closed (after state is reset). */
  onClose?: () => void;
}

export function useWalkthrough({ steps, onClose }: UseWalkthroughOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const getTargetElement = useCallback(
    (stepIndex: number): HTMLElement | null => {
      const s = steps[stepIndex];
      if (!s) return null;
      const primary = document.querySelector<HTMLElement>(`[data-walkthrough="${s.target}"]`);
      const fallback = s.targetFallback
        ? document.querySelector<HTMLElement>(`[data-walkthrough="${s.targetFallback}"]`)
        : null;
      const hasSize = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      if (primary && hasSize(primary)) return primary;
      if (fallback && hasSize(fallback)) return fallback;
      return primary ?? fallback ?? null;
    },
    [steps]
  );

  const measureAndSetRect = useCallback(
    (stepIndex: number) => {
      const el = getTargetElement(stepIndex);
      if (el) {
        const r = el.getBoundingClientRect();
        setSpotlightRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        setSpotlightRect(null);
      }
    },
    [getTargetElement]
  );

  const open = useCallback(() => {
    setStep(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setStep(0);
    setSpotlightRect(null);
    onClose?.();
  }, [onClose]);

  // Scroll to target + measure rect on step change
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = getTargetElement(step);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
    measureAndSetRect(step);
    const t1 = setTimeout(() => measureAndSetRect(step), 50);
    const t2 = setTimeout(() => measureAndSetRect(step), 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, step, getTargetElement, measureAndSetRect]);

  // Re-measure on resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => measureAndSetRect(step);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, step, measureAndSetRect]);

  return {
    isOpen,
    step,
    setStep,
    spotlightRect,
    totalSteps: steps.length,
    currentStep: steps[step] ?? null,
    isFirst: step === 0,
    isLast: step === steps.length - 1,
    open,
    close,
    next: useCallback(() => setStep((s) => s + 1), []),
    back: useCallback(() => setStep((s) => s - 1), []),
  } as const;
}
