// CFG to CNF Converter - Full Step-by-Step Logic

export function parseCFG(input) {
  const rules = {};
  let start = null;
  const lines = input.trim().split('\n').map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    const arrow = line.includes('->') ? '->' : line.includes('→') ? '→' : null;
    if (!arrow) continue;

    const parts = line.split(arrow);
    if (parts.length < 2) continue;

    const lhs = parts[0].trim();
    const rhs = parts.slice(1).join(arrow).trim();
    const nt = lhs.trim();

    if (!start) start = nt;
    if (!rules[nt]) rules[nt] = [];

    const productions = rhs.split('|').map(p => {
      const text = p.trim();

      if (!text) return ['ε'];

      // If user already provided spaces: A B C
      if (/\s/.test(text)) {
        const syms = text.split(/\s+/).filter(Boolean);
        return syms.length ? syms : ['ε'];
      }

      // No spaces: AB -> ["A","B"]
      const tokens = [];
      let i = 0;

      while (i < text.length) {
        const ch = text[i];

        if (/[A-Z]/.test(ch)) {
          let token = ch;
          i++;

          while (
            i < text.length &&
            /[0-9_']/.test(text[i])
          ) {
            token += text[i];
            i++;
          }

          tokens.push(token);
        } else {
          tokens.push(ch);
          i++;
        }
      }

      return tokens.length ? tokens : ['ε'];
    });

    rules[nt].push(...productions);
  }

  return { start, rules };
}

function isTerminal(sym) {
  if (sym === 'ε') return false;
  // A terminal is a single lowercase letter, digit, or common operator
  // NOT a non-terminal (which starts with uppercase)
  if (/^[A-Z]/.test(sym)) return false;
  return sym.length >= 1;
}

function isNonTerminal(sym) {
  return sym !== 'ε' && /^[A-Z][A-Z0-9_']*$/.test(sym);
}

function cloneRules(rules) {
  const r = {};
  for (const [k, prods] of Object.entries(rules)) {
    r[k] = prods.map(p => [...p]);
  }
  return r;
}

function productionsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function addRuleIfNew(rules, nt, prod) {
  if (!rules[nt]) rules[nt] = [];
  if (!rules[nt].some(p => productionsEqual(p, prod))) {
    rules[nt].push([...prod]);
    return true;
  }
  return false;
}

function freshNT(base, existing) {
  // Clean base: remove invalid characters
  let cleanBase = base.replace(/[^A-Z0-9_']/gi, '').toUpperCase();
  if (!cleanBase) cleanBase = 'NT';
  let name = cleanBase;
  let i = 1;
  while (existing.has(name)) {
    name = cleanBase + i;
    i++;
  }
  return name;
}

/** Step 1: Add new start symbol */
export function stepAddStart(grammar) {
  const { start, rules } = grammar;

  // Check whether start symbol appears on any RHS
  let appearsOnRHS = false;

  for (const prods of Object.values(rules)) {
    for (const prod of prods) {
      if (prod.includes(start)) {
        appearsOnRHS = true;
        break;
      }
    }
    if (appearsOnRHS) break;
  }

  if (!appearsOnRHS) {
    return {
      grammar,
      changes: [
        `Start symbol '${start}' does not appear on any RHS. No new start symbol needed.`
      ],
      description:
        'New start symbol is only added when the original start symbol appears on the right-hand side.'
    };
  }

  const allNTs = new Set(Object.keys(rules));
  const newStart = freshNT(start + '0', allNTs);

  const newRules = {
    [newStart]: [[start]],
    ...cloneRules(rules)
  };

  return {
    grammar: { start: newStart, rules: newRules },
    changes: [`Added new start symbol '${newStart}' → ${start}`],
    description:
      'Original start symbol appears on RHS, so a new start symbol was added.'
  };
}

/** Step 2: Eliminate ε-productions */
export function stepEliminateEpsilon(grammar) {
  const { start, rules } = grammar;
  let current = cloneRules(rules);
  const changes = [];

  // Find all nullable non-terminals
  const nullable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [nt, prods] of Object.entries(current)) {
      if (nullable.has(nt)) continue;
      if (prods.some(p => p.length === 1 && p[0] === 'ε')) {
        nullable.add(nt);
        changes.push(`'${nt}' is nullable (direct ε-production)`);
        changed = true;
      } else if (prods.some(p => p.length > 0 && p.every(s => nullable.has(s)))) {
        nullable.add(nt);
        changes.push(`'${nt}' is nullable (all symbols in a production are nullable)`);
        changed = true;
      }
    }
  }

  if (nullable.size === 0) {
    return {
      grammar: { start, rules: current },
      changes: ['No nullable non-terminals found. No ε-productions to eliminate.'],
      description: 'Eliminate ε-productions: find nullable NTs, add productions with nullable symbols omitted, then remove ε-rules.'
    };
  }

  const newRules = cloneRules(current);

  for (const [nt, prods] of Object.entries(current)) {
    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') continue;
      const nullablePositions = [];
      prod.forEach((s, i) => { if (nullable.has(s)) nullablePositions.push(i); });
      const count = nullablePositions.length;
      if (count === 0) continue;
      // Generate all subsets where at least one nullable is removed
      for (let mask = 1; mask < (1 << count); mask++) {
        const newProd = prod.filter((_, i) => {
          const pos = nullablePositions.indexOf(i);
          if (pos === -1) return true;
          return !((mask >> pos) & 1);
        });
        if (newProd.length === 0) continue; // would become ε — handle separately
        if (addRuleIfNew(newRules, nt, newProd)) {
          const removed = prod.filter((_, i) => {
            const pos = nullablePositions.indexOf(i);
            return pos !== -1 && ((mask >> pos) & 1);
          });
          changes.push(`Added ${nt} → ${newProd.join(' ')} (removed nullable: ${removed.join(', ')} from ${prod.join(' ')})`);
        }
      }
    }
  }

  // Remove ε-productions (keep only for start if start was nullable)
  for (const nt of Object.keys(newRules)) {
    const wasNullable = nullable.has(nt);
    newRules[nt] = newRules[nt].filter(p => {
      if (p.length === 1 && p[0] === 'ε') {
        return nt === start; // keep ε only for start symbol
      }
      return true;
    });
    if (wasNullable && nt !== start) {
      changes.push(`Removed ε-production from '${nt}'`);
    }
  }

  return {
    grammar: { start, rules: newRules },
    changes,
    description: 'Eliminate ε-productions: find nullable NTs, add productions with nullable symbols omitted, then remove ε-rules.'
  };
}

/** Step 3: Eliminate unit productions (A → B) */
export function stepEliminateUnit(grammar) {
  const { start, rules } = grammar;
  let current = cloneRules(rules);
  const changes = [];

  // For each NT, compute its unit closure via BFS
  const unitPairs = new Set();
  for (const A of Object.keys(current)) {
    const visited = new Set([A]);
    const queue = [A];
    while (queue.length) {
      const X = queue.shift();
      for (const prod of (current[X] || [])) {
        if (prod.length === 1 && isNonTerminal(prod[0]) && !visited.has(prod[0])) {
          visited.add(prod[0]);
          queue.push(prod[0]);
          unitPairs.add(`${A}|||${prod[0]}`);
          changes.push(`Unit pair found: (${A}, ${prod[0]})`);
        }
      }
    }
  }

  if (unitPairs.size === 0) {
    return {
      grammar: { start, rules: current },
      changes: ['No unit productions found. Nothing to eliminate.'],
      description: 'Eliminate unit productions (A → B where B is a single non-terminal): find unit pairs, copy productions, remove unit rules.'
    };
  }

  const newRules = cloneRules(current);

  for (const pair of unitPairs) {
    const [A, B] = pair.split('|||');
    for (const prod of (current[B] || [])) {
      // Don't copy unit productions (would create cycles)
      if (prod.length === 1 && isNonTerminal(prod[0])) continue;
      if (addRuleIfNew(newRules, A, prod)) {
        changes.push(`Added ${A} → ${prod.join(' ')} (from unit pair (${A}, ${B}))`);
      }
    }
  }

  // Remove all unit productions
  for (const nt of Object.keys(newRules)) {
    const before = newRules[nt].length;
    newRules[nt] = newRules[nt].filter(p => !(p.length === 1 && isNonTerminal(p[0])));
    const after = newRules[nt].length;
    if (before !== after) {
      changes.push(`Removed ${before - after} unit production(s) from '${nt}'`);
    }
  }

  return {
    grammar: { start, rules: newRules },
    changes,
    description: 'Eliminate unit productions: find all unit pairs (A,B) via BFS, copy non-unit productions of B into A, then remove all unit rules.'
  };
}

/** Step 4: Eliminate useless symbols (non-generating + unreachable) */
export function stepEliminateUseless(grammar) {
  const { start, rules } = grammar;
  let current = cloneRules(rules);
  const changes = [];

  // ── Phase 1: Find GENERATING symbols ──────────────────────────────────────
  // A NT is generating if it has at least one production where every symbol
  // is either a terminal or a generating NT.
  // IMPORTANT: Self-recursive NTs ARE generating if they have at least one
  // non-self-referencing path — but we handle that by iterating to fixed point.
  // For purely self-recursive NTs with no base case (e.g. S → S), they are
  // NOT generating. We use Tarjan-like approach: keep iterating until stable.
  
  const generating = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [nt, prods] of Object.entries(current)) {
      if (generating.has(nt)) continue;
      for (const prod of prods) {
        // A production is "potentially generating" if every symbol is:
        // - a terminal, OR
        // - already known to be generating, OR  
        // - the NT itself (self-reference is ok IF other NTs in the prod are generating)
        const allOk = prod.every(s =>
          s === 'ε' ||
          isTerminal(s) ||
          generating.has(s) ||
          s === nt  // self-reference: treat as ok provisionally
        );
        if (allOk) {
          // But verify: a production of ONLY self-references is not a base case
          // e.g. S → S is NOT generating (infinite loop, no derivation to terminal)
          const onlySelf = prod.every(s => s === nt);
          if (!onlySelf) {
            generating.add(nt);
            changed = true;
            break;
          }
        }
      }
    }
  }

  const nonGenerating = Object.keys(current).filter(nt => !generating.has(nt));
  if (nonGenerating.length > 0) {
    changes.push(`Non-generating symbols removed: ${nonGenerating.join(', ')}`);
  }

  // Remove non-generating NTs and productions containing them
  const afterGen = {};
  for (const [nt, prods] of Object.entries(current)) {
    if (!generating.has(nt)) continue;
    const filtered = prods.filter(p =>
      p.every(s => s === 'ε' || isTerminal(s) || generating.has(s))
    );
    if (filtered.length > 0) afterGen[nt] = filtered;
  }

  // ── Phase 2: Find REACHABLE symbols from start ──────────────────────────
  const reachable = new Set([start]);
  const rQueue = [start];
  while (rQueue.length) {
    const X = rQueue.shift();
    for (const prod of (afterGen[X] || [])) {
      for (const sym of prod) {
        if (isNonTerminal(sym) && !reachable.has(sym)) {
          reachable.add(sym);
          rQueue.push(sym);
        }
      }
    }
  }

  const unreachable = Object.keys(afterGen).filter(nt => !reachable.has(nt));
  if (unreachable.length > 0) {
    changes.push(`Unreachable symbols removed: ${unreachable.join(', ')}`);
  }

  const finalRules = {};
  for (const [nt, prods] of Object.entries(afterGen)) {
    if (reachable.has(nt)) finalRules[nt] = prods;
  }

  if (nonGenerating.length === 0 && unreachable.length === 0) {
    changes.push('No useless symbols found. Grammar is unchanged.');
  }

  return {
    grammar: { start, rules: finalRules },
    changes,
    description: 'Eliminate useless symbols: (1) remove non-generating NTs that cannot derive any terminal string, (2) remove unreachable NTs not reachable from the start symbol.'
  };
}

/** Step 5: TERM — Replace terminals in productions of length ≥ 2 */
export function stepTerminals(grammar) {
  const { start, rules } = grammar;
  // Work on a fresh deep clone
  const workRules = cloneRules(rules);
  const changes = [];
  const termMap = {};  // terminal symbol → new NT name
  const allNTs = new Set(Object.keys(workRules));

  // Collect all NTs that already exist before we start adding new ones
  // We need to iterate over a stable snapshot of the original NT keys
  const originalNTs = Object.keys(workRules);

  for (const nt of originalNTs) {
    const prods = workRules[nt];
    for (let pi = 0; pi < prods.length; pi++) {
      const prod = prods[pi];
      if (prod.length < 2) continue; // only touch productions of length ≥ 2

      for (let si = 0; si < prod.length; si++) {
        const sym = prod[si];
        if (!isTerminal(sym)) continue;

        // Create a new NT for this terminal if we haven't yet
        if (!termMap[sym]) {
          const ntName = freshNT('T' + sym.toUpperCase(), allNTs);
          termMap[sym] = ntName;
          allNTs.add(ntName);
          workRules[ntName] = [[sym]];
          changes.push(`Created ${ntName} → ${sym}  (wrapper for terminal '${sym}')`);
        }

        // Replace terminal with its wrapper NT
        const oldSym = prod[si];
        prod[si] = termMap[sym];
        changes.push(`${nt} → [...]: replaced terminal '${oldSym}' with '${termMap[sym]}'`);
      }
    }
  }

  if (changes.length === 0) {
    changes.push('No terminals in productions of length ≥ 2. Nothing to do.');
  }

  return {
    grammar: { start, rules: workRules },
    changes,
    description: 'TERM step: for every production of length ≥ 2, replace each terminal symbol with a new unit non-terminal. E.g., a → TA where TA → a.'
  };
}

/** Step 6: BIN — Break productions with 3+ symbols into binary */
export function stepBinarize(grammar) {
  const { start, rules } = grammar;
  const workRules = cloneRules(rules);
  const changes = [];
  const allNTs = new Set(Object.keys(workRules));
  const binMap = {};  // "B C D..." → new NT

  // Keep breaking until all productions have ≤ 2 symbols
  let anyChange = true;
  while (anyChange) {
    anyChange = false;
    // Snapshot keys at start of each pass (new NTs added this pass will be caught next pass)
    for (const nt of Object.keys(workRules)) {
      const prods = workRules[nt];
      for (let pi = 0; pi < prods.length; pi++) {
        const prod = prods[pi];
        if (prod.length <= 2) continue;

        // Take LAST two symbols → new NT, replacing them
        // This gives left-linear binarization
        const tail = prod.slice(1).join(' ');
        let newNT;

        if (binMap[tail]) {
          newNT = binMap[tail];
        } else {
          newNT = freshNT('X', allNTs);
          allNTs.add(newNT);
          binMap[tail] = newNT;
          workRules[newNT] = [prod.slice(1)];
          changes.push(`Created ${newNT} → ${prod.slice(1).join(' ')}`);
        }

        const oldProd = [...prod];
        prods[pi] = [prod[0], newNT];
        changes.push(`Replaced ${nt} → ${oldProd.join(' ')}  with  ${nt} → ${prods[pi].join(' ')}`);
        anyChange = true;
      }
    }
  }

  if (changes.length === 0) {
    changes.push('All productions already have at most 2 symbols. Nothing to binarize.');
  }

  return {
    grammar: { start, rules: workRules },
    changes,
    description: 'BIN step: break every production with 3 or more symbols into a chain of binary productions by introducing new non-terminals.'
  };
}

/** Run all 6 steps in order */
export function convertToCNF(grammarText) {
  const original = parseCFG(grammarText);
  const steps = [];

  const s0 = stepAddStart(original);
  steps.push({ name: 'Step 1: Add New Start Symbol (START)', ...s0 });

  const s1 = stepEliminateEpsilon(s0.grammar);
  steps.push({ name: 'Step 2: Eliminate ε-Productions (DEL)', ...s1 });

  const s2 = stepEliminateUnit(s1.grammar);
  steps.push({ name: 'Step 3: Eliminate Unit Productions (UNIT)', ...s2 });

  const s3 = stepEliminateUseless(s2.grammar);
  steps.push({ name: 'Step 4: Eliminate Useless Symbols', ...s3 });

  const s4 = stepTerminals(s3.grammar);
  steps.push({ name: 'Step 5: Replace Terminals in Long Rules (TERM)', ...s4 });

  const s5 = stepBinarize(s4.grammar);
  steps.push({ name: 'Step 6: Binarize Long Productions (BIN)', ...s5 });

  return { original, steps, cnf: s5.grammar };
}

export function grammarToString(grammar) {
  const { start, rules } = grammar;
  const lines = [];
  if (rules[start]) {
    lines.push(`${start} → ${rules[start].map(p => p.join(' ')).join(' | ')}`);
  }
  for (const [nt, prods] of Object.entries(rules)) {
    if (nt === start) continue;
    lines.push(`${nt} → ${prods.map(p => p.join(' ')).join(' | ')}`);
  }
  return lines.join('\n');
}

export function isCNF(grammar) {
  const { start, rules } = grammar;
  if (!rules || Object.keys(rules).length === 0) return false;
  for (const [nt, prods] of Object.entries(rules)) {
    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') {
        if (nt !== start) return false;
      } else if (prod.length === 1) {
        if (!isTerminal(prod[0])) return false;
      } else if (prod.length === 2) {
        if (!isNonTerminal(prod[0]) || !isNonTerminal(prod[1])) return false;
      } else {
        return false;
      }
    }
  }
  return true;
}