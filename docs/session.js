(() => {
  "use strict";

  const defaultSpeed = 200;

  function estimateSpeed(history) {
    const recent = history
      .filter((record) => record.type === "session" && Number.isFinite(record.speed) && record.speed > 0)
      .slice(0, 3)
      .map((record) => record.speed)
      .sort((left, right) => left - right);
    if (!recent.length) return defaultSpeed;
    const middle = Math.floor(recent.length / 2);
    const median = recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2;
    return Math.max(90, Math.min(550, median));
  }

  function create(genre, start, speed) {
    const catalog = window.YofukashiStories;
    const cards = [];
    const seen = { fact: new Set(), vocab: new Set() };
    const next = { ...start };
    let keyCount = 0;
    let lineCount = 0;
    const target = 5 * speed;

    while (keyCount < target || cards.length < 2) {
      // Every third card is vocabulary, starting with the second card.
      const isVocabulary = genre === "vocab" || cards.length % 3 === 1;
      const kind = isVocabulary ? "vocab" : "fact";
      const select = isVocabulary ? catalog.getVocabulary : catalog.getStory;
      const count = isVocabulary ? catalog.vocabularyCounts[genre] : catalog.counts[genre];
      let round = next[kind];
      let card = select(genre, round);

      if (seen[kind].size < count) {
        while (seen[kind].has(card)) {
          round += 1;
          card = select(genre, round);
        }
      }

      const cardKeys = card.lines.reduce((total, { reading }) => {
        return total + window.YofukashiTyping.create(reading).getState().remaining.length;
      }, 0);
      if (cards.length >= 2 && Math.abs(target - keyCount) < Math.abs(target - (keyCount + cardKeys))) break;

      cards.push(card);
      seen[kind].add(card);
      keyCount += cardKeys;
      lineCount += card.lines.length;
      next[kind] = round + 1;
    }

    return { cards, lineCount, keyCount, minutes: Math.max(1, Math.round(keyCount / speed)), next };
  }

  window.YofukashiSession = { create, estimateSpeed };
})();
