"use client";

import { useState, useEffect } from "react";

export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  useEffect(() => {
    // Check initial orientation
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      
      // Use screen.orientation API if available
      if (window.screen?.orientation?.type) {
        const type = window.screen.orientation.type;
        setOrientation(
          type.includes("landscape") ? "landscape" : "portrait"
        );
      } else {
        // Fallback to window dimensions
        setOrientation(
          window.innerWidth > window.innerHeight ? "landscape" : "portrait"
        );
      }
    };

    checkOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      checkOrientation();
    };

    // Use screen.orientation API if available
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener(
        "change",
        handleOrientationChange
      );
    }

    // Also listen to resize as fallback
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener(
          "change",
          handleOrientationChange
        );
      }
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  return orientation;
}

// Hook to check if device is mobile (for landscape optimizations)
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === "undefined") return;
      
      // Check if touch device
      const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      
      // Check screen width (typical mobile breakpoint)
      const isSmallScreen = window.innerWidth < 768;
      
      setIsMobile(isTouchDevice && isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}



