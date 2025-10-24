"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type GeneratedImage = {
  url: string;
  createdAt: number;
  prompt: string;
  sourceImage: string;
  modelId: string;
  negativePrompt: string | null;
  guidanceScale: number;
  strength: number;
  inferenceSteps: number;
  seed: string | null;
};

type GeneratedImagesContextValue = {
  results: GeneratedImage[];
  setResults: Dispatch<SetStateAction<GeneratedImage[]>>;
  clearResults: () => void;
};

const GeneratedImagesContext =
  createContext<GeneratedImagesContextValue | null>(null);

const STORAGE_KEY = "generated-images-history";

export function GeneratedImagesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return;
      }

      const sanitized = parsed.filter(isGeneratedImageCandidate);
      if (sanitized.length > 0) {
        setResults(sanitized);
      }
    } catch (error) {
      console.warn("Failed to read stored generated images", error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") {
      return;
    }

    try {
      if (results.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (error) {
      console.warn("Failed to persist generated images", error);
    }
  }, [results, isInitialized]);

  const clearResults = useCallback(() => {
    setResults([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<GeneratedImagesContextValue>(
    () => ({
      results,
      setResults,
      clearResults,
    }),
    [results, clearResults],
  );

  return (
    <GeneratedImagesContext.Provider value={value}>
      {children}
    </GeneratedImagesContext.Provider>
  );
}

export function useGeneratedImages() {
  const context = useContext(GeneratedImagesContext);
  if (!context) {
    throw new Error(
      "useGeneratedImages must be used within a GeneratedImagesProvider",
    );
  }
  return context;
}

function isGeneratedImageCandidate(value: unknown): value is GeneratedImage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.url === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.sourceImage === "string" &&
    typeof candidate.modelId === "string" &&
    typeof candidate.guidanceScale === "number" &&
    typeof candidate.strength === "number" &&
    typeof candidate.inferenceSteps === "number" &&
    ("negativePrompt" in candidate
      ? candidate.negativePrompt === null ||
        typeof candidate.negativePrompt === "string"
      : true) &&
    ("seed" in candidate
      ? candidate.seed === null || typeof candidate.seed === "string"
      : true)
  );
}
