"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  isPersisted?: boolean;
  blobPath?: string | null;
  blobUrl?: string | null;
  metadataUrl?: string | null;
  projectCode?: string | null;
  sourceBlobPath?: string | null;
  sourceBlobUrl?: string | null;
  sessionId?: string | null;
};

type GeneratedImagesContextValue = {
  results: GeneratedImage[];
  setResults: Dispatch<SetStateAction<GeneratedImage[]>>;
  clearResults: () => void;
  projectCode: string;
  setProjectCode: (value: string) => void;
  regenerateProjectCode: () => string;
  sessionId: string;
  regenerateSessionId: () => string;
};

const GeneratedImagesContext =
  createContext<GeneratedImagesContextValue | null>(null);

const STORAGE_KEY = "generated-images-history";
const STORAGE_CODE_KEY = "generated-images-project-code";
const STORAGE_SESSION_KEY = "generated-images-session-id";

const CODE_PREFIX = "HS";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateProjectCode(): string {
  const randomSegment = Array.from({ length: 8 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${CODE_PREFIX}-${month}${day}-${randomSegment}`;
}

function generateSessionId(): string {
  const timeComponent = Date.now().toString(36);
  const randomComponent = Array.from({ length: 6 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");
  return `${timeComponent}-${randomComponent}`.toLowerCase();
}

export function GeneratedImagesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [projectCode, setProjectCodeState] = useState<string>("");
  const hasLoadedProjectCode = useRef(false);
  const [sessionId, setSessionIdState] = useState<string>("");
  const hasLoadedSession = useRef(false);

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

  useEffect(() => {
    if (typeof window === "undefined" || hasLoadedProjectCode.current) {
      return;
    }

    hasLoadedProjectCode.current = true;

    try {
      const stored = window.localStorage.getItem(STORAGE_CODE_KEY)?.trim();
      if (stored) {
        setProjectCodeState(stored);
      } else {
        const generated = generateProjectCode();
        setProjectCodeState(generated);
        window.localStorage.setItem(STORAGE_CODE_KEY, generated);
      }
    } catch (error) {
      console.warn("Failed to load project code", error);
      const generated = generateProjectCode();
      setProjectCodeState(generated);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedProjectCode.current) {
      return;
    }

    const trimmed = projectCode.trim();
    if (!trimmed) {
      const generated = generateProjectCode();
      setProjectCodeState(generated);
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_CODE_KEY, trimmed);
    } catch (error) {
      console.warn("Failed to persist project code", error);
    }
  }, [projectCode]);

  useEffect(() => {
    if (typeof window === "undefined" || hasLoadedSession.current) {
      return;
    }

    hasLoadedSession.current = true;

    try {
      const stored = window.localStorage.getItem(STORAGE_SESSION_KEY)?.trim();
      if (stored) {
        setSessionIdState(stored);
      } else {
        const generated = generateSessionId();
        setSessionIdState(generated);
        window.localStorage.setItem(STORAGE_SESSION_KEY, generated);
      }
    } catch (error) {
      console.warn("Failed to load generation session id", error);
      const generated = generateSessionId();
      setSessionIdState(generated);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedSession.current) {
      return;
    }

    const trimmed = sessionId.trim();
    if (!trimmed) {
      const generated = generateSessionId();
      setSessionIdState(generated);
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_SESSION_KEY, trimmed);
    } catch (error) {
      console.warn("Failed to persist generation session id", error);
    }
  }, [sessionId]);

  const clearResults = useCallback(() => {
    setResults([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setProjectCode = useCallback((value: string) => {
    setProjectCodeState(value.trim());
  }, []);

  const regenerateProjectCode = useCallback(() => {
    const next = generateProjectCode();
    setProjectCodeState(next);
    setSessionIdState(generateSessionId());
    return next;
  }, []);

  const regenerateSessionId = useCallback(() => {
    const next = generateSessionId();
    setSessionIdState(next);
    return next;
  }, []);

  const value = useMemo<GeneratedImagesContextValue>(
    () => ({
      results,
      setResults,
      clearResults,
      projectCode,
      setProjectCode,
      regenerateProjectCode,
      sessionId,
      regenerateSessionId,
    }),
    [
      results,
      clearResults,
      projectCode,
      setProjectCode,
      regenerateProjectCode,
      sessionId,
      regenerateSessionId,
    ],
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

  const hasRequiredBasics =
    typeof candidate.url === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.sourceImage === "string" &&
    typeof candidate.modelId === "string" &&
    typeof candidate.guidanceScale === "number" &&
    typeof candidate.strength === "number" &&
    typeof candidate.inferenceSteps === "number";

  if (!hasRequiredBasics) {
    return false;
  }

  const negativePrompt = candidate.negativePrompt;
  const seed = candidate.seed;

  if (
    negativePrompt !== undefined &&
    negativePrompt !== null &&
    typeof negativePrompt !== "string"
  ) {
    return false;
  }

  if (seed !== undefined && seed !== null && typeof seed !== "string") {
    return false;
  }

  return true;
}
