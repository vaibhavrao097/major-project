import React, { useState } from "react";
import "./App.css";

type Mode = "relevance_to_question" | "semantic_with_model_answer";

interface RubricItem {
  score: number;
  max_score: number;
  raw_score: number;
  reason: string;
}

interface Result {
  mode: Mode;
  provider: "openai" | "gemini";
  score: number;
  feedback: string;
  extractedText: string;
  modelAnswer: string | null;
  strengths: string[];
  weaknesses: string[];
  missed_points: string[];
  improvements: string[];
  rubric: {
    relevance_or_similarity: RubricItem;
    correctness: RubricItem;
    clarity: RubricItem;
  };
}

const App: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<Mode>("relevance_to_question");
  const [modelAnswer, setModelAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!image || !question.trim()) {
      setError("Upload answer image and enter question.");
      return;
    }

    if (mode === "semantic_with_model_answer" && !modelAnswer.trim()) {
      setError("Model answer is required in semantic mode.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", image);
    formData.append("question", question.trim());
    formData.append("mode", mode);
    if (mode === "semantic_with_model_answer") {
      formData.append("modelAnswer", modelAnswer.trim());
    }

    try {
      const res = await fetch("http://localhost:5000/grade-answer", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.details || data?.error || "Evaluation failed");
      setResult(data as Result);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const renderList = (items: string[], fallback: string) => {
    const output = items.length > 0 ? items : [fallback];
    return output.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>);
  };

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">AI Assessment Studio</p>
        <h1>Smart Evaluator</h1>
        <p>
          Upload a student answer image and get rubric-based scoring with strict feedback,
          missed points, and actionable improvements.
        </p>
      </header>

      <section className="layout">
        <article className="card form-card">
          <h2>Evaluate Answer</h2>

          <label htmlFor="answer-image">Answer Image</label>
          <input
            id="answer-image"
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />

          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            rows={5}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Write the exact question shown in exam"
          />

          <label htmlFor="mode">Evaluation Mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="relevance_to_question">Relevance to question</option>
            <option value="semantic_with_model_answer">Semantic match with model answer</option>
          </select>

          {mode === "semantic_with_model_answer" && (
            <>
              <label htmlFor="model-answer">Model Answer</label>
              <textarea
                id="model-answer"
                rows={6}
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                placeholder="Paste the ideal answer for semantic comparison"
              />
            </>
          )}

          <button className="primary-btn" onClick={submit} disabled={loading}>
            {loading ? "Evaluating..." : "Evaluate Now"}
          </button>

          {error && <p className="error-text">{error}</p>}
        </article>

        <article className="card result-card">
          {!result && (
            <div className="empty-state">
              <h2>Results Panel</h2>
              <p>
                Your score, rubric breakdown, strengths, weaknesses, and missed points will appear here
                after evaluation.
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="result-head">
                <div>
                  <p className="eyebrow">Final Score</p>
                  <h2>{result.score} / 10</h2>
                </div>
                <span className="provider-badge">AI Evaluator</span>
              </div>

              <p className="feedback">{result.feedback}</p>

              <section className="rubric-grid">
                <article className="rubric-card">
                  <div className="rubric-title-row">
                    <h3>Relevance/Similarity</h3>
                    <span>{result.rubric.relevance_or_similarity.score}/{result.rubric.relevance_or_similarity.max_score}</span>
                  </div>
                  <p>{result.rubric.relevance_or_similarity.reason}</p>
                </article>

                <article className="rubric-card">
                  <div className="rubric-title-row">
                    <h3>Correctness</h3>
                    <span>{result.rubric.correctness.score}/{result.rubric.correctness.max_score}</span>
                  </div>
                  <p>{result.rubric.correctness.reason}</p>
                </article>

                <article className="rubric-card">
                  <div className="rubric-title-row">
                    <h3>Clarity</h3>
                    <span>{result.rubric.clarity.score}/{result.rubric.clarity.max_score}</span>
                  </div>
                  <p>{result.rubric.clarity.reason}</p>
                </article>
              </section>

              <section className="lists-grid">
                <div className="list-block strength-block">
                  <h3>Strengths</h3>
                  <ul>{renderList(result.strengths, "No strong points identified yet.")}</ul>
                </div>

                <div className="list-block weakness-block">
                  <h3>Weaknesses</h3>
                  <ul>{renderList(result.weaknesses, "No major weaknesses identified.")}</ul>
                </div>

                <div className="list-block missed-block">
                  <h3>Missed Points</h3>
                  <ul>{renderList(result.missed_points, "No specific missed points reported.")}</ul>
                </div>

                <div className="list-block improve-block">
                  <h3>Improvements</h3>
                  <ul>{renderList(result.improvements, "No improvement tips generated.")}</ul>
                </div>
              </section>

              <section className="text-panels">
                <div>
                  <h3>Extracted OCR Text</h3>
                  <pre>{result.extractedText}</pre>
                </div>

                {result.modelAnswer && (
                  <div>
                    <h3>Model Answer Used</h3>
                    <pre>{result.modelAnswer}</pre>
                  </div>
                )}
              </section>
            </>
          )}
        </article>
      </section>
    </main>
  );
};

export default App;

