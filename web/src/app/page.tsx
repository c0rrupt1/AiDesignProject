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

  const previewLabel = useMemo(() => {
    if (!imageFile) return "Upload a base photo";
    return imageFile.name;
  }, [imageFile]);

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

  return (
    <div className="font-sans min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16 pt-12 md:px-12">
        <section className="space-y-4">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            Home Stylist
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Transform your room with AI-powered makeovers
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Upload a photo of your space, describe the style you&apos;re aiming
            for, and receive a refreshed design concept in seconds. Try prompts
            like &ldquo;Rustic cabin with warm lighting&rdquo;, &ldquo;Scandinavian
            minimalism&rdquo;, or &ldquo;Neo-industrial loft&rdquo;.
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
                      onChange={(event) => setNegativePrompt(event.target.value)}
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

        {results.length > 0 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">
                Recent makeovers
              </h2>
              <p className="text-sm text-slate-400">
                Each preview is generated from the prompt you provided above.
              </p>
            </div>

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
                  <div className="space-y-1 text-sm text-slate-300">
                    <p className="font-medium text-slate-100">{result.prompt}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(result.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
