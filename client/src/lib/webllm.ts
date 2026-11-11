import { MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";

export interface WebLLMProgress {
  progress: number;
  text: string;
  isLoaded: boolean;
}

let engineInstance: MLCEngine | null = null;
let currentLoadedModel: string | null = null;

export async function isWebGPUSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    (navigator as { gpu?: unknown }).gpu !== undefined
  );
}

export async function getWebLLMEngine(
  modelName: string,
  onProgress?: (progress: WebLLMProgress) => void,
): Promise<MLCEngine> {
  if (engineInstance && currentLoadedModel === modelName) {
    onProgress?.({
      progress: 1,
      text: "Model loaded in memory",
      isLoaded: true,
    });
    return engineInstance;
  }

  const engine = new MLCEngine();
  engine.setInitProgressCallback((report: InitProgressReport) => {
    onProgress?.({
      progress: report.progress,
      text: report.text,
      isLoaded: report.progress >= 1,
    });
  });

  await engine.reload(modelName);
  engineInstance = engine;
  currentLoadedModel = modelName;

  onProgress?.({ progress: 1, text: "Model ready", isLoaded: true });
  return engineInstance;
}

export async function runWebLLMSummary(
  modelName: string,
  prs: Array<{ repo: string; title: string; commits: string[] }>,
  language: "vi" | "en" = "vi",
  onProgress?: (progress: WebLLMProgress) => void,
): Promise<string[]> {
  const engine = await getWebLLMEngine(modelName, onProgress);

  const lang = language === "en" ? "English" : "Vietnamese";
  const prDetails = prs
    .map(
      (p) =>
        `Repository: ${p.repo}\nPR Title: ${p.title}\nCommits:\n` +
        p.commits.map((c) => `  - ${c}`).join("\n"),
    )
    .join("\n\n");

  const systemPrompt =
    `You are a senior tech lead writing a concise daily standup summary. ` +
    `Summarize the provided Git PRs and commits into exactly 3 to 4 short bullet lines in ${lang}. ` +
    `Focus on completed features and bug fixes. Every line MUST start with "• ". Do not output any greetings or headings.`;

  const userPrompt = `Git activity today:\n\n${prDetails}`;

  const completion = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 400,
  });

  const responseText = completion.choices[0]?.message?.content || "";
  const lines = responseText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^[-*•]\s*/, ""));

  return lines.length > 0
    ? lines
    : ["Cập nhật và hoàn thiện các module hệ thống."];
}
