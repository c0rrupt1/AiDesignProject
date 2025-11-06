"use client";
/* eslint-disable @next/next/no-img-element */

import {
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GeneratedImagesProvider, useGeneratedImages } from "@/components/providers/GeneratedImagesProvider";
import type { GeneratedImage } from "@/components/providers/GeneratedImagesProvider";
import { ProjectCodePanel } from "@/components/project/ProjectCodePanel";
import { HeroSection } from "@/components/workspace/HeroSection";
import { promptTemplates } from "@/components/workspace/promptTemplates";
import {
  clamp01,
  cropImageToDataUrl,
  dataUrlToFile,
  fileToDataUrl,
} from "@/components/workspace/utils";
import { fetchJson, HttpError } from "@/lib/http";


type KeywordTarget = "original" | number;

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ShoppingResult = {
  title: string;
  link: string;
  source: string | null;
  price: string | null;
  extractedPrice: number | null;
  thumbnail: string | null;
  shipping: string | null;
  position: number | null;
  clipScore: number | null;
};

type ClipScoreResponse = {
  url: string;
  score: number;
};

const defaultModelId =
  process.env.NEXT_PUBLIC_OPENROUTER_IMAGE_MODEL ??
  "google/gemini-2.5-flash-image-preview";

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

type EditBlobSummary = {
  pathname: string;
  url: string;
  downloadUrl: string | null;
  contentType: string | null;
};

type EditResponse = {
  image?: string;
  blobs?: {
    sessionPath: string;
    input?: EditBlobSummary | null;
    mask?: EditBlobSummary | null;
    output?: EditBlobSummary | null;
    metadata?: EditBlobSummary | null;
    details?: Record<string, unknown> | null;
  } | null;
};

export default function WorkspacePage() {
  return (
    <GeneratedImagesProvider>
      <WorkspacePageInner />
    </GeneratedImagesProvider>
  );
}

function WorkspacePageInner() {
  const {
    results,
    setResults,
    projectCode,
    sessionId,
    regenerateSessionId,
  } = useGeneratedImages();
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [strength, setStrength] = useState(0.35);
  const [inferenceSteps, setInferenceSteps] = useState(35);
  const [seed, setSeed] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [keywordTarget, setKeywordTarget] =
    useState<KeywordTarget>("original");
  const [shoppingKeywords, setShoppingKeywords] = useState("");
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [isKeywordsLoading, setIsKeywordsLoading] = useState(false);
  const [rawShoppingResults, setRawShoppingResults] = useState<ShoppingResult[]>([]);
  const [shoppingResults, setShoppingResults] = useState<ShoppingResult[]>([]);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [isShoppingLoading, setIsShoppingLoading] = useState(false);
  const [isClipRanking, setIsClipRanking] = useState(false);
  const [lastShoppingKeywords, setLastShoppingKeywords] = useState<
    string | null
  >(null);
  const [lastClipReference, setLastClipReference] = useState<string | null>(
    null,
  );
  const [clipThreshold, setClipThreshold] = useState(0.2);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [drawMode, setDrawMode] = useState<"paint" | "erase">("paint");
  const [brushSize, setBrushSize] = useState(40);
  const [hasMask, setHasMask] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [insertImageFile, setInsertImageFile] = useState<File | null>(null);
  const [insertPreviewUrl, setInsertPreviewUrl] = useState<string | null>(null);
  const [insertImageDimensions, setInsertImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [insertRect, setInsertRect] = useState<CropRect | null>(null);
  const [isDraggingInsert, setIsDraggingInsert] = useState(false);
  const [reeditTargetId, setReeditTargetId] = useState<number | null>(null);
  const [comparisonPositions, setComparisonPositions] = useState<Record<number, number>>({});
  const [activeRedoId, setActiveRedoId] = useState<number | null>(null);
  const [redoNotes, setRedoNotes] = useState<Record<number, string>>({});
  const [smartRedoTargetId, setSmartRedoTargetId] = useState<number | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskStageRef = useRef<HTMLDivElement | null>(null);
  const cropOverlayRef = useRef<HTMLDivElement | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const insertDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const editControllerRef = useRef<AbortController | null>(null);
  const keywordsControllerRef = useRef<AbortController | null>(null);
  const shoppingControllerRef = useRef<AbortController | null>(null);
  const clipControllerRef = useRef<AbortController | null>(null);
  const smartRedoControllerRef = useRef<AbortController | null>(null);
  const normalizedProjectCode = projectCode.trim();
  const normalizedSessionId = sessionId.trim();
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      editControllerRef.current?.abort();
      keywordsControllerRef.current?.abort();
      shoppingControllerRef.current?.abort();
      clipControllerRef.current?.abort();
      smartRedoControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!imageFile || !canvas) {
      setImageDimensions(null);
      setHasMask(false);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 1024;
      setImageDimensions({ width, height });

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
      }
      setHasMask(false);
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }, [imageFile]);

  useEffect(() => {
    if (!insertImageFile) {
      setInsertPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setInsertImageDimensions(null);
      setInsertRect(null);
      return;
    }

    const objectUrl = URL.createObjectURL(insertImageFile);
    setInsertPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });

    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 512;
      const height = img.naturalHeight || 512;
      setInsertImageDimensions({ width, height });
      const aspectRatio = height / width || 1;
      let initialWidth = 0.3;
      let initialHeight = initialWidth * aspectRatio;
      if (initialHeight > 0.6) {
        initialHeight = 0.6;
        initialWidth = initialHeight / aspectRatio;
      }
      if (initialWidth > 0.9) {
        initialWidth = 0.9;
        initialHeight = initialWidth * aspectRatio;
      }
      setInsertRect({
        x: clamp01(0.5 - initialWidth / 2),
        y: clamp01(0.65 - initialHeight / 2),
        width: initialWidth,
        height: initialHeight,
      });
    };
    img.onerror = () => {
      setErrorMessage(
        "We couldn't read that reference object. Try a different image file.",
      );
      setInsertImageFile(null);
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [insertImageFile]);

  useEffect(() => {
    if (keywordTarget === "original") {
      if (!previewUrl && results.length > 0) {
        setKeywordTarget(results[0].createdAt);
      }
      setRawShoppingResults([]);
      setShoppingResults([]);
      setLastShoppingKeywords(null);
      setShoppingError(null);
      setLastClipReference(null);
      return;
    }

    const exists = results.some(
      (item) => item.createdAt === keywordTarget,
    );

    if (!exists) {
      if (results.length > 0) {
        setKeywordTarget(results[0].createdAt);
      } else if (previewUrl) {
        setKeywordTarget("original");
      } else {
        setKeywordTarget("original");
      }
    }
    setRawShoppingResults([]);
    setShoppingResults([]);
    setLastShoppingKeywords(null);
    setShoppingError(null);
    setLastClipReference(null);
  }, [keywordTarget, results, previewUrl]);


  const keywordImageUrl = useMemo(() => {
    if (keywordTarget === "original") {
      return previewUrl ?? null;
    }
    const match = results.find((item) => item.createdAt === keywordTarget);
    return match?.url ?? null;
  }, [keywordTarget, previewUrl, results]);

  const keywordSourceLabel = useMemo(() => {
    if (keywordTarget === "original") {
      return imageFile ? "Original photo upload" : undefined;
    }
    const match = results.find((item) => item.createdAt === keywordTarget);
    if (!match) return undefined;
    return `AI makeover generated from prompt: ${match.prompt}`;
  }, [keywordTarget, results, imageFile]);

  const keywordAspectRatio = useMemo(() => {
    if (keywordTarget === "original" && imageDimensions) {
      return `${imageDimensions.width} / ${imageDimensions.height}`;
    }
    return "1 / 1";
  }, [keywordTarget, imageDimensions]);

  const keywordSelectDisabled = useMemo(
    () => !previewUrl && results.length === 0,
    [previewUrl, results],
  );

  const normalizedShoppingKeywords = shoppingKeywords.trim();

  const shoppingSearchDisabled =
    isShoppingLoading ||
    isClipRanking ||
    !keywordImageUrl ||
    !normalizedShoppingKeywords ||
    normalizedShoppingKeywords === lastShoppingKeywords;

  const filteredShoppingResults = useMemo(() => {
    if (shoppingResults.length === 0) return [];
    return shoppingResults.filter((item) => {
      if (typeof item.clipScore !== "number") return clipThreshold <= 0;
      return item.clipScore >= clipThreshold;
    });
  }, [shoppingResults, clipThreshold]);

  const onBaseImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setPreviewUrl(null);
      setImageDimensions(null);
      setHasMask(false);
      removeInsertImage();
      return;
    }

    setImageFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

  const onInsertImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      removeInsertImage();
      event.target.value = "";
      return;
    }
    setInsertImageFile(file);
    event.target.value = "";
  };

  const drawStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const color = drawMode === "paint" ? "white" : "black";

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";

    const lastPoint = lastPointRef.current;
    ctx.beginPath();
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
    } else {
      ctx.moveTo(x, y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };

    if (drawMode === "paint") {
      setHasMask(true);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!maskCanvasRef.current || !imageDimensions) return;
    maskCanvasRef.current.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    drawStroke(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawStroke(event);
  };

  const stopDrawing = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event && maskCanvasRef.current?.hasPointerCapture(event.pointerId)) {
      maskCanvasRef.current.releasePointerCapture(event.pointerId);
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
    lastPointRef.current = null;
  };

  const applyTemplate = (template: (typeof promptTemplates)[number]) => {
    setPrompt(template.prompt);
    setNegativePrompt(template.negativePrompt ?? "");
    setGuidanceScale(template.guidanceScale);
    setStrength(template.strength);
    setInferenceSteps(template.inferenceSteps);
    setShowAdvanced(true);
  };

  const removeInsertImage = () => {
    setInsertImageFile(null);
    setInsertImageDimensions(null);
    setInsertRect(null);
    setInsertPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    insertDragOffsetRef.current = null;
    setIsDraggingInsert(false);
  };

  const updateInsertSize = (normalizedWidth: number) => {
    if (!insertImageDimensions || !insertRect) return;
    const aspectRatio =
      insertImageDimensions.height / insertImageDimensions.width || 1;
    let width = Math.min(Math.max(normalizedWidth, 0.05), 0.9);
    let height = width * aspectRatio;
    if (height > 0.95) {
      height = 0.95;
      width = Math.min(0.9, Math.max(0.05, height / aspectRatio));
      height = width * aspectRatio;
    }
    width = Math.min(Math.max(width, 0.05), 0.9);
    height = Math.min(Math.max(height, 0.05), 0.95);

    setInsertRect((current) => {
      if (!current) return current;
      let nextX = current.x;
      let nextY = current.y;
      if (nextX + width > 1) {
        nextX = clamp01(1 - width);
      }
      if (nextY + height > 1) {
        nextY = clamp01(1 - height);
      }
      return {
        ...current,
        x: nextX,
        y: nextY,
        width,
        height,
      };
    });
  };

  const beginInsertDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!insertRect) return;
    event.preventDefault();
    event.stopPropagation();
    stopDrawing();
    const stage = maskStageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const pointerX = clamp01((event.clientX - bounds.left) / bounds.width);
    const pointerY = clamp01((event.clientY - bounds.top) / bounds.height);
    insertDragOffsetRef.current = {
      x: pointerX - insertRect.x,
      y: pointerY - insertRect.y,
    };
    setIsDraggingInsert(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateInsertDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingInsert || !insertRect) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = maskStageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const pointerX = clamp01((event.clientX - bounds.left) / bounds.width);
    const pointerY = clamp01((event.clientY - bounds.top) / bounds.height);
    const offset =
      insertDragOffsetRef.current ?? {
        x: insertRect.width / 2,
        y: insertRect.height / 2,
      };
    let nextX = pointerX - offset.x;
    let nextY = pointerY - offset.y;
    nextX = clamp01(Math.min(nextX, 1 - insertRect.width));
    nextY = clamp01(Math.min(nextY, 1 - insertRect.height));
    setInsertRect((current) => {
      if (!current) return current;
      return {
        ...current,
        x: nextX,
        y: nextY,
      };
    });
  };

  const finishInsertDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    insertDragOffsetRef.current = null;
    setIsDraggingInsert(false);
  };

  const reuseGeneratedImage = async (result: GeneratedImage) => {
    try {
      stopDrawing();
      setErrorMessage(null);
      removeInsertImage();
      setReeditTargetId(result.createdAt);

      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(
          `Unable to load that makeover for re-editing (HTTP ${response.status}).`,
        );
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("The selected makeover returned an empty image.");
      }

      const mimeType =
        blob.type && blob.type !== "application/octet-stream"
          ? blob.type
          : "image/png";
      const extension =
        mimeType.split("/")[1]?.split("+")[0]?.replace(/[^a-z0-9_-]/gi, "") ??
        "png";
      const filename = `makeover-${result.createdAt}.${extension || "png"}`;
      const file = new File([blob], filename, { type: mimeType });

      setImageFile(file);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      setPrompt(result.prompt);
      setNegativePrompt(result.negativePrompt ?? "");
      setGuidanceScale(result.guidanceScale);
      setStrength(result.strength);
      setInferenceSteps(result.inferenceSteps);
      setSeed(result.seed ?? "");
      setKeywordTarget("original");
      setShoppingKeywords("");
      setKeywordsError(null);
      setShoppingError(null);
      setShoppingResults([]);
      setRawShoppingResults([]);
      setLastShoppingKeywords(null);
      setLastClipReference(null);
      setCropRect(null);
      setIsKeywordsLoading(false);
      setIsShoppingLoading(false);
      setIsClipRanking(false);
      setHasMask(false);

      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reuse that makeover as a starting point. Try downloading and re-uploading it manually.",
      );
    } finally {
      setReeditTargetId(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!imageFile) {
      setErrorMessage("Please choose a photo of your space to transform.");
      return;
    }

    if (!prompt.trim()) {
      setErrorMessage("Describe how you want the space to look.");
      return;
    }

    const activeSessionId = normalizedSessionId || regenerateSessionId();
    const baseImageDataUrl = await fileToDataUrl(imageFile);
    const trimmedNegativePrompt = negativePrompt.trim();
    const trimmedSeed = seed.trim();

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", imageFile);
    formData.append("guidanceScale", guidanceScale.toString());
    formData.append("strength", strength.toString());
    formData.append("inferenceSteps", inferenceSteps.toString());
    formData.append("persistToBlob", "true");
    if (normalizedProjectCode) {
      formData.append("projectCode", normalizedProjectCode);
    }
    if (activeSessionId) {
      formData.append("sessionId", activeSessionId);
    }
    if (trimmedNegativePrompt) {
      formData.append("negativePrompt", trimmedNegativePrompt);
    }
    if (trimmedSeed) {
      formData.append("seed", trimmedSeed);
    }
    let maskBlob: Blob | null = null;
    if (hasMask && maskCanvasRef.current) {
      const canvas = maskCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let hasPaintedPixels = false;
          for (let index = 0; index < data.length; index += 4) {
            if (data[index] > 0) {
              hasPaintedPixels = true;
              break;
            }
          }

          if (hasPaintedPixels) {
            maskBlob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(
                (blob) => resolve(blob),
                "image/png",
                1,
              );
            });
          } else {
            setHasMask(false);
          }
        } catch (error) {
          console.error("Failed to inspect the mask canvas before upload.", error);
        }
      }
    }

    if (
      !maskBlob &&
      insertRect &&
      imageDimensions &&
      insertRect.width > 0 &&
      insertRect.height > 0
    ) {
      try {
        const syntheticCanvas = document.createElement("canvas");
        syntheticCanvas.width = imageDimensions.width;
        syntheticCanvas.height = imageDimensions.height;
        const syntheticContext = syntheticCanvas.getContext("2d");
        if (syntheticContext) {
          syntheticContext.fillStyle = "black";
          syntheticContext.fillRect(
            0,
            0,
            syntheticCanvas.width,
            syntheticCanvas.height,
          );
          syntheticContext.fillStyle = "white";
          syntheticContext.fillRect(
            insertRect.x * syntheticCanvas.width,
            insertRect.y * syntheticCanvas.height,
            insertRect.width * syntheticCanvas.width,
            insertRect.height * syntheticCanvas.height,
          );
          maskBlob = await new Promise<Blob | null>((resolve) => {
            syntheticCanvas.toBlob(
              (blob) => resolve(blob),
              "image/png",
              1,
            );
          });
        }
      } catch (error) {
        console.error("Failed to generate a placement mask for submission.", error);
      }
    }

    if (maskBlob) {
      formData.append(
        "mask",
        new File([maskBlob], "mask.png", { type: "image/png" }),
      );
    }

    if (insertImageFile && insertRect) {
      formData.append("insertImage", insertImageFile);
      formData.append("insertX", insertRect.x.toString());
      formData.append("insertY", insertRect.y.toString());
      formData.append("insertWidth", insertRect.width.toString());
      formData.append("insertHeight", insertRect.height.toString());
    }

    setIsLoading(true);
    const controller = new AbortController();
    editControllerRef.current?.abort();
    editControllerRef.current = controller;

    try {
      const payload = await fetchJson<EditResponse>(
        "/api/edit",
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        },
      );

      const imageData = payload?.image;
      const blobs = payload?.blobs ?? null;
      const blobDetails =
        blobs && typeof blobs.details === "object" && blobs.details !== null
          ? (blobs.details as Record<string, unknown>)
          : null;
      const persistedProjectCode =
        blobDetails && typeof blobDetails.projectCode === "string"
          ? blobDetails.projectCode
          : normalizedProjectCode || null;
      const persistedSessionId =
        blobDetails && typeof blobDetails.sessionId === "string"
          ? blobDetails.sessionId
          : activeSessionId || null;

      if (!imageData) {
        throw new Error("The AI service returned an unexpected response.");
      }

      const createdAt = Date.now();
      const newResult: GeneratedImage = {
        url: imageData,
        createdAt,
        prompt,
        sourceImage: baseImageDataUrl,
        modelId: defaultModelId,
        negativePrompt: trimmedNegativePrompt || null,
        guidanceScale,
        strength,
        inferenceSteps,
        seed: trimmedSeed || null,
        projectCode: persistedProjectCode,
        sessionId: persistedSessionId,
        isPersisted: Boolean(blobs?.output),
        blobPath: blobs?.output?.pathname ?? null,
        blobUrl: blobs?.output?.url ?? null,
        metadataUrl:
          blobs?.metadata?.url ??
          blobs?.metadata?.downloadUrl ??
          null,
        sourceBlobPath: blobs?.input?.pathname ?? null,
        sourceBlobUrl: blobs?.input?.url ?? null,
      };

      setResults((history) => [newResult, ...history]);
      setComparisonPositions((positions) => ({
        ...positions,
        [createdAt]: 50,
      }));
      setRedoNotes((notes) => ({
        ...notes,
        [createdAt]: "",
      }));
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error(error);
      setErrorMessage(
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong while editing the photo.",
      );
    } finally {
      if (editControllerRef.current === controller) {
        editControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const maskModeButtonClass = (mode: "paint" | "erase") =>
    `px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition ${
      drawMode === mode
        ? "bg-amber-400 text-slate-950"
        : "bg-transparent text-slate-300 hover:bg-white/10"
    }`;

  const toggleSmartRedo = (resultId: number) => {
    setActiveRedoId((current) => (current === resultId ? null : resultId));
    setSmartRedoTargetId(null);
  };

  const handleSmartRedo = async (result: GeneratedImage) => {
    const feedback = (redoNotes[result.createdAt] ?? "").trim();
    if (!feedback) {
      setErrorMessage("Add a quick note about what to change before running Smart Redo.");
      setActiveRedoId(result.createdAt);
      return;
    }

    setErrorMessage(null);
    setSmartRedoTargetId(result.createdAt);
    const resultModelId = result.modelId || defaultModelId;
    const baseFile = dataUrlToFile(
      result.sourceImage,
      `smart-redo-base-${result.createdAt}.png`,
    );

    const refinedPrompt = `${result.prompt.trim()}
\nAdjust based on this feedback: ${feedback}`.trim();
    const formData = new FormData();
    formData.append("prompt", refinedPrompt);
    formData.append("image", baseFile);
    formData.append("guidanceScale", result.guidanceScale.toString());
    formData.append("strength", result.strength.toString());
    formData.append("inferenceSteps", result.inferenceSteps.toString());
    formData.append("persistToBlob", "true");
    const redoSessionId = result.sessionId && result.sessionId.trim()
      ? result.sessionId.trim()
      : normalizedSessionId || regenerateSessionId();
    if (result.projectCode && result.projectCode.trim()) {
      formData.append("projectCode", result.projectCode.trim());
    } else if (normalizedProjectCode) {
      formData.append("projectCode", normalizedProjectCode);
    }
    if (redoSessionId) {
      formData.append("sessionId", redoSessionId);
    }
    if (result.negativePrompt) {
      formData.append("negativePrompt", result.negativePrompt);
    }
    if (result.seed && result.seed.trim()) {
      formData.append("seed", result.seed.trim());
    }

    const controller = new AbortController();
    smartRedoControllerRef.current?.abort();
    smartRedoControllerRef.current = controller;

    try {
      const payload = await fetchJson<EditResponse>(
        "/api/edit",
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        },
      );

      const imageData = payload?.image;
      const blobs = payload?.blobs ?? null;
      const blobDetails =
        blobs && typeof blobs.details === "object" && blobs.details !== null
          ? (blobs.details as Record<string, unknown>)
          : null;
      const persistedProjectCode =
        blobDetails && typeof blobDetails.projectCode === "string"
          ? blobDetails.projectCode
          : result.projectCode && result.projectCode.trim()
            ? result.projectCode.trim()
            : normalizedProjectCode || null;
      const persistedSessionId =
        blobDetails && typeof blobDetails.sessionId === "string"
          ? blobDetails.sessionId
          : redoSessionId || null;
      if (!imageData) {
        throw new Error("The AI service returned an unexpected response.");
      }

      const createdAt = Date.now();
      const newResult: GeneratedImage = {
        url: imageData,
        createdAt,
        prompt: refinedPrompt,
        sourceImage: result.sourceImage,
        modelId: resultModelId,
        negativePrompt: result.negativePrompt,
        guidanceScale: result.guidanceScale,
        strength: result.strength,
        inferenceSteps: result.inferenceSteps,
        seed: result.seed,
        projectCode: persistedProjectCode,
        sessionId: persistedSessionId,
        isPersisted: Boolean(blobs?.output),
        blobPath: blobs?.output?.pathname ?? null,
        blobUrl: blobs?.output?.url ?? null,
        metadataUrl:
          blobs?.metadata?.url ??
          blobs?.metadata?.downloadUrl ??
          null,
        sourceBlobPath: blobs?.input?.pathname ?? result.sourceBlobPath ?? null,
        sourceBlobUrl: blobs?.input?.url ?? result.sourceBlobUrl ?? null,
      };

      setResults((history) => [newResult, ...history]);
      setComparisonPositions((positions) => ({
        ...positions,
        [createdAt]: 50,
      }));
      setRedoNotes((notes) => ({
        ...notes,
        [createdAt]: "",
      }));
      setActiveRedoId(null);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error(error);
      setErrorMessage(
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong while re-running the makeover.",
      );
    } finally {
      if (smartRedoControllerRef.current === controller) {
        smartRedoControllerRef.current = null;
      }
      setSmartRedoTargetId(null);
    }
  };

  const handleKeywordTargetChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    setShoppingKeywords("");
    setKeywordsError(null);
    setShoppingError(null);
    setCropRect(null);
    setShoppingResults([]);
    setLastShoppingKeywords(null);
    if (value === "original") {
      setKeywordTarget("original");
    } else {
      setKeywordTarget(Number(value) as KeywordTarget);
    }
  };

  const clearCropSelection = () => {
    setCropRect(null);
  };

  const beginCropSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropOverlayRef.current) return;
    const rect = cropOverlayRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);

    cropOverlayRef.current.setPointerCapture(event.pointerId);
    cropStartRef.current = { x, y };
    setCropRect({ x, y, width: 0, height: 0 });
    setIsCropping(true);
  };

  const updateCropSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStartRef.current || !cropOverlayRef.current) {
      return;
    }
    const rect = cropOverlayRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const currentX = clamp01((event.clientX - rect.left) / rect.width);
    const currentY = clamp01((event.clientY - rect.top) / rect.height);
    const start = cropStartRef.current;

    const left = Math.min(start.x, currentX);
    const top = Math.min(start.y, currentY);
    const width = Math.abs(currentX - start.x);
    const height = Math.abs(currentY - start.y);

    setCropRect({ x: left, y: top, width, height });
  };

  const finishCropSelection = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && cropOverlayRef.current?.hasPointerCapture(event.pointerId)) {
      cropOverlayRef.current.releasePointerCapture(event.pointerId);
    }
    setIsCropping(false);
    cropStartRef.current = null;
    setCropRect((rect) => {
      if (!rect) return null;
      if (rect.width < 0.01 || rect.height < 0.01) return null;
      const width = clamp01(rect.width);
      const height = clamp01(rect.height);
      const x = clamp01(rect.x);
      const y = clamp01(rect.y);
      const adjustedWidth = Math.min(width, 1 - x);
      const adjustedHeight = Math.min(height, 1 - y);
      return {
        x,
        y,
        width: adjustedWidth,
        height: adjustedHeight,
      };
    });
  };

  const generateShoppingKeywords = async () => {
    setKeywordsError(null);
    setShoppingError(null);
    setShoppingResults([]);
    setLastShoppingKeywords(null);

    if (!keywordImageUrl) {
      setKeywordsError(
        "Select the original photo or a generated makeover before requesting keywords.",
      );
      return;
    }

    let controller: AbortController | null = null;
    try {
      setIsKeywordsLoading(true);
      setShoppingKeywords("");
      const dataUrl = await cropImageToDataUrl(keywordImageUrl, cropRect);
      setLastClipReference(dataUrl);

      controller = new AbortController();
      keywordsControllerRef.current?.abort();
      keywordsControllerRef.current = controller;

      const payload = await fetchJson<{ keywords?: string }>(
        "/api/keywords",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            sourceLabel: keywordSourceLabel,
          }),
          signal: controller.signal,
        },
      );

      const text = payload?.keywords;
      if (!text || !text.trim()) {
        setShoppingKeywords("");
        setKeywordsError(
          "The AI did not return any shopping keywords. Try a different crop or image.",
        );
        return;
      }

      setShoppingKeywords(text.trim());
      setShoppingResults([]);
      setLastShoppingKeywords(null);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error(error);
      setShoppingKeywords("");
      setKeywordsError(
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong while requesting shopping keywords.",
      );
    } finally {
      if (keywordsControllerRef.current === controller) {
        keywordsControllerRef.current = null;
      }
      setIsKeywordsLoading(false);
    }
  };

  const computeClipRanking = async (
    referenceDataUrl: string,
    baseResults: ShoppingResult[],
    signal?: AbortSignal,
  ): Promise<ShoppingResult[]> => {
    const candidates = Array.from(
      new Set(
        baseResults
          .map((item) => item.thumbnail?.trim())
          .filter((url): url is string => typeof url === "string" && url.length > 0),
      ),
    );

    if (candidates.length === 0) {
      return baseResults;
    }

    const payload = await fetchJson<{
      results?: Array<{ url?: string; score?: number }>;
    }>("/api/clip-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceImage: referenceDataUrl,
        candidateImages: candidates,
        limit: candidates.length,
      }),
      signal,
    });

    const results: ClipScoreResponse[] = Array.isArray(payload?.results)
      ? payload.results
          .map((entry) => {
            if (!entry) return null;
            const url = typeof entry.url === "string" ? entry.url : null;
            const score = typeof entry.score === "number" ? entry.score : null;
            if (!url || typeof score !== "number") return null;
            return { url, score };
          })
          .filter((item): item is ClipScoreResponse => item !== null)
      : [];

    const scoreMap = new Map<string, number>();
    results.forEach(({ url, score }) => {
      scoreMap.set(url, score);
    });

    const ranked = baseResults.map((item) => {
      const score = item.thumbnail ? scoreMap.get(item.thumbnail) ?? null : null;
      return {
        ...item,
        clipScore: score,
      };
    });

    ranked.sort((a, b) => {
      const aScore =
        typeof a.clipScore === "number"
          ? a.clipScore
          : Number.NEGATIVE_INFINITY;
      const bScore =
        typeof b.clipScore === "number"
          ? b.clipScore
          : Number.NEGATIVE_INFINITY;
      if (aScore === bScore) {
        return (a.position ?? Number.POSITIVE_INFINITY) -
          (b.position ?? Number.POSITIVE_INFINITY);
      }
      return bScore - aScore;
    });

    return ranked;
  };

  const searchShoppingMatches = async () => {
    const keywords = shoppingKeywords.trim();

    if (!keywords) {
      setShoppingError("Add or generate keywords before searching.");
      return;
    }

    if (!keywordImageUrl) {
      setShoppingError(
        "Select the original photo or a generated makeover before searching.",
      );
      return;
    }

    if (lastShoppingKeywords && lastShoppingKeywords === keywords) {
      return;
    }

    setShoppingError(null);
    setIsShoppingLoading(true);
    setShoppingResults([]);
    setRawShoppingResults([]);
    setIsClipRanking(false);

    let controller: AbortController | null = null;
    let clipController: AbortController | null = null;
    try {
      controller = new AbortController();
      shoppingControllerRef.current?.abort();
      shoppingControllerRef.current = controller;

      const payload = await fetchJson<{
        results?: Array<Record<string, unknown>>;
      }>("/api/shopping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords,
          limit: 16,
        }),
        signal: controller.signal,
      });

      const rawResults = Array.isArray(payload?.results)
        ? payload.results
        : [];

      const parsedResults: ShoppingResult[] = rawResults
        .map((entry): ShoppingResult | null => {
          const title =
            typeof entry.title === "string" ? entry.title.trim() : "";
          const link =
            typeof entry.link === "string" ? entry.link.trim() : "";
          if (!title || !link) return null;
          return {
            title,
            link,
            source:
              typeof entry.source === "string" ? entry.source.trim() : null,
            price:
              typeof entry.price === "string" ? entry.price.trim() : null,
            extractedPrice:
              typeof entry.extractedPrice === "number"
                ? entry.extractedPrice
                : null,
            thumbnail:
              typeof entry.thumbnail === "string"
                ? entry.thumbnail.trim()
                : null,
            shipping:
              typeof entry.shipping === "string" ? entry.shipping : null,
            position:
              typeof entry.position === "number" ? entry.position : null,
            clipScore: null as number | null,
          };
        })
        .filter((item): item is ShoppingResult => item !== null);

      if (parsedResults.length === 0) {
        setShoppingResults([]);
        setShoppingError(
          "No shopping results were found for these keywords. Try refining them.",
        );
        setLastShoppingKeywords(keywords);
        return;
      }

      const baseResults = parsedResults.map((item) => ({
        ...item,
        clipScore: null as number | null,
      }));
      setRawShoppingResults(baseResults);

      let rankedResults = baseResults;
      try {
        const referenceDataUrl = await cropImageToDataUrl(
          keywordImageUrl,
          cropRect,
        );
        setLastClipReference(referenceDataUrl);
        setIsClipRanking(true);
        clipController = new AbortController();
        clipControllerRef.current?.abort();
        clipControllerRef.current = clipController;
        rankedResults = await computeClipRanking(
          referenceDataUrl,
          baseResults,
          clipController.signal,
        );
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error("Failed to prepare reference image for CLIP", error);
        setShoppingError(
          error instanceof HttpError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to prepare the reference image for CLIP ranking.",
        );
      }

      setShoppingResults(rankedResults);
      const firstScored = rankedResults.find(
        (item) => typeof item.clipScore === "number",
      );
      if (firstScored && typeof firstScored.clipScore === "number") {
        const suggested = Math.max(0, firstScored.clipScore - 0.05);
        setClipThreshold(
          Number.isFinite(suggested) ? Math.min(suggested, 0.9) : 0.2,
        );
      } else {
        setClipThreshold(0);
      }
      setLastShoppingKeywords(keywords);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error(error);
      setShoppingResults([]);
      setShoppingError(
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong while contacting Google Shopping.",
      );
    } finally {
      if (shoppingControllerRef.current === controller) {
        shoppingControllerRef.current = null;
      }
      if (clipControllerRef.current === clipController) {
        clipControllerRef.current = null;
      }
      setIsShoppingLoading(false);
      setIsClipRanking(false);
    }
  };

  const recomputeClipScores = async () => {
    if (rawShoppingResults.length === 0) {
      setShoppingError(
        "Run a shopping search before re-ranking with CLIP.",
      );
      return;
    }

    let controller: AbortController | null = null;
    try {
      setShoppingError(null);
      setIsClipRanking(true);
      let referenceDataUrl = lastClipReference;
      if (!referenceDataUrl) {
        if (!keywordImageUrl) {
          throw new Error(
            "Select the original photo or a generated makeover before re-ranking.",
          );
        }
        referenceDataUrl = await cropImageToDataUrl(
          keywordImageUrl,
          cropRect,
        );
        setLastClipReference(referenceDataUrl);
      }
      controller = new AbortController();
      clipControllerRef.current?.abort();
      clipControllerRef.current = controller;
      const ranked = await computeClipRanking(
        referenceDataUrl,
        rawShoppingResults,
        controller.signal,
      );
      setShoppingResults(ranked);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.error(error);
      setShoppingError(
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Something went wrong while re-ranking with CLIP.",
      );
    } finally {
      if (clipControllerRef.current === controller) {
        clipControllerRef.current = null;
      }
      setIsClipRanking(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-52 right-10 -z-10 h-[24rem] w-[24rem] rounded-full bg-amber-400/25 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-72 left-[-10rem] -z-10 h-[28rem] w-[28rem] rounded-full bg-sky-500/20 blur-[150px]" />
      <header className="relative border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/20 text-lg font-semibold text-amber-200">
              HS
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                Gemma Studio
              </p>
              <p className="text-lg font-semibold text-slate-100 md:text-xl">
                Home Stylist Workspace
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-1 font-semibold uppercase tracking-[0.4em]">
              Working Dev
            </span>
            <span className="hidden sm:block">
              Iterate freely—your progress stays on this branch.
            </span>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 md:px-10">
        <HeroSection />
        <ProjectCodePanel className="mt-10" />
        <section className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-10">
            <form
              onSubmit={onSubmit}
              className="space-y-8 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_55px_160px_-90px_rgba(15,23,42,1)] ring-1 ring-white/10 lg:p-8"
            >
              <div className="space-y-8">
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 lg:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                        Canvas
                      </p>
                      <h2 className="text-2xl font-semibold text-slate-100">
                        Upload, mask, and preview at full scale
                      </h2>
                      <p className="text-sm text-slate-400">
                        Paint focus areas and drop in optional reference objects. The preview now spans the card so you can judge scale and lighting.
                      </p>
                      {normalizedProjectCode && (
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                          Workspace code: {normalizedProjectCode}
                        </p>
                      )}
                    </div>
                    {imageFile && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {imageFile.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)] xl:items-start">
                    <label
                      className={`flex h-full min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-amber-400/60 bg-black/20 p-6 text-center text-sm transition ${
                        previewUrl ? "hover:bg-black/10" : "hover:bg-black/15"
                      }`}
                    >
                      <input
                        type="file"
                        name="image"
                        accept="image/*"
                        onChange={onBaseImageChange}
                        className="hidden"
                      />
                      <span className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
                        Room photo
                      </span>
                      <span className="text-sm font-medium text-slate-100">
                        {imageFile ? "Replace current photo" : "Upload room photo"}
                      </span>
                      <span className="max-w-[16rem] text-xs text-slate-400">
                        {imageFile ? imageFile.name : "PNG or JPG up to 12MB"}
                      </span>
                    </label>
                    {previewUrl ? (
                      <div className="space-y-4">
                        <div
                          ref={maskStageRef}
                          className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900 shadow-[0_40px_120px_-70px_rgba(15,23,42,1)]"
                          style={{
                            aspectRatio: imageDimensions
                              ? `${imageDimensions.width} / ${imageDimensions.height}`
                              : "3 / 2",
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt="Base preview"
                            className="absolute inset-0 h-full w-full object-cover"
                            draggable={false}
                          />
                          <canvas
                            ref={maskCanvasRef}
                            className="absolute inset-0 h-full w-full cursor-crosshair opacity-70 mix-blend-screen touch-none"
                            style={{ width: "100%", height: "100%" }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              handlePointerDown(event);
                            }}
                            onPointerMove={handlePointerMove}
                            onPointerUp={stopDrawing}
                            onPointerLeave={() => stopDrawing()}
                            onPointerCancel={stopDrawing}
                            onContextMenu={(event) => event.preventDefault()}
                          />
                          {insertRect && insertPreviewUrl && (
                            <div className="pointer-events-none absolute inset-0">
                              <div
                                className="absolute pointer-events-auto select-none rounded-xl border border-amber-200/80 bg-amber-300/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.3)] backdrop-blur-[1px]"
                                style={{
                                  left: `${insertRect.x * 100}%`,
                                  top: `${insertRect.y * 100}%`,
                                  width: `${insertRect.width * 100}%`,
                                  height: `${insertRect.height * 100}%`,
                                }}
                                onPointerDown={beginInsertDrag}
                                onPointerMove={updateInsertDrag}
                                onPointerUp={finishInsertDrag}
                                onPointerLeave={finishInsertDrag}
                                onPointerCancel={finishInsertDrag}
                              >
                                <img
                                  src={insertPreviewUrl}
                                  alt="Reference object placement"
                                  className="h-full w-full rounded-[0.65rem] object-cover"
                                  draggable={false}
                                />
                                <div className="pointer-events-none absolute inset-1 rounded-[0.55rem] border border-amber-300/40" />
                                {!isDraggingInsert && (
                                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-400/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-950 shadow-lg">
                                    Drag to position
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                              Mode
                            </span>
                            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              <button
                                type="button"
                                onClick={() => setDrawMode("paint")}
                                className={maskModeButtonClass("paint")}
                              >
                                Paint
                              </button>
                              <button
                                type="button"
                                onClick={() => setDrawMode("erase")}
                                className={maskModeButtonClass("erase")}
                              >
                                Erase
                              </button>
                            </div>
                          </div>
                          <div className="flex min-w-[160px] flex-1 items-center gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                              Brush
                            </span>
                            <input
                              type="range"
                              min={10}
                              max={200}
                              step={5}
                              value={brushSize}
                              onChange={(event) => setBrushSize(Number(event.target.value))}
                              className="flex-1 accent-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={clearMask}
                            className="rounded-xl border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:bg-white/10"
                          >
                            Clear mask
                          </button>
                        </div>
                        <p className="text-[0.7rem] text-slate-400">
                          Paint white over furniture or architectural elements to transform them. Anything left black remains untouched.
                        </p>
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-slate-300">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-amber-200">
                                Optional reference object
                              </p>
                              <p className="text-slate-400">
                                Drop an inspiration piece and drag it into place. We’ll cue the model to anchor it inside the highlighted box.
                              </p>
                            </div>
                            {insertImageFile && (
                              <button
                                type="button"
                                onClick={removeInsertImage}
                                className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:bg-white/10"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {insertImageFile && insertRect ? (
                            <div className="space-y-3">
                              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="font-medium text-slate-100">{insertImageFile.name}</p>
                                <p className="mt-1 text-slate-400">
                                  Drag the overlay on the photo to reposition it, then resize with the slider to fine-tune scale.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <label className="flex justify-between text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                                  <span>Object width</span>
                                  <span>{Math.round(insertRect.width * 100)}%</span>
                                </label>
                                <input
                                  type="range"
                                  min={0.05}
                                  max={0.9}
                                  step={0.01}
                                  value={insertRect.width}
                                  onChange={(event) => updateInsertSize(Number(event.target.value))}
                                  className="w-full accent-amber-500"
                                />
                                <p className="text-slate-400">
                                  Height follows automatically to keep the original aspect ratio.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <label
                              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300/60 bg-black/15 p-4 text-center transition ${previewUrl ? "hover:bg-black/10" : "cursor-not-allowed opacity-50"}`}
                            >
                              <input
                                type="file"
                                accept="image/*"
                                onChange={onInsertImageChange}
                                className="hidden"
                                disabled={!previewUrl}
                              />
                              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-amber-200">
                                Add reference object
                              </span>
                              <span className="text-slate-200">
                                {previewUrl
                                  ? "Upload a PNG or JPG under 8MB."
                                  : "Upload your room photo first to place an object."}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[420px] items-center justify-center rounded-[1.75rem] border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
                        Upload a photo to unlock the in-browser mask painter.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 lg:p-8">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                      Style brief
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-100">
                      Describe the makeover direction
                    </h2>
                    <p className="text-sm text-slate-400">
                      Spell out the mood, palette, and materials you want. Templates on the right drop in curated prompts you can riff on.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                    <textarea
                      id="prompt"
                      placeholder="Describe the atmosphere, materials, palette, or mood you’d like to see."
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      className="min-h-[14rem] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                    />
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Templates
                        </p>
                        <div className="grid gap-2">
                          {promptTemplates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => applyTemplate(template)}
                              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-amber-400/80 hover:bg-amber-400/10"
                            >
                              <p className="text-sm font-semibold text-slate-100">
                                {template.title}
                              </p>
                              <p className="text-xs text-slate-400">{template.description}</p>
                            </button>
                          ))}
                        </div>
                        <p className="text-[0.7rem] text-slate-400">
                          Applying a template updates the prompt and advanced controls — feel free to keep adjusting afterward.
                        </p>
                      </div>
                      <div className="space-y-3 border-t border-white/10 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Prompt ideas
                        </p>
                        <ul className="space-y-3 text-sm text-slate-300">
                          <li>
                            “Rustic cabin aesthetic with reclaimed wood beams, copper fixtures, and warm candle lighting.”
                          </li>
                          <li>
                            “Bohemian lounge with layered textiles, hanging plants, and low ambient lights.”
                          </li>
                          <li>
                            “Minimalist Japanese living room, tatami flooring, and soft natural light.”
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 lg:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                        Fine-tune
                      </p>
                      <h2 className="text-2xl font-semibold text-slate-100">
                        Advanced controls
                      </h2>
                      <p className="text-sm text-slate-400">
                        Adjust prompt strength, blend amount, and inference steps. Dial it in when you need more control.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:bg-white/15"
                    >
                      {showAdvanced ? "Hide" : "Show"}
                    </button>
                  </div>
                  {showAdvanced && (
                    <div className="mt-6 grid gap-5 border-t border-white/5 pt-5 text-sm text-slate-200">
                      <div className="space-y-2">
                        <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          <span>Blend amount (Strength)</span>
                          <span>{strength.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={0.1}
                          max={0.9}
                          step={0.05}
                          value={strength}
                          onChange={(event) => setStrength(Number(event.target.value))}
                          className="w-full accent-amber-500"
                        />
                        <p className="text-xs text-slate-400">
                          Controls how much of the masked area adopts the generated makeover versus the original photo.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          <span>Prompt fidelity (Guidance)</span>
                          <span>{guidanceScale.toFixed(1)}</span>
                        </label>
                        <input
                          type="range"
                          min={4}
                          max={12}
                          step={0.5}
                          value={guidanceScale}
                          onChange={(event) => setGuidanceScale(Number(event.target.value))}
                          className="w-full accent-amber-500"
                        />
                        <p className="text-xs text-slate-400">
                          Boost this if instructions are ignored; very high values can introduce artifacts.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                          <span>Detail steps</span>
                          <span>{inferenceSteps}</span>
                        </label>
                        <input
                          type="range"
                          min={20}
                          max={60}
                          step={1}
                          value={inferenceSteps}
                          onChange={(event) => setInferenceSteps(Number(event.target.value))}
                          className="w-full accent-amber-500"
                        />
                        <p className="text-xs text-slate-400">
                          More steps yield cleaner results but increase inference time.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="negativePrompt"
                          className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
                        >
                          Negative prompt
                        </label>
                        <textarea
                          id="negativePrompt"
                          placeholder="Elements to avoid (e.g. text overlays, extra furniture, unrealistic lighting)."
                          value={negativePrompt}
                          onChange={(event) => setNegativePrompt(event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="seed"
                          className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
                        >
                          Seed (optional)
                        </label>
                        <input
                          id="seed"
                          type="number"
                          inputMode="numeric"
                          value={seed}
                          onChange={(event) => setSeed(event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                        />
                        <p className="text-xs text-slate-400">
                          Use the same seed to reproduce results. Leave blank for variation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {errorMessage && (
                  <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-slate-500">
                    Rendering usually takes 10–20 seconds. Stay on the page while we craft your makeover.
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        Styling in progress…
                      </span>
                    ) : (
                      "Generate makeover"
                    )}
                  </button>
                </div>
              </div>
            </form>
            {results.length > 0 ? (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                      Makeover gallery
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-100">
                      Recent variations
                    </h2>
                    <p className="text-sm text-slate-400">
                      Compare each render with a draggable split view, reuse it as a new base, or loop in Smart Redo feedback.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-slate-300">
                    {results.length} saved
                  </span>
                </div>
                <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {results.map((result) => {
                    const sliderPosition = comparisonPositions[result.createdAt] ?? 50;
                    const baseImage = result.sourceImage || previewUrl || result.url;
                    const redoOpen = activeRedoId === result.createdAt;
                    const displayModelId = result.modelId || defaultModelId;
                    return (
                      <article
                        key={result.createdAt}
                        className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 shadow-[0_30px_80px_-60px_rgba(15,23,42,1)]"
                      >
                        <div className="space-y-3">
                          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10">
                            <img
                              src={baseImage}
                              alt="Original reference"
                              className="absolute inset-0 h-full w-full object-cover"
                              draggable={false}
                            />
                            <div className="pointer-events-none absolute inset-0">
                              <div
                                className="absolute inset-0 overflow-hidden"
                                style={{
                                  clipPath: `inset(0 ${Math.max(
                                    0,
                                    100 - sliderPosition,
                                  )}% 0 0)`,
                                }}
                              >
                                <img
                                  src={result.url}
                                  alt={`Generated makeover for ${result.prompt}`}
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              </div>
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-amber-400/90"
                                style={{ left: `calc(${sliderPosition}% - 1px)` }}
                              />
                              <div
                                className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-amber-400 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-lg"
                                style={{ left: `calc(${sliderPosition}% - 14px)` }}
                              >
                                ↔
                              </div>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={sliderPosition}
                            onChange={(event) =>
                              setComparisonPositions((positions) => ({
                                ...positions,
                                [result.createdAt]: Number(event.target.value),
                              }))
                            }
                            className="w-full accent-amber-500"
                          />
                          <p className="text-[0.7rem] text-slate-400">
                            Drag the handle to compare the original upload with the makeover.
                          </p>
                        </div>
                        <div className="space-y-3 text-sm text-slate-300">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-100">
                              {result.prompt}
                            </p>
                            <p className="text-xs text-slate-500">
                              Saved at {new Date(result.createdAt).toLocaleTimeString()} · Model: {displayModelId}
                            </p>
                            {result.isPersisted && (
                              <p className="text-[0.68rem] text-emerald-300">
                                Synced to blob {result.projectCode ?? normalizedProjectCode ?? ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => reuseGeneratedImage(result)}
                              disabled={isLoading || reeditTargetId === result.createdAt}
                              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-400/70 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.35em] text-amber-200 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:border-amber-400/40 disabled:text-amber-200/60"
                            >
                              {reeditTargetId === result.createdAt ? (
                                <span className="flex items-center gap-2">
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                                  Preparing…
                                </span>
                              ) : (
                                "Re-edit"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSmartRedo(result.createdAt)}
                              className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.35em] transition ${
                                redoOpen
                                  ? "border-amber-400 bg-amber-400 text-slate-950"
                                  : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                              }`}
                            >
                              {redoOpen ? "Hide Smart Redo" : "Smart Redo"}
                            </button>
                          </div>
                          {redoOpen && (
                            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                              <textarea
                                value={redoNotes[result.createdAt] ?? ""}
                                onChange={(event) =>
                                  setRedoNotes((notes) => ({
                                    ...notes,
                                    [result.createdAt]: event.target.value,
                                  }))
                                }
                                placeholder="Describe what to adjust (e.g. brighten lighting, keep sofa, swap rug)."
                                className="w-full rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                                rows={3}
                              />
                              <div className="flex flex-wrap items-center justify-between gap-3 text-[0.7rem] text-slate-400">
                                <p>We’ll reuse the original photo and prompt, layering in your notes.</p>
                                <button
                                  type="button"
                                  onClick={() => handleSmartRedo(result)}
                                  disabled={smartRedoTargetId === result.createdAt}
                                  className="flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
                                >
                                  {smartRedoTargetId === result.createdAt ? (
                                    <span className="flex items-center gap-2">
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                                      Reworking…
                                    </span>
                                  ) : (
                                    "Apply feedback"
                                  )}
                                </button>
                              </div>
                            </div>
                            )}
                          {(result.blobUrl || result.metadataUrl || result.sourceBlobUrl) && (
                            <div className="flex flex-wrap gap-3 text-[0.68rem] text-amber-200">
                              {result.blobUrl && (
                                <a
                                  href={result.blobUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-dotted underline-offset-2 hover:text-amber-100"
                                >
                                  View image blob
                                </a>
                              )}
                              {result.metadataUrl && (
                                <a
                                  href={result.metadataUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-dotted underline-offset-2 hover:text-amber-100"
                                >
                                  Metadata
                                </a>
                              )}
                              {result.sourceBlobUrl && (
                                <a
                                  href={result.sourceBlobUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-dotted underline-offset-2 hover:text-amber-100"
                                >
                                  Original photo
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/50 p-6 text-sm text-slate-300 lg:p-8">
                Generate a makeover to populate this gallery.
              </section>
            )}
          </div>
          <aside
            id="shopping"
            className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 lg:sticky lg:top-24 lg:p-8"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
                Shopping console
              </p>
              <h2 className="text-xl font-semibold text-slate-100">
                Turn makeovers into merch tables
              </h2>
              <p className="text-sm text-slate-300">
                Focus on a hero object, crop it, then ask Gemma for shopping-friendly keywords to paste into Google Shopping.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Image source
              </label>
              <select
                value={keywordTarget === "original" ? "original" : String(keywordTarget)}
                onChange={handleKeywordTargetChange}
                disabled={keywordSelectDisabled}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="original" disabled={!previewUrl}>
                  {previewUrl
                    ? `Original upload${imageFile ? ` – ${imageFile.name}` : ""}`
                    : "Upload a photo to enable the original source"}
                </option>
                {results.map((result) => (
                  <option key={result.createdAt} value={result.createdAt}>
                    {new Date(result.createdAt).toLocaleTimeString()} · {result.prompt.slice(0, 48)}
                    {result.prompt.length > 48 ? "…" : ""}
                  </option>
                ))}
              </select>
              {keywordSourceLabel && (
                <p className="text-xs text-slate-400">{keywordSourceLabel}</p>
              )}
            </div>
            {keywordImageUrl ? (
              <div className="space-y-3">
                <div
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                  style={{ aspectRatio: keywordAspectRatio }}
                >
                  <img
                    src={keywordImageUrl}
                    alt="Selected for keyword extraction"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                  <div
                    ref={cropOverlayRef}
                    className="absolute inset-0 cursor-crosshair touch-none"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      beginCropSelection(event);
                    }}
                    onPointerMove={updateCropSelection}
                    onPointerUp={finishCropSelection}
                    onPointerLeave={finishCropSelection}
                    onPointerCancel={finishCropSelection}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {cropRect && (
                      <div
                        className="absolute rounded-2xl border-2 border-amber-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.65)]"
                        style={{
                          left: `${cropRect.x * 100}%`,
                          top: `${cropRect.y * 100}%`,
                          width: `${cropRect.width * 100}%`,
                          height: `${cropRect.height * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <p className="flex-1">
                    {cropRect
                      ? "We’ll send only the highlighted region to Gemma for keyword suggestions."
                      : "Draw a rectangle to focus on part of the photo, or leave blank to analyse the entire image."}
                  </p>
                  <button
                    type="button"
                    onClick={clearCropSelection}
                    disabled={!cropRect}
                    className="rounded-xl border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear crop
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-slate-400">
                Upload a photo or generate a makeover to enable keyword extraction.
              </div>
            )}
            {keywordsError && (
              <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {keywordsError}
              </p>
            )}
            <button
              type="button"
              onClick={generateShoppingKeywords}
              disabled={isKeywordsLoading || !keywordImageUrl}
              className="flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
            >
              {isKeywordsLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Analysing crop…
                </span>
              ) : (
                "Get shopping keywords"
              )}
            </button>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Suggested keywords
              </label>
              <textarea
                value={shoppingKeywords}
                onChange={(event) => {
                  setShoppingKeywords(event.target.value);
                  setShoppingError(null);
                  setLastShoppingKeywords(null);
                }}
                placeholder="Keywords from Gemma will appear here..."
                className="min-h-[8rem] w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
              />
              <p className="text-xs text-slate-400">
                Copy and paste these into Google Shopping or tweak them to refine your search.
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                <span>CLIP minimum similarity</span>
                <span className="text-[0.7rem] text-slate-300">{clipThreshold.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={clipThreshold}
                onChange={(event) => setClipThreshold(Number(event.target.value))}
                className="w-full accent-amber-500"
              />
              <p className="text-xs text-slate-400">
                Raise the threshold to hide looser visual matches. Set to 0 to include items without CLIP scores.
              </p>
            </div>
            {shoppingError && (
              <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {shoppingError}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={searchShoppingMatches}
                disabled={shoppingSearchDisabled}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
              >
                {isShoppingLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Fetching products…
                  </span>
                ) : (
                  "Find shopping matches"
                )}
              </button>
              <button
                type="button"
                onClick={recomputeClipScores}
                disabled={isClipRanking || rawShoppingResults.length === 0 || !keywordImageUrl}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-500 px-4 py-3 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-amber-500/50 disabled:text-amber-200"
              >
                {isClipRanking ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    Recomputing CLIP ranks…
                  </span>
                ) : (
                  "Re-run CLIP ranking"
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Searches reuse the latest keywords. Generate or edit the list to run another lookup. Re-rank results locally without another SerpAPI request.
            </p>
            {(isShoppingLoading || isClipRanking) && (
              <p className="text-sm text-slate-400">
                {isClipRanking ? "Ranking matches with CLIP…" : "Fetching shopping results…"}
              </p>
            )}
            {filteredShoppingResults.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Shopping matches
                </p>
                <div className="grid gap-4">
                  {filteredShoppingResults.map((item, index) => (
                    <article
                      key={`${item.link}-${index}`}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200"
                    >
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="h-20 w-20 flex-shrink-0 rounded-xl border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
                          No image
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-semibold text-amber-300 hover:underline"
                        >
                          {item.title}
                        </a>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          {item.price ? (
                            <span className="rounded-md border border-white/10 px-2 py-1 text-slate-100">
                              {item.price}
                            </span>
                          ) : item.extractedPrice ? (
                            <span className="rounded-md border border-white/10 px-2 py-1 text-slate-100">
                              ${item.extractedPrice.toFixed(2)}
                            </span>
                          ) : null}
                          {item.source && (
                            <span className="rounded-md border border-white/10 px-2 py-1">
                              {item.source}
                            </span>
                          )}
                          {item.shipping && (
                            <span className="rounded-md border border-white/10 px-2 py-1">
                              {item.shipping}
                            </span>
                          )}
                        </div>
                        {typeof item.clipScore === "number" && (
                          <p className="text-xs text-amber-400">
                            CLIP similarity: {item.clipScore.toFixed(3)}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : shoppingResults.length > 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
                No matches meet the current CLIP threshold. Lower the slider or re-run ranking to compare again.
              </p>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
