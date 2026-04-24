import { GoogleGenAI } from "@google/genai";

declare const Bun: {
  argv: string[];
  main?: boolean;
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askGemini(prompt: string, recentMessages: string[] = []) {
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

  const styleInstruction = [
    "You are a helpful assistant inside a chat app.",
    "Write clean, readable answers in Markdown.",
    "Format rules:",
    "1) Start with a 1-2 line direct answer.",
    "2) Then use short sections with headings when useful.",
    "3) Use bullet points for steps/lists.",
    "4) Keep paragraphs short (max 2-3 lines).",
    "5) If technical, include one tiny example.",
    "6) Avoid fluff, repetition, and long walls of text.",
    "7) Match the user's language and tone."
  ].join("\n");

  const contextBlock =
    recentMessages.length > 0
      ? "\n\nRecent conversation context:\n" +
      recentMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")
      : "";

  const fullPrompt =
    styleInstruction +
    contextBlock +
    "\n\nUser message:\n" +
    prompt.trim() +
    "\n\nNow write the final answer.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        temperature: 0.45,
        topP: 0.9,
        maxOutputTokens: 900
      }
    });

    const text = response.text?.trim();
    return text && text.length > 0
      ? text
      : "I could not generate a clear response right now. Please try again.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I hit an issue while generating the response. Please try again.";
  }
}

async function main() {
  const prompt = Bun.argv.slice(2).join(" ").trim();

  if (!prompt) {
    throw new Error("Pass a prompt after the script name");
  }

  const answer = await askGemini(prompt);
  console.log(answer);
}

if (import.meta.main) {
  void main();
}