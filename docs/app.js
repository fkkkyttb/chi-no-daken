(() => {
  "use strict";

  const genres = { all: "すべて", history: "歴史", science: "科学", culture: "文化", news: "ニュース", vocab: "語彙" };
  const catalog = window.YofukashiStories;
  const sessionPlanner = window.YofukashiSession;
  const wordsByName = new Map(window.YofukashiVocabulary.map((card) => [card.word, card]));
  const get = (id) => document.getElementById(id);
  const filters = [...document.querySelectorAll("[data-genre]")];
  const elements = {
    header: get("lesson-header"), title: get("lesson-title"), genre: get("lesson-genre"), date: get("lesson-date"), reading: get("lesson-reading"),
    count: get("chapter-count"), dots: get("chapter-dots"), content: get("lesson-content"),
    surface: get("typing-surface"), input: get("typing-input"), passage: get("passage"),
    hint: get("typing-hint"), typed: get("typed"), nextCharacter: get("next-character"),
    remaining: get("remaining"), result: get("lesson-result"), resultNotes: get("result-notes"),
    resultHeading: get("result-heading"), resultSummary: get("result-summary"), resultWords: get("result-words"),
    resultVocabulary: get("result-vocabulary"), source: get("lesson-source"), topicCount: get("topic-count"),
    next: get("next"), nextLabel: get("next-label"), nextIcon: get("next-icon"), restart: get("restart"),
    estimate: get("session-estimate"), position: get("session-position"), sessionCount: get("session-count"), progress: get("session-progress"),
    speed: get("speed"), accuracy: get("accuracy"), elapsed: get("elapsed"), sound: get("sound"),
    records: get("records"), summary: get("records-summary"), recordList: get("record-list"),
    savedVocabulary: get("saved-vocabulary"), savedVocabularyLabel: get("saved-vocabulary-label"), savedVocabularyList: get("saved-vocabulary-list"),
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
  const vocabCursors = Object.fromEntries(Object.keys(genres).map((name) => [name, positiveInteger(saved.vocabCursors?.[name])]));
  const history = Array.isArray(saved.history) ? saved.history.filter((record) => record?.title).slice(0, 30) : [];
  const completed = positiveInteger(saved.completed);
  let completedSessions = positiveInteger(saved.completedSessions);
  const learnedWords = new Set(Array.isArray(saved.learnedWords) ? saved.learnedWords.filter((word) => wordsByName.has(word)) : []);
  let sound = saved.sound === true;
  let selectedGenre = Object.hasOwn(genres, saved.genre) ? saved.genre : "all";
  let session, lesson, engine;
  let errorTimeout, audio;

  function store() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        cursors, vocabCursors, genre: selectedGenre, history, completed, completedSessions, learnedWords: [...learnedWords], sound,
      }));
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

  function syncClock() {
    const shouldRun = session.status === "running" && !document.hidden && !elements.records.open;
    if (shouldRun && session.since === null) {
      session.since = performance.now();
    } else if (!shouldRun && session.since !== null) {
      session.milliseconds += performance.now() - session.since;
      session.since = null;
    }
  }

  function metrics() {
    const { milliseconds, since, correct, errors, status } = session;
    const seconds = (milliseconds + (since === null ? 0 : performance.now() - since)) / 1000;
    const speed = seconds >= 3 || status === "finished" ? Math.round(correct * 60 / Math.max(seconds, 1)) : null;
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
    const current = session.lineIndex + 1;
    elements.count.textContent = pad(current) + " / " + pad(lesson.lines.length);
    elements.count.setAttribute("aria-label", lesson.lines.length + "文中" + current + "文目");
    elements.dots.replaceChildren(...lesson.lines.map((_, index) => {
      const dot = document.createElement("span");
      dot.className = index < session.lineIndex ? "done" : index === session.lineIndex ? "current" : "";
      return dot;
    }));
  }

  function renderSessionProgress() {
    const { plan, completedLines, cardIndex, status } = session;
    elements.estimate.textContent = status === "finished" ? "読了" : "目安 約" + plan.minutes + "分";
    elements.position.textContent = (cardIndex + 1) + " / " + plan.cards.length + " 題";
    elements.sessionCount.textContent = completedLines + " / " + plan.lineCount;
    elements.progress.max = plan.lineCount;
    elements.progress.value = completedLines;
  }

  function renderTarget() {
    const { typed, remaining } = engine.getState();
    elements.typed.textContent = typed;
    elements.nextCharacter.textContent = remaining.slice(0, 1);
    elements.remaining.textContent = remaining.slice(1);
  }

  function showLine() {
    const { text, reading } = lesson.lines[session.lineIndex];
    elements.passage.textContent = text;
    engine = window.YofukashiTyping.create(reading);
    elements.input.value = "";
    renderPosition();
    renderTarget();
  }

  function showLesson() {
    lesson = session.plan.cards[session.cardIndex];
    session.lineIndex = 0;
    elements.title.textContent = lesson.word || lesson.title;
    elements.genre.textContent = genres[lesson.genre];
    elements.genre.dataset.genre = lesson.genre;
    elements.reading.hidden = !lesson.kana;
    elements.reading.textContent = lesson.kana || "";
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
    showLine();
    renderSessionProgress();
  }

  function renderControls() {
    const { status } = session;
    const paused = status === "paused";
    const finished = status === "finished";
    const running = status === "running";
    elements.input.disabled = paused;
    elements.surface.classList.toggle("is-paused", paused);
    elements.restart.hidden = !running && !paused;
    elements.header.hidden = elements.content.hidden = finished;
    elements.result.hidden = !finished;
    elements.next.classList.toggle("primary", paused || finished);
    elements.nextLabel.textContent = { ready: "別のセット", running: "一時停止", paused: "練習を再開", finished: "次のセッション" }[status];
    elements.nextIcon.setAttribute("href", running ? "#i-pause" : paused ? "#i-play" : "#i-next");
    const hint = elements.hint.querySelector("span");
    const touch = matchMedia("(pointer: coarse)").matches;
    if (paused) hint.textContent = "一時停止中";
    else if (running) hint.textContent = touch ? "文章欄をタップして入力" : "Esc で一時停止";
    else hint.textContent = touch ? "文章欄をタップし、英字キーボードで入力" : "半角英数で入力するとスタート";
  }

  function startSession() {
    const plan = sessionPlanner.create(selectedGenre, {
      fact: cursors[selectedGenre], vocab: vocabCursors[selectedGenre],
    }, sessionPlanner.estimateSpeed(history));
    session = {
      plan, status: "ready", cardIndex: 0, lineIndex: 0, completedLines: 0,
      correct: 0, errors: 0, milliseconds: 0, since: null,
    };
    clearTimeout(errorTimeout);
    elements.surface.classList.remove("has-error");
    filters.forEach((button) => button.setAttribute("aria-pressed", button.dataset.genre === selectedGenre));
    const factLabel = selectedGenre === "vocab" ? "" : catalog.counts[selectedGenre] + " 題・";
    elements.topicCount.textContent = factLabel + "語彙 " + catalog.vocabularyCounts[selectedGenre] + " 語";
    showLesson();
    renderControls();
    renderMetrics();
  }

  function advanceCursors() {
    cursors[selectedGenre] = session.plan.next.fact;
    vocabCursors[selectedGenre] = session.plan.next.vocab;
  }

  function makeReview(title) {
    const detail = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = title;
    detail.append(summary);
    return detail;
  }

  function vocabularyReview({ word, kana, meaning }) {
    const detail = makeReview(word + "（" + kana + "）");
    const explanation = document.createElement("p");
    explanation.textContent = meaning;
    detail.append(explanation);
    return detail;
  }

  function lessonReview(card) {
    const detail = makeReview(card.title);
    const lines = document.createElement("ul");
    lines.append(...card.lines.map(({ text }) => {
      const line = document.createElement("li");
      line.textContent = text;
      return line;
    }));
    detail.append(lines);
    if (card.source) {
      const link = document.createElement("a");
      link.href = card.source.url;
      link.textContent = "出典を読む · " + card.source.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      detail.append(link);
    }
    return detail;
  }

  function finishSession() {
    session.status = "finished";
    syncClock();
    const { seconds, speed, accuracy } = metrics();
    const { cards, lineCount } = session.plan;
    const vocabulary = cards.filter((card) => card.genre === "vocab");
    vocabulary.forEach((card) => learnedWords.add(card.word));
    history.unshift({
      title: cards[0].title, type: "session", genre: selectedGenre, speed, accuracy,
      seconds: Math.floor(seconds), topics: cards.length, words: vocabulary.length, date: new Date().toISOString(),
    });
    history.splice(30);
    completedSessions += 1;
    advanceCursors();
    store();
    elements.source.hidden = true;
    elements.resultSummary.textContent = cards.length + "題・" + lineCount + "文を完了しました。";
    elements.resultWords.hidden = !vocabulary.length;
    elements.resultVocabulary.replaceChildren(...vocabulary.map(vocabularyReview));
    elements.resultNotes.replaceChildren(...cards.map(lessonReview));
    renderSessionProgress();
    renderControls();
    elements.resultHeading.focus();
  }

  function togglePause() {
    session.status = session.status === "paused" ? "running" : "paused";
    syncClock();
    renderControls();
    renderMetrics();
  }

  function handleMainAction() {
    if (session.status === "running" || session.status === "paused") {
      togglePause();
      return;
    }
    if (session.status === "ready") {
      advanceCursors();
      store();
    }
    startSession();
  }

  function enterKey(key) {
    if (session.status === "finished" || session.status === "paused" || elements.records.open) return false;
    const result = engine.input(key);
    if (result === "ignored") return false;
    if (session.status === "ready") {
      session.status = "running";
      syncClock();
      renderControls();
    }
    playTone(result === "correct");
    if (result === "incorrect") {
      session.errors += 1;
      elements.surface.classList.add("has-error");
      clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => elements.surface.classList.remove("has-error"), 240);
    } else {
      session.correct += 1;
      elements.surface.classList.remove("has-error");
      if (engine.getState().complete) {
        session.completedLines += 1;
        if (session.completedLines === session.plan.lineCount) {
          finishSession();
        } else if (session.lineIndex + 1 === lesson.lines.length) {
          session.cardIndex += 1;
          showLesson();
        } else {
          session.lineIndex += 1;
          showLine();
          renderSessionProgress();
        }
      } else {
        renderTarget();
      }
    }
    renderMetrics();
    return true;
  }

  document.addEventListener("keydown", (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || elements.records.open) return;
    if (event.key === "Escape" && !event.repeat && ["running", "paused"].includes(session.status)) {
      event.preventDefault();
      togglePause();
      return;
    }
    const target = event.target;
    const isOtherControl = target !== elements.input && target instanceof Element &&
      target.closest("button, a, input, textarea, select, summary, [contenteditable]");
    if (isOtherControl && (event.key === "Enter" || event.key === " ")) return;
    if (session.status === "finished" && event.key === "Enter") {
      event.preventDefault();
      startSession();
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
  elements.restart.addEventListener("click", startSession);
  elements.next.addEventListener("click", handleMainAction);
  filters.forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.genre === selectedGenre) return;
    selectedGenre = button.dataset.genre;
    store();
    startSession();
  }));

  get("open-records").addEventListener("click", () => {
    const totals = [];
    if (completedSessions) totals.push("完了したセッション " + completedSessions + " 回");
    if (completed) totals.push("以前に読了したテーマ " + completed + " 題");
    elements.summary.textContent = totals.join(" · ") || "練習を完了すると、ここに記録されます。";
    elements.savedVocabulary.hidden = !learnedWords.size;
    elements.savedVocabularyLabel.textContent = "語彙帳 · " + learnedWords.size + " 語";
    elements.savedVocabularyList.replaceChildren(...[...learnedWords].reverse().map((word) => vocabularyReview(wordsByName.get(word))));
    elements.recordList.replaceChildren(...history.map((record) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const scores = document.createElement("span");
      title.textContent = record.type === "session" ? genres[record.genre] + "の練習 · " + record.topics + " 題" : record.title;
      const details = [record.speed + " 打 / 分", "正確率 " + record.accuracy + "%"];
      if (record.type === "session") details.unshift(showTime(record.seconds), "語彙 " + record.words + " 語");
      else details.unshift(genres[record.genre]);
      scores.textContent = details.join(" · ");
      item.append(title, scores);
      return item;
    }));
    elements.records.showModal();
    syncClock();
  });
  elements.records.addEventListener("close", syncClock);
  document.addEventListener("visibilitychange", syncClock);
  elements.sound.addEventListener("click", () => {
    sound = !sound;
    renderSound();
    if (sound) playTone(true);
    store();
  });

  renderSound();
  startSession();
  setInterval(() => {
    if (session.since !== null) renderMetrics();
  }, 250);
})();
