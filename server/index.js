require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createWorker } = require("tesseract.js");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
});

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

function cleanModelText(text) {
  return String(text || "")
    .replace(/```json|```/gi, "")
    .trim();
}

function extractFirstJsonObject(input) {
  const text = cleanModelText(input);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeScore(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 10) return 10;
  return Number(numeric.toFixed(1));
}

function toWeightedPoints(rawScoreOutOfTen, maxPoints) {
  const normalized = normalizeScore(rawScoreOutOfTen);
  return Number(((normalized / 10) * maxPoints).toFixed(1));
}

function buildEvaluationPrompt({ mode, question, studentAnswer, modelAnswer }) {
  const modeInstruction =
    mode === "semantic_with_model_answer"
      ? `Evaluate semantic similarity between student answer and provided model answer.\nModel Answer:\n${modelAnswer}`
      : "Evaluate how relevant and accurate the student answer is for the given question. Do not require exact wording.";

  return (
    `Mode: ${mode}\n\n` +
    `${modeInstruction}\n\n` +
    `Question:\n${question}\n\n` +
    `Student Answer:\n${studentAnswer}\n\n` +
    "Scoring strictness rules:\n" +
    "- Be strict and evidence-based. Do not inflate scores.\n" +
    "- If key concepts are missing, cap score at 6/10 unless most critical points are present.\n" +
    "- Penalize factual mistakes and irrelevant statements.\n" +
    "- In semantic mode, compare meaning coverage against model answer, not exact wording.\n" +
    "- Mention exactly what the student missed.\n" +
    "- If answer is mostly wrong/irrelevant, set strengths to an empty array.\n" +
    "- If answer is mostly wrong/irrelevant, include 'No clear strengths identified.' in feedback.\n" +
    "Rubric scoring scale:\n" +
    "- relevance_or_similarity: score out of 10, mapped to 5 points\n" +
    "- correctness: score out of 10, mapped to 3 points\n" +
    "- clarity: score out of 10, mapped to 2 points\n" +
    "- final score must be (relevance_points + correctness_points + clarity_points), out of 10\n" +
    "Return JSON only:\n" +
    "{\n" +
    "  \"score\": number,\n" +
    "  \"rubric\": {\n" +
    "    \"relevance_or_similarity\": {\"score\": number, \"reason\": \"string\"},\n" +
    "    \"correctness\": {\"score\": number, \"reason\": \"string\"},\n" +
    "    \"clarity\": {\"score\": number, \"reason\": \"string\"}\n" +
    "  },\n" +
    "  \"feedback\": \"string\",\n" +
    "  \"strengths\": [\"string\"],\n" +
    "  \"weaknesses\": [\"string\"],\n" +
    "  \"missed_points\": [\"string\"],\n" +
    "  \"improvements\": [\"string\"]\n" +
    "}"
  );
}

function normalizeEvaluation(parsed) {
  const rubric = parsed.rubric || {};

  const rawRelevanceOrSimilarity = normalizeScore(rubric?.relevance_or_similarity?.score);
  const rawCorrectness = normalizeScore(rubric?.correctness?.score);
  const rawClarity = normalizeScore(rubric?.clarity?.score);

  const relevancePoints = toWeightedPoints(rawRelevanceOrSimilarity, 5);
  const correctnessPoints = toWeightedPoints(rawCorrectness, 3);
  const clarityPoints = toWeightedPoints(rawClarity, 2);
  const finalScore = Number(
    (relevancePoints + correctnessPoints + clarityPoints).toFixed(1)
  );

  const normalized = {
    score: normalizeScore(finalScore),
    rubric: {
      relevance_or_similarity: {
        score: relevancePoints,
        max_score: 5,
        raw_score: rawRelevanceOrSimilarity,
        reason: String(rubric?.relevance_or_similarity?.reason || ""),
      },
      correctness: {
        score: correctnessPoints,
        max_score: 3,
        raw_score: rawCorrectness,
        reason: String(rubric?.correctness?.reason || ""),
      },
      clarity: {
        score: clarityPoints,
        max_score: 2,
        raw_score: rawClarity,
        reason: String(rubric?.clarity?.reason || ""),
      },
    },
    feedback: String(parsed.feedback || ""),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    missed_points: Array.isArray(parsed.missed_points) ? parsed.missed_points : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
  };

  const isMostlyIncorrect =
    normalized.score <= 4 ||
    (normalized.rubric.relevance_or_similarity.raw_score <= 4 &&
      normalized.rubric.correctness.raw_score <= 4);

  if (isMostlyIncorrect) {
    normalized.strengths = [];
    if (!/no clear strengths identified/i.test(normalized.feedback)) {
      normalized.feedback = `${normalized.feedback} No clear strengths identified.`.trim();
    }
  }

  return normalized;
}

function parseEvaluationJson(rawText, provider) {
  const firstJson = extractFirstJsonObject(rawText);
  if (!firstJson) {
    throw new Error(`${provider} returned non-JSON output`);
  }
  return normalizeEvaluation(JSON.parse(firstJson));
}

async function getOCRText(imagePath) {
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    return String(text || "").trim();
  } finally {
    await worker.terminate();
  }
}

async function evaluateWithGemini(payload) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });

  const result = await model.generateContent([
    "You are a strict exam evaluator. Return only JSON.",
    buildEvaluationPrompt(payload),
  ]);

  const text = result?.response?.text?.() || "{}";
  return parseEvaluationJson(text, "Gemini");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/grade-answer", upload.single("image"), async (req, res) => {
  const imagePath = req.file?.path;

  try {
    const question = String(req.body?.question || "").trim();
    const mode = String(req.body?.mode || "relevance_to_question").trim();
    const modelAnswer = String(req.body?.modelAnswer || "").trim();

    if (!req.file || !question) {
      return res.status(400).json({ error: "Image and question are required" });
    }

    if (mode === "semantic_with_model_answer" && !modelAnswer) {
      return res.status(400).json({ error: "modelAnswer is required for semantic_with_model_answer mode" });
    }

    if (mode !== "relevance_to_question" && mode !== "semantic_with_model_answer") {
      return res.status(400).json({ error: "Invalid mode. Use relevance_to_question or semantic_with_model_answer" });
    }

    const extractedText = await getOCRText(imagePath);
    if (!extractedText) {
      return res.status(400).json({ error: "OCR could not detect text in image" });
    }

    const evaluation = await evaluateWithGemini({
      mode,
      question,
      studentAnswer: extractedText,
      modelAnswer,
    });

    return res.json({
      mode,
      provider: "gemini",
      question,
      extractedText,
      modelAnswer: mode === "semantic_with_model_answer" ? modelAnswer : null,
      score: evaluation.score,
      rubric: evaluation.rubric,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missed_points: evaluation.missed_points,
      improvements: evaluation.improvements,
    });
  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({
      error: "Evaluation failed",
      details: error.message,
    });
  } finally {
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
