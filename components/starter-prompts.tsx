"use client";

import { useState } from "react";
import prompts from "@/content/starter-prompts.json";

export default function StarterPrompts() {
  const [selected, setSelected] = useState(prompts[0].id);
  const [feedback, setFeedback] = useState("");
  const prompt = prompts.find((item) => item.id === selected)!;
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setFeedback("Copied. Paste it into your assistant with your files attached.");
    } catch {
      setFeedback("Select the prompt below and copy it manually.");
    }
  }
  return (
    <div className="starter-picker">
      <div className="starter-choices" role="group" aria-label="Choose your task">
        {prompts.map((item, index) => (
          <button key={item.id} type="button" aria-pressed={selected === item.id}
            onClick={() => { setSelected(item.id); setFeedback(""); }}>
            <span className="starter-number">0{index + 1}</span>{item.title}
          </button>
        ))}
      </div>
      <article className="card starter-prompt">
        <h3>{prompt.title}</h3>
        <p className="muted">{prompt.outcome}</p>
        <p className="starter-attach"><strong>Attach</strong> {prompt.attach}</p>
        <label htmlFor="starter-prompt-text" className="label">Your ready-to-copy prompt</label>
        <textarea id="starter-prompt-text" readOnly value={prompt.prompt} spellCheck={false} />
        <button type="button" className="btn" onClick={copy}>Copy prompt <span aria-hidden="true">↗</span></button>
        <p role="status" className="starter-feedback">{feedback}</p>
      </article>
    </div>
  );
}
