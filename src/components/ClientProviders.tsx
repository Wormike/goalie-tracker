"use client";

import { ReactNode, useEffect, useState } from "react";
import { CompetitionProvider } from "@/contexts/CompetitionContext";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { runMigrations } from "@/lib/migration";

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for Next.js app router
 * All context providers that need client-side state should be added here
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  const [migrationComplete, setMigrationComplete] = useState(false);

  // Run migrations before rendering the app
  useEffect(() => {
    runMigrations();
    setMigrationComplete(true);
  }, []);

  // Wait for migrations to complete before rendering
  if (!migrationComplete) {
    return null; // Or a loading spinner
  }

  return (
    <CompetitionProvider>
      {/* Onboarding wizard shows automatically when no competitions exist */}
      <OnboardingWizard />
      {children}
    </CompetitionProvider>
  );
}

