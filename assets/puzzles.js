/* Optional play controls. Every puzzle, hint and solution is also in the HTML. */
(() => {
  'use strict';

  const result = (ok, text) => ({ ok, text });
  const numbers = card => [...card.querySelectorAll('.puzzle-number-input')].map(input => Number(input.value.trim()));
  const permutation = (values, size) => values.length === size && new Set(values).size === size && values.every(n => Number.isInteger(n) && n >= 1 && n <= size);
  const sum = values => values.reduce((total, n) => total + n, 0);
  const edgeKey = (a, b) => [a, b].sort().join('');

  function selection(card, symbol) {
    const selected = new Set();
    const cells = [...card.querySelectorAll('[data-cell]')];
    function render() {
      cells.forEach(button => {
        const index = Number(button.dataset.cell);
        const active = selected.has(index);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? symbol : '·';
        const size = Math.sqrt(cells.length);
        const state = symbol === '■' ? (active ? 'shaded' : 'unshaded') : (active ? 'owl present' : 'empty');
        button.setAttribute('aria-label', `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}: ${state}`);
      });
    }
    return {
      selected,
      cell(index) {
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        render();
      },
      reset() { selected.clear(); render(); }
    };
  }

  const games = {
    trail(card, report) {
      let path = [];
      const cells = [...card.querySelectorAll('[data-cell]')];
      function render() {
        cells.forEach(button => {
          const index = Number(button.dataset.cell);
          const step = path.indexOf(index);
          button.classList.toggle('is-active', step !== -1);
          button.setAttribute('aria-pressed', String(step !== -1));
          button.textContent = index === 6 ? '×' : step !== -1 ? String(step + 1) : index === 0 ? 'S' : index === 15 ? 'F' : '·';
          button.setAttribute('aria-label', `Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}: ${index === 6 ? 'blocked' : step !== -1 ? `step ${step + 1}` : index === 0 ? 'start' : index === 15 ? 'finish' : 'unvisited'}`);
        });
      }
      function announce() {
        if (!path.length) return report(null, 'The route is empty. Begin at S.');
        const current = path[path.length - 1];
        report(null, `At row ${Math.floor(current / 4) + 1}, column ${current % 4 + 1}. ${path.length} of 15 squares visited.`);
      }
      return {
        cell(index) {
          if (index === 6 || path.includes(index)) return report(false, 'Choose an unvisited open square. Undo lets you take back a step.');
          if (!path.length && index !== 0) return report(false, 'Begin at S, in the top-left corner.');
          if (path.length === 1 && index !== 1) return report(false, 'The first step must go right.');
          if (path.length) {
            const last = path[path.length - 1];
            if (Math.abs(Math.floor(last / 4) - Math.floor(index / 4)) + Math.abs(last % 4 - index % 4) !== 1) return report(false, 'Move to a square sharing an edge with your current square.');
          }
          if (index === 15 && path.length !== 14) return report(false, 'Save F for last: visit all the other open squares first.');
          path.push(index); render(); announce();
        },
        undo() { path.pop(); render(); announce(); },
        reset() { path = []; render(); },
        check() { return result(path.length === 15 && path[14] === 15, path.length === 15 ? 'Solved! Every open square is visited once, with F last.' : `You have visited ${path.length} of 15 open squares. Keep going, or undo a step.`); }
      };
    },

    seats(card) {
      return {
        check() {
          const n = numbers(card);
          if (!permutation(n, 6)) return result(false, 'Use each number from 1 to 6 exactly once.');
          const ok = n[0] % 2 === 0 && sum(n.slice(0, 3)) === 10 && [6, 7, 8].every((total, c) => n[c] + n[c + 3] === total);
          return result(ok, ok ? 'Solved! All three column totals, the top-row total and the even-number clue fit.' : 'Check the column totals, the top-row total of 10, and the even number at the top left.');
        }
      };
    },

    badge(card) {
      const game = selection(card, '■');
      return Object.assign(game, {
        check() {
          const targets = [1, 2, 3, 2, 1];
          const has = (r, c) => Number(game.selected.has(r * 5 + c));
          let ok = true;
          for (let r = 0; r < 5; r += 1) {
            if (sum(targets.map((_, c) => has(r, c))) !== targets[r] || sum(targets.map((_, c) => has(c, r))) !== targets[r]) ok = false;
            for (let c = 0; c < 5; c += 1) if (has(r, c) !== has(r, 4 - c) || has(r, c) !== has(4 - r, c)) ok = false;
          }
          return result(ok, ok ? 'Solved! Both mirror symmetries and all row and column totals match.' : 'Check every row and column total, then check both mirror symmetries.');
        }
      });
    },

    triangle(card) {
      return {
        check() {
          const n = numbers(card);
          if (!permutation(n, 6)) return result(false, 'Use each number from 1 to 6 exactly once.');
          const ok = n[0] + n[1] + n[3] === 10 && n[0] + n[2] + n[5] === 10 && n[3] + n[4] + n[5] === 10;
          return result(ok, ok ? 'Solved! Each side totals 10.' : 'Add the three numbers on each side, including both corners. Each total should be 10.');
        }
      };
    },

    queue(card) {
      return {
        check() {
          const names = [...card.querySelectorAll('[data-position]')].map(select => select.value);
          if (names.includes('') || new Set(names).size !== 5) return result(false, 'Choose each animal exactly once.');
          const pos = name => names.indexOf(name);
          const ok = pos('Owl') === pos('Frog') + 1 && Math.abs(pos('Fox') - pos('Hare')) === 2 && pos('Bear') > pos('Hare') && ![0, 4].includes(pos('Frog')) && ![0, 4].includes(pos('Bear'));
          return result(ok, ok ? 'Solved! All the clues fit this queue.' : 'One or more clues do not fit yet. Check the neighbours, the gap, and the two end positions.');
        }
      };
    },

    sudoku(card) {
      return {
        check() {
          const n = [...card.querySelectorAll('td')].map(td => Number(td.querySelector('[data-given]')?.dataset.given || td.querySelector('input')?.value.trim()));
          let ok = true;
          for (let i = 0; i < 4; i += 1) {
            if (!permutation(n.slice(i * 4, i * 4 + 4), 4) || !permutation([0, 1, 2, 3].map(r => n[r * 4 + i]), 4)) ok = false;
          }
          for (const r of [0, 2]) for (const c of [0, 2]) if (!permutation([n[r * 4 + c], n[r * 4 + c + 1], n[(r + 1) * 4 + c], n[(r + 1) * 4 + c + 1]], 4)) ok = false;
          return result(ok, ok ? 'Solved! Every row, column and 2-by-2 box contains 1, 2, 3 and 4.' : 'Fill every empty square, then check each row, column and 2-by-2 box for repeats.');
        }
      };
    },

    bowls(card, report) {
      let amounts = [2, 3, 7];
      let moves = 0;
      function render() {
        card.querySelectorAll('[data-bowl]').forEach(node => { node.textContent = amounts[Number(node.dataset.bowl)]; });
        card.querySelector('[data-moves]').textContent = `Moves: ${moves} of 2`;
      }
      return {
        action(name) {
          if (name !== 'transfer') return;
          const from = card.querySelector('[data-bowl-from]').value;
          const to = card.querySelector('[data-bowl-to]').value;
          if (from === '' || to === '' || from === to) return report(false, 'Choose two different bowls.');
          if (moves === 2) return report(false, 'Both moves have been used. Check your answer or reset.');
          const amount = amounts[Number(to)];
          if (!amount || amounts[Number(from)] < amount) return report(false, 'The destination must contain tokens, and the source must have enough to double it.');
          amounts[Number(from)] -= amount; amounts[Number(to)] += amount; moves += 1; render();
          report(null, `Move ${moves} of 2. Bowls A, B, C: ${amounts.join(', ')} tokens.`);
        },
        reset() { amounts = [2, 3, 7]; moves = 0; render(); },
        check() {
          const ok = moves === 2 && amounts.every(n => n === 4);
          return result(ok, ok ? 'Solved in two moves! Every bowl contains 4 tokens.' : 'The goal is 4 tokens in every bowl after exactly two moves.');
        }
      };
    },

    queens(card) {
      const game = selection(card, '●');
      return Object.assign(game, {
        check() {
          const cells = [...game.selected];
          if (cells.length !== 4) return result(false, `Place exactly four owls. There are ${cells.length} on the board.`);
          const ok = cells.every((a, i) => cells.slice(i + 1).every(b => {
            const dr = Math.abs(Math.floor(a / 4) - Math.floor(b / 4));
            const dc = Math.abs(a % 4 - b % 4);
            return dr !== 0 && dc !== 0 && dr !== dc;
          }));
          return result(ok, ok ? 'Solved! No two owls share a row, column or diagonal.' : 'At least two owls share a row, column or diagonal. Try moving one.');
        }
      });
    },

    jugs(card, report) {
      let amounts = [0, 0];
      let moves = 0;
      function render() {
        card.querySelectorAll('[data-jug]').forEach(node => { node.textContent = `${amounts[Number(node.dataset.jug)]} L`; });
        card.querySelectorAll('[data-water]').forEach(node => { const i = Number(node.dataset.water); node.style.height = `${100 * amounts[i] / [3, 5][i]}%`; });
        card.querySelector('[data-moves]').textContent = `Moves: ${moves}`;
      }
      return {
        action(name) {
          const before = amounts.join(',');
          if (name === 'fill-small') amounts[0] = 3;
          else if (name === 'fill-large') amounts[1] = 5;
          else if (name === 'empty-small') amounts[0] = 0;
          else if (name === 'empty-large') amounts[1] = 0;
          else if (name === 'pour-small' || name === 'pour-large') {
            const from = name === 'pour-small' ? 0 : 1;
            const to = 1 - from;
            const poured = Math.min(amounts[from], [3, 5][to] - amounts[to]);
            amounts[from] -= poured; amounts[to] += poured;
          } else return;
          if (before === amounts.join(',')) return report(false, 'That action does not change either amount. Try another move.');
          moves += 1; render();
          report(null, `Move ${moves}. 3-litre jug: ${amounts[0]} L; 5-litre jug: ${amounts[1]} L.`);
        },
        reset() { amounts = [0, 0]; moves = 0; render(); },
        check() { return result(amounts[1] === 4, amounts[1] === 4 ? `Solved! The big jug contains 4 litres after ${moves} moves.` : 'Keep going: the 5-litre jug must contain exactly 4 litres.'); }
      };
    },

    routes(card) {
      return {
        check() {
          const ok = card.querySelector('[data-answer]').value.trim() === '4';
          return result(ok, ok ? 'Correct: four routes. Can you list them all?' : 'Count only right-and-down routes that avoid the closed dot. Try listing them.');
        }
      };
    },

    house(card, report) {
      const roads = ['AB', 'AC', 'BD', 'CD', 'CE', 'DE', 'BC'];
      let route = ['B'];
      function used() { return route.slice(1).map((name, i) => edgeKey(route[i], name)); }
      function render() {
        const taken = used();
        card.querySelectorAll('[data-road]').forEach(node => node.classList.toggle('is-used', taken.includes(node.dataset.road)));
        card.querySelectorAll('[data-node]').forEach(node => {
          const current = node.dataset.node === route[route.length - 1];
          node.classList.toggle('is-current', current);
          if (current) node.setAttribute('aria-current', 'location');
          else node.removeAttribute('aria-current');
        });
        card.querySelector('[data-route]').textContent = `Route: ${route.join(' → ')}`;
      }
      function announce() { report(null, `At ${route[route.length - 1]}. ${used().length} of 7 roads used.`); }
      render();
      return {
        node(name) {
          const edge = edgeKey(route[route.length - 1], name);
          if (!roads.includes(edge)) return report(false, 'There is no road from your current point to that point.');
          if (used().includes(edge)) return report(false, 'That road has already been used. Undo if you want to change your route.');
          route.push(name); render(); announce();
        },
        undo() { if (route.length > 1) route.pop(); render(); announce(); },
        reset() { route = ['B']; render(); },
        check() {
          const ok = used().length === 7 && route[route.length - 1] === 'D';
          return result(ok, ok ? 'Solved! All seven roads are used once, from B to D.' : `${used().length} of 7 roads used. Visit each road once and finish at D.`);
        }
      };
    },

    sticks(card) {
      const removed = new Set();
      function render() {
        card.querySelectorAll('[data-stick]').forEach(button => {
          const active = removed.has(button.dataset.stick);
          button.classList.toggle('is-removed', active);
          button.setAttribute('aria-pressed', String(active));
        });
      }
      return {
        stick(name) { if (removed.has(name)) removed.delete(name); else removed.add(name); render(); },
        reset() { removed.clear(); render(); },
        check() {
          if (removed.size !== 2) return result(false, `Remove exactly two sticks. You have removed ${removed.size}.`);
          let small = 0;
          for (let r = 0; r < 2; r += 1) for (let c = 0; c < 2; c += 1) if ([`h${r}${c}`, `h${r + 1}${c}`, `v${r}${c}`, `v${r}${c + 1}`].every(e => !removed.has(e))) small += 1;
          const large = ['h00', 'h01', 'h20', 'h21', 'v00', 'v10', 'v02', 'v12'].every(e => !removed.has(e));
          const ok = small === 1 && large;
          return result(ok, ok ? 'Solved! One small square and the large outside square remain.' : `There are ${small} small squares and ${large ? 1 : 0} large squares left. Aim for one of each.`);
        }
      };
    },

    balance(card, report) {
      let heavy = Math.floor(Math.random() * 9);
      let weighings = 0;
      const history = card.querySelector('[data-weighings]');
      return {
        action(name) {
          if (name !== 'weigh') return;
          if (weighings === 2) return report(false, 'You have used both weighings. Choose your answer, or reset for a new round.');
          const pans = { left: [], right: [] };
          card.querySelectorAll('[data-pebble]').forEach(select => { if (pans[select.value]) pans[select.value].push(Number(select.dataset.pebble)); });
          if (!pans.left.length || pans.left.length !== pans.right.length) return report(false, 'Put the same nonzero number of pebbles on each pan.');
          const outcome = pans.left.includes(heavy) ? 'Left pan is heavier.' : pans.right.includes(heavy) ? 'Right pan is heavier.' : 'The pans balance.';
          weighings += 1;
          const entry = document.createElement('li');
          entry.textContent = `Left: ${pans.left.map(i => i + 1).join(', ')}; right: ${pans.right.map(i => i + 1).join(', ')}. ${outcome}`;
          history.append(entry);
          card.querySelector('[data-moves]').textContent = `Weighings: ${weighings} of 2`;
          report(null, outcome);
        },
        reset() { heavy = Math.floor(Math.random() * 9); weighings = 0; history.replaceChildren(); card.querySelector('[data-moves]').textContent = 'Weighings: 0 of 2'; },
        check() {
          if (weighings !== 2) return result(false, 'Make your two weighings before checking your choice.');
          const guess = card.querySelector('[data-guess]').value;
          if (guess === '') return result(false, 'Choose the pebble you think is heavier.');
          const ok = Number(guess) === heavy;
          return result(ok, ok ? `Correct! Pebble ${heavy + 1} is heavier. Can you explain how the two results identify it?` : 'That pebble is not the heavier one. Revisit your two weighing results, or reset for another round.');
        }
      };
    },

    arrows(card, report) {
      let state = [1, 1, 1, 0, -1, -1, -1];
      let moves = 0;
      function render() {
        card.querySelectorAll('[data-arrow]').forEach(button => {
          const i = Number(button.dataset.arrow);
          button.textContent = state[i] === 0 ? '·' : state[i] === 1 ? '▶' : '◀';
          button.setAttribute('aria-label', `Cell ${i + 1}: ${state[i] === 0 ? 'empty' : state[i] === 1 ? 'right arrow' : 'left arrow'}`);
        });
        card.querySelector('[data-moves]').textContent = `Moves: ${moves}`;
      }
      return {
        arrow(i) {
          const direction = state[i];
          if (!direction) return report(false, 'Choose an arrow to move, rather than the empty cell.');
          let target = i + direction;
          if (state[target] !== 0) {
            target = i + 2 * direction;
            if (state[i + direction] !== -direction || state[target] !== 0) return report(false, 'That arrow cannot move: slide into the gap or jump over one opposite arrow into it.');
          }
          if (target < 0 || target > 6) return report(false, 'The arrow cannot move off the board.');
          state[target] = direction; state[i] = 0; moves += 1; render();
          report(null, `Move ${moves}: ${direction === 1 ? 'right' : 'left'} arrow from cell ${i + 1} to cell ${target + 1}. Cell ${i + 1} is now empty.`);
        },
        reset() { state = [1, 1, 1, 0, -1, -1, -1]; moves = 0; render(); },
        check() { const ok = state.join(',') === '-1,-1,-1,0,1,1,1'; return result(ok, ok ? `Solved in ${moves} moves! Why must a solution take 15 moves?` : 'Swap the two groups, leaving the empty cell in the middle.'); }
      };
    },

    domino(card) {
      return {
        check() {
          const choice = card.querySelector('input[name="domino-answer"]:checked');
          if (!choice) return result(false, 'Choose Yes or No, and think about why.');
          const ok = choice.value === 'no';
          return result(ok, ok ? 'Correct: it is impossible. Can you explain why using the two colours?' : 'Try counting the two colours. What must be true of the squares covered by any set of dominoes?');
        }
      };
    }
  };

  document.querySelectorAll('[data-puzzle]').forEach(card => {
    const status = card.querySelector('.puzzle-status');
    function clear() { status.textContent = ''; status.removeAttribute('data-state'); card.classList.remove('is-solved'); }
    function report(ok, message) {
      status.textContent = message;
      status.dataset.state = ok === true ? 'success' : ok === false ? 'error' : 'info';
      card.classList.toggle('is-solved', ok === true);
    }
    const game = games[card.dataset.puzzle]?.(card, report);
    if (!game) return;
    card.querySelector('.puzzle-controls').hidden = false;
    card.querySelectorAll('button:not([data-blocked])').forEach(button => { button.disabled = false; });
    card.addEventListener('input', clear);
    card.addEventListener('change', clear);
    card.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !card.contains(button) || button.disabled) return;
      clear();
      const action = button.dataset.action;
      if (action === 'check') { const answer = game.check(); report(answer.ok, answer.text); }
      else if (action === 'reset') {
        card.querySelectorAll('input').forEach(input => { if (input.type === 'radio' || input.type === 'checkbox') input.checked = input.defaultChecked; else input.value = input.defaultValue; });
        card.querySelectorAll('select').forEach(select => { select.selectedIndex = 0; });
        game.reset?.();
        report(null, card.dataset.puzzle === 'balance' ? 'A new mystery pebble is ready. You have two weighings.' : 'Reset. Try another approach.');
      } else if (action === 'undo') game.undo?.();
      else if (action) game.action?.(action);
      else if (button.hasAttribute('data-cell')) game.cell?.(Number(button.dataset.cell));
      else if (button.hasAttribute('data-node')) game.node?.(button.dataset.node);
      else if (button.hasAttribute('data-stick')) game.stick?.(button.dataset.stick);
      else if (button.hasAttribute('data-arrow')) game.arrow?.(Number(button.dataset.arrow));
    });
  });
})();
