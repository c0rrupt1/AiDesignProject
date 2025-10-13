export type OpenRouterChatCompletionsResponse = {
  id?: string;
  model?: string;
  created?: number;
  choices?: Array<{
    index?: number;
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
            image_url?: {
              url?: string;
              detail?: string;
            };
            b64_json?: string;
          }>
        | {
            type?: string;
            image_url?: {
              url?: string;
              detail?: string;
            };
            b64_json?: string;
          };
      images?: Array<{
        type?: string;
        image_url?: {
          url?: string;
          detail?: string;
        };
        b64_json?: string;
      }>;
    } | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?:
    | string
    | {
        message?: string;
        type?: string;
        param?: string | null;
        code?: string | null;
      };
};
