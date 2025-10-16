export const promptTemplates = [
  {
    id: "holiday-cozy",
    title: "Cozy Holiday Living Room",
    description:
      "Layered greenery, warm lighting, and seasonal accents without clutter.",
    prompt:
      "Transform the space into a cozy holiday living room with a neutral palette, fresh evergreen garlands, brass candleholders, and soft ambient lighting.",
    negativePrompt:
      "Avoid cartoonish decorations, oversized gifts, or unrealistic snow effects.",
    guidanceScale: 8.5,
    strength: 0.45,
    inferenceSteps: 35,
  },
  {
    id: "modern-minimal",
    title: "Modern Minimal Loft",
    description:
      "Bright, airy, and minimalist with crisp lines and natural textures.",
    prompt:
      "Restyle the room into a modern minimal loft featuring light oak floors, white plaster walls, slimline furniture, and sculptural lighting accents.",
    negativePrompt:
      "Avoid clutter, heavy curtains, or ornate traditional decor.",
    guidanceScale: 7,
    strength: 0.3,
    inferenceSteps: 32,
  },
  {
    id: "coastal-retreat",
    title: "Coastal Retreat Bedroom",
    description:
      "Serene seaside palette with airy fabrics and organic materials.",
    prompt:
      "Reimagine the space as a coastal retreat bedroom with sun-washed linens, woven textures, driftwood accents, and gentle turquoise highlights.",
    negativePrompt:
      "Avoid nautical kitsch, anchors, or overly vibrant primary colors.",
    guidanceScale: 7.8,
    strength: 0.4,
    inferenceSteps: 38,
  },
] as const;
