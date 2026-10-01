"use client"

import { useState } from "react"
import type { Bundle } from "@/lib/bundle"
import type { QuizResponse } from "@/lib/match"

type Props = {
  bundle: Bundle
  response: QuizResponse
  onChange: (r: QuizResponse) => void
  onBack: () => void
  onDone: () => void
}

// One issue per page: its statements, then how much it matters.
export default function Quiz({ bundle, response, onChange, onBack, onDone }: Props) {
  const { dimensions, quiz } = bundle
  // Resume at the first issue that isn't fully answered.
  const [page, setPage] = useState(() => {
    const i = dimensions.findIndex(
      (d) =>
        response.importance[d.id] === undefined ||
        quiz.items.some((it) => it.dimension === d.id && response.answers[it.id] === undefined),
    )
    return i === -1 ? 0 : i
  })
  const dim = dimensions[page]
  const items = quiz.items.filter((i) => i.dimension === dim.id)
  const answered = items.every((i) => response.answers[i.id] !== undefined) && response.importance[dim.id] !== undefined

  const setAnswer = (id: string, value: number) => onChange({ ...response, answers: { ...response.answers, [id]: value } })
  const setImportance = (value: number) =>
    onChange({ ...response, importance: { ...response.importance, [dim.id]: value } })

  const next = () => (page + 1 < dimensions.length ? setPage(page + 1) : onDone())
  const back = () => (page > 0 ? setPage(page - 1) : onBack())

  return (
    <>
      <div className="progress" aria-label={`Issue ${page + 1} of ${dimensions.length}`}>
        <div style={{ width: `${((page + 1) / dimensions.length) * 100}%` }} />
      </div>
      <p className="meta">
        Issue {page + 1} of {dimensions.length}
      </p>

      {items.map((item) => (
        <fieldset key={item.id} className="card" style={{ padding: 0 }}>
          <legend className="bar" style={{ width: "100%", float: "left" }}>
            {dim.label}
          </legend>
          <div className="body" style={{ clear: "both" }}>
            <p style={{ fontSize: 17 }}>{item.text}</p>
          </div>
          {quiz.scale.map((s) => (
            <OvalRow
              key={s.value}
              name={item.id}
              label={s.label}
              checked={response.answers[item.id] === s.value}
              onSelect={() => setAnswer(item.id, s.value)}
            />
          ))}
        </fieldset>
      ))}

      <fieldset className="card" style={{ padding: 0 }}>
        <legend className="bar" style={{ width: "100%", float: "left" }}>
          How much does {dim.label.toLowerCase()} matter to you?
        </legend>
        <div style={{ clear: "both" }} />
        {quiz.importance.map((s) => (
          <OvalRow
            key={s.value}
            name={`importance-${dim.id}`}
            label={s.label}
            checked={response.importance[dim.id] === s.value}
            onSelect={() => setImportance(s.value)}
          />
        ))}
      </fieldset>

      <div className="btns">
        <button className="btn" onClick={back}>
          Back
        </button>
        <button className="btn primary" onClick={next} disabled={!answered}>
          {page + 1 < dimensions.length ? "Next issue" : "Continue"}
        </button>
      </div>
    </>
  )
}

function OvalRow({ name, label, checked, onSelect }: { name: string; label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className="row" style={{ cursor: "pointer" }}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} style={{ position: "absolute", opacity: 0 }} />
      <span className={`oval${checked ? " filled" : ""}`} aria-hidden />
      <span className="name" style={{ textTransform: "none", fontWeight: checked ? 700 : 400 }}>
        {label}
      </span>
    </label>
  )
}
