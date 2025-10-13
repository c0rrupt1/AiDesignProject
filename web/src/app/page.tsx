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


type GeneratedImage = {
  url: string;
  createdAt: number;
  prompt: string;
};

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

export default function Home() {
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
  const [results, setResults] = useState<GeneratedImage[]>([]);
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
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const cropOverlayRef = useRef<HTMLDivElement | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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


  const previewLabel = useMemo(() => {
    if (!imageFile) return "Upload a base photo";
    return imageFile.name;
  }, [imageFile]);

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
      return;
    }

    setImageFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
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

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", imageFile);
    formData.append("guidanceScale", guidanceScale.toString());
    formData.append("strength", strength.toString());
    formData.append("inferenceSteps", inferenceSteps.toString());
    if (negativePrompt.trim()) {
      formData.append("negativePrompt", negativePrompt);
    }
    if (seed.trim()) {
      formData.append("seed", seed.trim());
    }
    if (hasMask && maskCanvasRef.current) {
      const maskBlob = await new Promise<Blob | null>((resolve) => {
        maskCanvasRef.current?.toBlob(
          (blob) => resolve(blob),
          "image/png",
          1,
        );
      });
      if (maskBlob) {
        formData.append(
          "mask",
          new File([maskBlob], "mask.png", { type: "image/png" }),
        );
      }
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/edit", {
        method: "POST",
        body: formData,
      });

      const rawBody = await response.text();
      let payload: { image?: string; error?: string } | null = null;

      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          payload?.error ??
          (rawBody ? rawBody.slice(0, 160) : response.statusText);
        throw new Error(
          `Image edit failed (HTTP ${response.status}): ${message}`,
        );
      }

      const imageData = payload?.image;

      if (!imageData) {
        throw new Error("The AI service returned an unexpected response.");
      }

      setResults((history) => [
        {
          url: imageData,
          createdAt: Date.now(),
          prompt,
        },
        ...history,
      ]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while editing the photo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const maskModeButtonClass = (mode: "paint" | "erase") =>
    `px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
      drawMode === mode
        ? "bg-amber-500 text-slate-950"
        : "bg-white/5 text-slate-300 hover:bg-white/10"
    }`;

  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

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

  const cropImageToDataUrl = (
    src: string,
    rect: CropRect | null,
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;

        let sx = 0;
        let sy = 0;
        let sw = naturalWidth;
        let sh = naturalHeight;

        if (rect && rect.width > 0 && rect.height > 0) {
          sx = Math.floor(rect.x * naturalWidth);
          sy = Math.floor(rect.y * naturalHeight);
          sw = Math.floor(rect.width * naturalWidth);
          sh = Math.floor(rect.height * naturalHeight);

          if (sw <= 0 || sh <= 0) {
            sw = naturalWidth;
            sh = naturalHeight;
            sx = 0;
            sy = 0;
          } else {
            if (sx < 0) sx = 0;
            if (sy < 0) sy = 0;
            if (sx + sw > naturalWidth) {
              sw = naturalWidth - sx;
            }
            if (sy + sh > naturalHeight) {
              sh = naturalHeight - sy;
            }
          }
        }

        sw = Math.max(sw, 1);
        sh = Math.max(sh, 1);
        if (sx > naturalWidth - sw) {
          sx = Math.max(0, naturalWidth - sw);
        }
        if (sy > naturalHeight - sh) {
          sy = Math.max(0, naturalHeight - sh);
        }

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to create a drawing context."));
          return;
        }
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      };
      image.onerror = () => reject(new Error("Failed to load image for crop."));
      image.src = src;
    });

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

    try {
      setIsKeywordsLoading(true);
      setShoppingKeywords("");
      const dataUrl = await cropImageToDataUrl(keywordImageUrl, cropRect);
      setLastClipReference(dataUrl);

      const response = await fetch("/api/keywords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          sourceLabel: keywordSourceLabel,
        }),
      });

      const rawBody = await response.text();
      let payload: { keywords?: string; error?: string } | null = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          payload?.error ??
          (rawBody ? rawBody.slice(0, 160) : response.statusText);
        throw new Error(
          `Keyword extraction failed (HTTP ${response.status}): ${message}`,
        );
      }

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
      console.error(error);
      setShoppingKeywords("");
      setKeywordsError(
        error instanceof Error
          ? error.message
          : "Something went wrong while requesting shopping keywords.",
      );
    } finally {
      setIsKeywordsLoading(false);
    }
  };

  const computeClipRanking = async (
    referenceDataUrl: string,
    baseResults: ShoppingResult[],
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

    const response = await fetch("/api/clip-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referenceImage: referenceDataUrl,
        candidateImages: candidates,
        limit: candidates.length,
      }),
    });

    const rawBody = await response.text();
    let payload: { results?: Array<{ url?: string; score?: number }>; error?: string } | null = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        payload?.error ?? (rawBody ? rawBody.slice(0, 160) : response.statusText);
      throw new Error(
        `CLIP ranking failed (HTTP ${response.status}): ${message}`,
      );
    }

    const results: ClipScoreResponse[] = Array.isArray(payload?.results)
      ? (payload?.results ?? [])
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

    try {
      const response = await fetch("/api/shopping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords,
          limit: 16,
        }),
      });

      const rawBody = await response.text();
      let payload:
        | {
            results?: Array<Record<string, unknown>>;
            error?: string;
          }
        | null = null;
      if (rawBody) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = null;
        }
      }

      if (!response.ok) {
        const message =
          payload?.error ??
          (rawBody ? rawBody.slice(0, 160) : response.statusText);
        throw new Error(
          `Shopping lookup failed (HTTP ${response.status}): ${message}`,
        );
      }

      const rawResults = Array.isArray(payload?.results)
        ? payload?.results ?? []
        : [];

      const parsedResults: ShoppingResult[] = rawResults
        .map((entry) => {
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
            clipScore: null,
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
        rankedResults = await computeClipRanking(
          referenceDataUrl,
          baseResults,
        );
      } catch (error) {
        console.error("Failed to prepare reference image for CLIP", error);
        setShoppingError(
          error instanceof Error
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
      console.error(error);
      setShoppingResults([]);
      setShoppingError(
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting Google Shopping.",
      );
    } finally {
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
      const ranked = await computeClipRanking(
        referenceDataUrl,
        rawShoppingResults,
      );
      setShoppingResults(ranked);
    } catch (error) {
      console.error(error);
      setShoppingError(
        error instanceof Error
          ? error.message
          : "Something went wrong while re-ranking with CLIP.",
      );
    } finally {
      setIsClipRanking(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16 pt-12 md:px-12">
        <section className="space-y-4">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            Home Stylist
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Transform rooms with AI makeovers
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Upload a photo of your space, paint the areas you want to restyle,
            and generate AI-powered makeovers tailored to your prompt.
          </p>
        </section>
        <form
          onSubmit={onSubmit}
          className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-amber-500/20 backdrop-blur-md md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-8"
        >
            <div className="space-y-6">
              <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-500/70 bg-black/30 text-center text-sm transition hover:bg-black/20">
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={onBaseImageChange}
                  className="hidden"
                />
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
                  Photo
                </span>
                <span className="max-w-[14rem] text-sm font-medium text-slate-200">
                  {previewLabel}
                </span>
                <span className="text-xs text-slate-400">
                  PNG or JPG up to 8&nbsp;MB
                </span>
              </label>
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                    <figcaption className="text-sm font-medium text-slate-200">
                      Mask painter
                    </figcaption>
                    <div
                      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                      style={{
                        aspectRatio: imageDimensions
                          ? `${imageDimensions.width} / ${imageDimensions.height}`
                          : "4 / 3",
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
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
                          Mode
                        </span>
                        <div className="flex overflow-hidden rounded-xl border border-white/10">
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
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400">
                          Brush
                        </span>
                        <input
                          type="range"
                          min={10}
                          max={200}
                          step={5}
                          value={brushSize}
                          onChange={(event) =>
                            setBrushSize(Number(event.target.value))
                          }
                          className="flex-1 accent-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={clearMask}
                        className="rounded-xl border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
                      >
                        Clear mask
                      </button>
                    </div>
                    <p className="text-[0.7rem] text-slate-400">
                      Paint white over the furniture or walls you want the AI to
                      restyle. Areas left black will stay untouched.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-slate-300">
                  Upload a photo to unlock the in-browser mask painter.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <label
                  htmlFor="prompt"
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400"
                >
                  Style prompt
                </label>
                <textarea
                  id="prompt"
                  placeholder="Describe the atmosphere, materials, palette, or mood you’d like to see."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-[12rem] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                />
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Prompt ideas
                </p>
                <ul className="grid gap-2 text-sm text-slate-300">
                  <li>
                    “Rustic cabin aesthetic with reclaimed wood beams, copper
                    fixtures, and warm candle lighting.”
                  </li>
                  <li>
                    “Bohemian lounge with layered textiles, hanging plants, and
                    low ambient lights.”
                  </li>
                  <li>
                    “Minimalist Japanese living room, tatami flooring, and soft
                    natural light.”
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/5"
                >
                  Advanced controls
                  <span className="text-xs uppercase tracking-[0.3em] text-amber-400">
                    {showAdvanced ? "Hide" : "Show"}
                  </span>
                </button>
                {showAdvanced && (
                  <div className="grid gap-4 border-t border-white/5 px-4 py-4 text-sm text-slate-200">
                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        <span>Blend amount (Strength)</span>
                        <span>{strength.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={strength}
                        onChange={(event) =>
                          setStrength(Number(event.target.value))
                        }
                        className="w-full accent-amber-500"
                      />
                      <p className="text-xs text-slate-400">
                        Controls how much of the masked area adopts the generated
                        makeover versus the original photo.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        <span>Prompt fidelity (Guidance)</span>
                        <span>{guidanceScale.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min={4}
                        max={12}
                        step={0.5}
                        value={guidanceScale}
                        onChange={(event) =>
                          setGuidanceScale(Number(event.target.value))
                        }
                        className="w-full accent-amber-500"
                      />
                      <p className="text-xs text-slate-400">
                        Boost this if instructions are ignored; very high values
                        can introduce artifacts.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        <span>Detail steps</span>
                        <span>{inferenceSteps}</span>
                      </label>
                      <input
                        type="range"
                        min={20}
                        max={60}
                        step={1}
                        value={inferenceSteps}
                        onChange={(event) =>
                          setInferenceSteps(Number(event.target.value))
                        }
                        className="w-full accent-amber-500"
                      />
                      <p className="text-xs text-slate-400">
                        More steps yield cleaner results but increase inference
                        time.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="negativePrompt"
                        className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
                      >
                        Negative prompt
                      </label>
                      <textarea
                        id="negativePrompt"
                        placeholder="Elements to avoid (e.g. text overlays, extra furniture, unrealistic lighting)."
                        value={negativePrompt}
                        onChange={(event) =>
                          setNegativePrompt(event.target.value)
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="seed"
                        className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400"
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
                        Use the same seed to reproduce results. Leave blank for
                        variation.
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

              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
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
          </form>
        {(results.length > 0 || keywordImageUrl) && (
          <section className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-100">
                  Recent makeovers
                </h2>
                <p className="text-sm text-slate-400">
                  Each preview is generated from the prompt you provided above.
                </p>
              </div>

              {results.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {results.map((result) => (
                    <article
                      key={result.createdAt}
                      className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <img
                        src={result.url}
                        alt={`Generated makeover for ${result.prompt}`}
                        className="aspect-square w-full rounded-2xl border border-black/30 object-cover shadow-2xl"
                      />
                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-100">
                            {result.prompt}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(result.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  Generate a makeover to populate this gallery.
                </div>
              )}
            </div>

            <aside className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
                  Shopping tab
                </span>
                <div className="flex overflow-hidden rounded-xl border border-white/10">
                  <button
                    type="button"
                    className="flex-1 bg-amber-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950"
                  >
                    Shopping keywords
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex-1 bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
                  >
                    Coming soon
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-300">
                Focus on a piece from your photo, crop it, then ask Gemma for
                shopping-friendly keywords you can paste into Google Shopping.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
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
                      {new Date(result.createdAt).toLocaleTimeString()} ·{" "}
                      {result.prompt.slice(0, 48)}
                      {result.prompt.length > 48 ? "…" : ""}
                    </option>
                  ))}
                </select>
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
                          className="absolute rounded-2xl border-2 border-amber-400"
                          style={{
                            left: `${cropRect.x * 100}%`,
                            top: `${cropRect.y * 100}%`,
                            width: `${cropRect.width * 100}%`,
                            height: `${cropRect.height * 100}%`,
                            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.65)",
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
                  Upload a photo or generate a makeover to enable keyword
                  extraction.
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
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
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
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
                  Copy and paste these into Google Shopping or tweak them to
                  refine your search.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  <span>CLIP minimum similarity</span>
                  <span className="text-[0.7rem] text-slate-300">
                    {clipThreshold.toFixed(2)}
                  </span>
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
                  Raise the threshold to hide looser visual matches. Set to 0 to
                  include items without CLIP scores.
                </p>
              </div>

              {shoppingError && (
                <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {shoppingError}
                </p>
              )}

              <button
                type="button"
                onClick={searchShoppingMatches}
                disabled={shoppingSearchDisabled}
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
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
              <p className="text-xs text-slate-500">
                Searches reuse the latest keywords. Generate or edit the list to
                run another lookup.
              </p>

              <button
                type="button"
                onClick={recomputeClipScores}
                disabled={
                  isClipRanking ||
                  rawShoppingResults.length === 0 ||
                  !keywordImageUrl
                }
                className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500 px-4 py-3 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-amber-500/50 disabled:text-amber-200"
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
              <p className="text-xs text-slate-500">
                Re-rank results locally without another SerpAPI request.
              </p>

              {(isShoppingLoading || isClipRanking) && (
                <p className="text-sm text-slate-400">
                  {isClipRanking
                    ? "Ranking matches with CLIP…"
                    : "Fetching shopping results…"}
                </p>
              )}

              {filteredShoppingResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
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
                  No matches meet the current CLIP threshold. Lower the slider or
                  re-run ranking to compare again.
                </p>
              ) : null}
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}
