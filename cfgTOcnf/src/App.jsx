import { useState, useRef } from "react";
import { convertToCNF, grammarToString, isCNF } from "./cnfConverter";
import "./App.css";

const EXAMPLES = [
  {
    label: "Classic S → aSb | SS | ε",
    value: `S -> a S b | S S | ε`,
  },
  {
    label: "Arithmetic Expr",
    value: `S -> S A S | a\nA -> + | - | *`,
  },
  {
    label: "Multi-rule CFG",
    value: `S -> A B | B C\nA -> B a | a\nB -> C C | b\nC -> A B | a`,
  },
  {
    label: "With unit productions",
    value: `S -> A | a b\nA -> B | c\nB -> d`,
  },
];

function GrammarDisplay({ grammar, highlight }) {
  const { start, rules } = grammar;
  return (
    <div className="grammar-box">
      {Object.entries(rules).map(([nt, prods]) => (
        <div
          key={nt}
          className={`grammar-rule ${highlight && highlight.has(nt) ? "rule-new" : ""}`}
        >
          <span className={`nt ${nt === start ? "start-nt" : ""}`}>{nt}</span>
          <span className="arrow"> → </span>
          {prods.map((prod, i) => (
            <span key={i}>
              {i > 0 && <span className="pipe"> | </span>}
              {prod.map((sym, j) => (
                <span
                  key={j}
                  className={
                    sym === "ε"
                      ? "epsilon"
                      : /^[A-Z]/.test(sym)
                      ? "nt"
                      : "terminal"
                  }
                >
                  {sym}{" "}
                </span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepCard({ step, index, isActive, onClick, isCnfCheck }) {
  return (
    <div
      className={`step-card ${isActive ? "step-active" : ""}`}
      onClick={onClick}
    >
      <div className="step-header">
        <div className="step-badge">{index + 1}</div>
        <div className="step-title">{step.name}</div>
        {isCnfCheck && <div className="cnf-badge">✓ CNF</div>}
      </div>
      {isActive && (
        <div className="step-body">
          <p className="step-desc">{step.description}</p>

          <div className="section-label">Changes Made</div>
          <div className="changes-list">
            {step.changes.map((c, i) => (
              <div key={i} className="change-item">
                <span className="change-dot">▸</span>
                <span>{c}</span>
              </div>
            ))}
          </div>

          <div className="section-label">Resulting Grammar</div>
          <GrammarDisplay grammar={step.grammar} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState(EXAMPLES[0].value);
  const [result, setResult] = useState(null);
  const [activeStep, setActiveStep] = useState(null);
  const [error, setError] = useState("");
  const resultRef = useRef(null);

  function handleConvert() {
    setError("");
    try {
      if (!input.trim()) {
        setError("Please enter a grammar.");
        return;
      }
      const res = convertToCNF(input);
      if (!res.original.start) {
        setError("Could not parse grammar. Use format: S -> aB | C | ε");
        return;
      }
      setResult(res);
      setActiveStep(0);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setError("Parse error: " + e.message);
    }
  }

  function handleExample(val) {
    setInput(val);
    setResult(null);
    setActiveStep(null);
    setError("");
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⊢</span>
            <div>
              <div className="logo-title">CFG → CNF</div>
              <div className="logo-sub">Chomsky Normal Form Converter</div>
            </div>
          </div>
          <div className="header-badges">
            <span className="badge">Theory of Automata</span>
            <span className="badge badge-accent">Step-by-Step</span>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Input Panel */}
        <section className="input-section">
          <div className="panel">
            <div className="panel-title">
              <span className="panel-icon">✎</span> Input Grammar
            </div>

            <div className="examples-row">
              <span className="examples-label">Examples:</span>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  className="example-btn"
                  onClick={() => handleExample(ex.value)}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div className="input-hint">
              Format: <code>S → aB | C | ε</code> — one production per line,
              use <code>|</code> for alternatives
            </div>

            <textarea
              className="grammar-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`S -> a S b | S S | ε\nA -> B C | a`}
              rows={6}
              spellCheck={false}
            />

            {error && <div className="error-msg">⚠ {error}</div>}

            <button className="convert-btn" onClick={handleConvert}>
              <span>Convert to CNF</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>

          {/* Legend */}
          <div className="legend">
            <div className="legend-title">Symbol Legend</div>
            <div className="legend-items">
              <div className="legend-item">
                <span className="nt legend-sym">S</span> Non-terminal
              </div>
              <div className="legend-item">
                <span className="terminal legend-sym">a</span> Terminal
              </div>
              <div className="legend-item">
                <span className="epsilon legend-sym">ε</span> Epsilon
              </div>
              <div className="legend-item">
                <span className="start-nt legend-sym">S₀</span> Start symbol
              </div>
            </div>
          </div>

          {/* CNF Rules */}
          <div className="cnf-rules-box">
            <div className="legend-title">CNF Requirements</div>
            <div className="cnf-rule-list">
              <div className="cnf-rule">A → BC (two non-terminals)</div>
              <div className="cnf-rule">A → a (single terminal)</div>
              <div className="cnf-rule">S → ε (only if S is start & ε ∈ L)</div>
            </div>
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className="result-section" ref={resultRef}>
            <div className="panel original-panel">
              <div className="panel-title">
                <span className="panel-icon">◈</span> Original Grammar
              </div>
              <GrammarDisplay grammar={result.original} />
            </div>

            <div className="steps-header">
              <span className="panel-icon">⟳</span> Conversion Steps
              <span className="steps-hint">Click a step to expand</span>
            </div>

            <div className="steps-list">
              {result.steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  index={i}
                  isActive={activeStep === i}
                  onClick={() => setActiveStep(activeStep === i ? null : i)}
                  isCnfCheck={i === result.steps.length - 1 && isCNF(step.grammar)}
                />
              ))}
            </div>

            <div className={`panel final-panel ${isCNF(result.cnf) ? "is-cnf" : "not-cnf"}`}>
              <div className="panel-title">
                <span className="panel-icon">{isCNF(result.cnf) ? "✓" : "⚠"}</span>
                Final Grammar {isCNF(result.cnf) ? "— In CNF ✓" : "— Check Required"}
              </div>
              <GrammarDisplay grammar={result.cnf} />
              {isCNF(result.cnf) && (
                <div className="cnf-success">
                  ✓ This grammar is in Chomsky Normal Form. All productions satisfy CNF constraints.
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        Theory of Automata · CFG to CNF Converter · Steps: START → DEL → UNIT → USELESS → TERM → BIN
      </footer>
    </div>
  );
}