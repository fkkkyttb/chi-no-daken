(() => {
  "use strict";

  const genres = { all: "すべて", history: "歴史", science: "科学", culture: "文化", news: "ニュース" };
  const get = (id) => document.getElementById(id);
  const filters = [...document.querySelectorAll("[data-genre]")];
  const elements = {
    title: get("lesson-title"), genre: get("lesson-genre"), date: get("lesson-date"),
    count: get("chapter-count"), dots: get("chapter-dots"), content: get("lesson-content"),
    surface: get("typing-surface"), input: get("typing-input"), passage: get("passage"),
    hint: get("typing-hint"), typed: get("typed"), nextCharacter: get("next-character"),
    remaining: get("remaining"), result: get("lesson-result"), resultNotes: get("result-notes"),
    resultHeading: get("result-heading"), source: get("lesson-source"), next: get("next"), topicCount: get("topic-count"),
    speed: get("speed"), accuracy: get("accuracy"), elapsed: get("elapsed"), sound: get("sound"),
    records: get("records"), summary: get("records-summary"), recordList: get("record-list"),
  };
  const storageKey = "chi-no-daken-v1";
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    // The exercise also works when browser storage is unavailable.
  }
  const positiveInteger = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const formatDate = (value) => value.split("-").map(Number).join(".");
  const pad = (number) => String(number).padStart(2, "0");
  const showTime = (seconds) => Math.floor(seconds / 60) + ":" + pad(Math.floor(seconds) % 60);
  const cursors = Object.fromEntries(Object.keys(genres).map((name) => [name, positiveInteger(saved.cursors?.[name])]));
  const history = Array.isArray(saved.history) ? saved.history.slice(0, 30) : [];
  let completed = positiveInteger(saved.completed);
  let sound = saved.sound === true;
  let selectedGenre = Object.hasOwn(genres, saved.genre) ? saved.genre : "all";
  let lesson, engine, activeRound, lineIndex, correct, errors, startedAt, stoppedAt, finished;
  let errorTimeout, audio;

  function store() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cursors, genre: selectedGenre, history, completed, sound }));
    } catch {
      // Keep the current exercise usable even without persistent storage.
    }
  }

  function playTone(success) {
    if (!sound) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === "suspended") void audio.resume().catch(() => {});
      const start = audio.currentTime;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(success ? 420 : 160, start);
      volume.gain.setValueAtTime(0.06, start);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
      tone.connect(volume);
      volume.connect(audio.destination);
      tone.start(start);
      tone.stop(start + 0.06);
    } catch {
      // Audio is optional on devices without Web Audio support.
    }
  }

  function renderSound() {
    elements.sound.setAttribute("aria-pressed", sound);
    get("sound-icon").setAttribute("href", sound ? "#i-sound" : "#i-muted");
  }

  function metrics() {
    const seconds = startedAt === null ? 0 : ((stoppedAt ?? performance.now()) - startedAt) / 1000;
    const speed = (seconds >= 3 || finished) ? Math.round(correct * 60 / Math.max(seconds, 1)) : null;
    const accuracy = correct + errors ? Math.round(correct * 100 / (correct + errors)) : null;
    return { seconds, speed, accuracy };
  }

  function renderMetrics() {
    const { seconds, speed, accuracy } = metrics();
    elements.speed.textContent = speed ?? "–";
    elements.accuracy.textContent = accuracy ?? "–";
    elements.elapsed.textContent = showTime(seconds);
  }

  function renderPosition() {
    const current = Math.min(lineIndex + 1, lesson.lines.length);
    elements.count.textContent = pad(current) + " / " + pad(lesson.lines.length);
    elements.count.setAttribute("aria-label", lesson.lines.length + "文中" + current + "文目");
    elements.dots.replaceChildren(...lesson.lines.map((_, index) => {
      const dot = document.createElement("span");
      dot.className = index < lineIndex ? "done" : index === lineIndex ? "current" : "";
      return dot;
    }));
  }

  function renderTarget() {
    const { typed, remaining } = engine.getState();
    elements.typed.textContent = typed;
    elements.nextCharacter.textContent = remaining.slice(0, 1);
    elements.remaining.textContent = remaining.slice(1);
  }

  function showLine() {
    const { text, reading } = lesson.lines[lineIndex];
    elements.passage.textContent = text;
    engine = window.YofukashiTyping.create(reading);
    elements.input.value = "";
    renderPosition();
    renderTarget();
  }

  function startLesson(round = cursors[selectedGenre]) {
    activeRound = round;
    lesson = window.YofukashiStories.getStory(selectedGenre, activeRound);
    lineIndex = correct = errors = 0;
    startedAt = stoppedAt = null;
    finished = false;
    clearTimeout(errorTimeout);
    elements.surface.classList.remove("has-error");
    elements.title.textContent = lesson.title;
    elements.genre.textContent = genres[lesson.genre];
    elements.genre.dataset.genre = lesson.genre;
    elements.date.hidden = !lesson.date;
    elements.date.dateTime = lesson.date || "";
    elements.date.textContent = lesson.date ? formatDate(lesson.date) : "";
    elements.source.hidden = !lesson.source;
    if (lesson.source) {
      elements.source.href = lesson.source.url;
      elements.source.title = lesson.source.name;
      elements.source.querySelector("span").textContent = "出典 · " + lesson.source.name;
    } else {
      elements.source.removeAttribute("href");
    }
    elements.content.hidden = false;
    elements.result.hidden = true;
    elements.next.classList.remove("primary");
    elements.hint.querySelector("span").textContent = matchMedia("(pointer: coarse)").matches
      ? "文章欄をタップし、英字キーボードで入力"
      : "半角英数で入力するとスタート";
    filters.forEach((button) => button.setAttribute("aria-pressed", button.dataset.genre === selectedGenre));
    elements.topicCount.textContent = window.YofukashiStories.counts[selectedGenre] + " テーマ";
    showLine();
    renderMetrics();
  }

  function nextLesson() {
    cursors[selectedGenre] = activeRound + 1;
    store();
    startLesson();
  }

  function finishLesson() {
    finished = true;
    stoppedAt = performance.now();
    const { speed, accuracy } = metrics();
    history.unshift({ title: lesson.title, genre: lesson.genre, speed, accuracy, date: new Date().toISOString() });
    history.splice(30);
    completed += 1;
    cursors[selectedGenre] = activeRound + 1;
    store();
    elements.content.hidden = true;
    elements.result.hidden = false;
    elements.next.classList.add("primary");
    elements.resultNotes.replaceChildren(...lesson.lines.map(({ text }) => {
      const line = document.createElement("li");
      line.textContent = text;
      return line;
    }));
    elements.resultHeading.textContent = "このテーマを読み終えました";
    elements.resultHeading.focus({ preventScroll: true });
    renderPosition();
  }

  function enterKey(key) {
    if (finished || elements.records.open) return false;
    const result = engine.input(key);
    if (result === "ignored") return false;
    if (startedAt === null) {
      startedAt = performance.now();
      if (!matchMedia("(pointer: coarse)").matches) {
        elements.hint.querySelector("span").textContent = "Esc でこのテーマをやり直す";
      }
    }
    playTone(result === "correct");
    if (result === "incorrect") {
      errors += 1;
      elements.surface.classList.add("has-error");
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => elements.surface.classList.remove("has-error"), 240);
    } else {
      correct += 1;
      elements.surface.classList.remove("has-error");
      if (engine.getState().complete) {
        lineIndex += 1;
        if (lineIndex === lesson.lines.length) finishLesson();
        else showLine();
      } else {
        renderTarget();
      }
    }
    renderMetrics();
    return true;
  }

  document.addEventListener("keydown", (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || elements.records.open) return;
    if (event.key === "Escape" && (startedAt !== null || finished)) {
      event.preventDefault();
      startLesson(activeRound);
      return;
    }
    const target = event.target;
    const isOtherControl = target !== elements.input && target instanceof Element &&
      target.closest("button, a, input, textarea, select, [contenteditable]");
    if (isOtherControl && (event.key === "Enter" || event.key === " ")) return;
    if (finished && event.key === "Enter") {
      event.preventDefault();
      nextLesson();
      return;
    }
    if (event.key.length === 1 && enterKey(event.key)) event.preventDefault();
  });

  elements.input.addEventListener("input", (event) => {
    if (event.isComposing) return;
    const key = event.data ?? elements.input.value;
    if (event.inputType === "insertText" && key.length === 1) enterKey(key);
    elements.input.value = "";
  });
  elements.input.addEventListener("compositionend", () => {
    elements.input.value = "";
  });
  elements.surface.addEventListener("click", () => elements.input.focus({ preventScroll: true }));
  get("restart").addEventListener("click", () => startLesson(activeRound));
  elements.next.addEventListener("click", nextLesson);
  filters.forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.genre === selectedGenre) return;
    selectedGenre = button.dataset.genre;
    store();
    startLesson();
  }));

  get("open-records").addEventListener("click", () => {
    elements.summary.textContent = completed ? "読了したテーマ " + completed + " 件" : "テーマを読み終えると、ここに記録されます。";
    elements.recordList.replaceChildren(...history.map((record) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const scores = document.createElement("span");
      title.textContent = record.title;
      scores.textContent = [genres[record.genre], record.speed + " 打 / 分", "正確率 " + record.accuracy + "%"].join(" · ");
      item.append(title, scores);
      return item;
    }));
    elements.records.showModal();
  });
  elements.sound.addEventListener("click", () => {
    sound = !sound;
    renderSound();
    if (sound) playTone(true);
    store();
  });

  renderSound();
  startLesson();
  setInterval(() => {
    if (startedAt !== null && !finished) renderMetrics();
  }, 250);
})();
