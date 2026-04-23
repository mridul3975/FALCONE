import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askGemini(prompt: string) {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text ?? "";
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