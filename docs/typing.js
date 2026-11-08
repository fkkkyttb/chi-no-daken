(() => {
  const kana = {
    あ: ['a'], い: ['i'], う: ['u', 'wu', 'whu'], え: ['e'], お: ['o'],
    か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
    さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
    た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
    な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
    は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
    ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
    や: ['ya'], ゆ: ['yu'], よ: ['yo'],
    ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
    わ: ['wa'], ゐ: ['wi'], ゑ: ['we'], を: ['wo'],
    が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
    ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
    だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
    ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
    ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
    ゔ: ['vu'], ん: ['nn', "n'", 'xn'], っ: ['xtu', 'ltu', 'xtsu', 'ltsu'],
    ぁ: ['xa', 'la'], ぃ: ['xi', 'li', 'xyi', 'lyi'], ぅ: ['xu', 'lu'],
    ぇ: ['xe', 'le', 'xye', 'lye'], ぉ: ['xo', 'lo'],
    ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'],
    ゎ: ['xwa', 'lwa'], ゕ: ['xka', 'lka'], ゖ: ['xke', 'lke'],
  };

  const pairs = {
    きゃ: ['kya'], きゅ: ['kyu'], きょ: ['kyo'],
    ぎゃ: ['gya'], ぎゅ: ['gyu'], ぎょ: ['gyo'],
    しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しょ: ['sho', 'syo'],
    じゃ: ['ja', 'jya', 'zya'], じゅ: ['ju', 'jyu', 'zyu'], じょ: ['jo', 'jyo', 'zyo'],
    ちゃ: ['cha', 'tya', 'cya'], ちゅ: ['chu', 'tyu', 'cyu'], ちょ: ['cho', 'tyo', 'cyo'],
    ぢゃ: ['dya'], ぢゅ: ['dyu'], ぢょ: ['dyo'],
    にゃ: ['nya'], にゅ: ['nyu'], にょ: ['nyo'],
    ひゃ: ['hya'], ひゅ: ['hyu'], ひょ: ['hyo'],
    びゃ: ['bya'], びゅ: ['byu'], びょ: ['byo'],
    ぴゃ: ['pya'], ぴゅ: ['pyu'], ぴょ: ['pyo'],
    みゃ: ['mya'], みゅ: ['myu'], みょ: ['myo'],
    りゃ: ['rya'], りゅ: ['ryu'], りょ: ['ryo'],
    いぇ: ['ye'], うぁ: ['wha'], うぃ: ['wi', 'whi'], うぇ: ['we', 'whe'], うぉ: ['who'],
    しぇ: ['she', 'sye'], じぇ: ['je', 'jye', 'zye'], ちぇ: ['che', 'tye', 'cye'],
    くぁ: ['kwa', 'qwa', 'qa'], くぃ: ['kwi', 'qwi', 'qi'], くぇ: ['kwe', 'qwe', 'qe'],
    くぉ: ['kwo', 'qwo', 'qo'], くゎ: ['kwa'], ぐゎ: ['gwa'],
    ぐぁ: ['gwa'], ぐぃ: ['gwi'], ぐぇ: ['gwe'], ぐぉ: ['gwo'],
    つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
    てぃ: ['thi'], てゅ: ['thu'], でぃ: ['dhi'], でゅ: ['dhu'],
    とぅ: ['twu'], どぅ: ['dwu'], すぃ: ['swi'], ずぃ: ['zwi'],
    ふぁ: ['fa', 'fwa'], ふぃ: ['fi', 'fwi'], ふぇ: ['fe', 'fwe'], ふぉ: ['fo', 'fwo'],
    ふゃ: ['fya'], ふゅ: ['fyu'], ふょ: ['fyo'],
    ゔぁ: ['va'], ゔぃ: ['vi'], ゔぇ: ['ve'], ゔぉ: ['vo'],
    ゔゃ: ['vya'], ゔゅ: ['vyu'], ゔょ: ['vyo'],
  };

  const punctuation = { '、': ',', '。': '.', '！': '!', '？': '?', 'ー': '-', '・': '/' };

  function tokenize(reading) {
    const chars = [...reading.normalize('NFKC').replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60))];
    const tokens = [];

    for (let index = 0; index < chars.length; index += 1) {
      const first = chars[index];
      const second = chars[index + 1];
      const pair = first + second;

      if (pairs[pair]) {
        const separate = kana[first].flatMap((base) => kana[second].map((small) => base + small));
        tokens.push({ char: pair, keys: [...pairs[pair], ...separate] });
        index += 1;
      } else if (kana[first]) {
        tokens.push({ char: first, keys: kana[first] });
      } else if (punctuation[first] || /^[!?,.\/-]$/.test(first)) {
        tokens.push({ char: first, keys: [punctuation[first] ?? first] });
      } else {
        throw new Error(`Unsupported character in typing reading: ${first}`);
      }
    }

    return tokens;
  }

  function buildPaths(tokens) {
    return tokens.map(({ char, keys }, index) => {
      const next = tokens[index + 1];
      const options = keys.map((keys) => ({ keys, next: index + 1 }));

      // A lone n is ambiguous before vowels and y, so those require an explicit ending.
      if (char === 'ん' && next && !/^[aiueoy]/.test(next.keys[0])) {
        options.unshift({ keys: 'n', next: index + 1 });
      }

      if (char === 'っ') {
        let followingIndex = index + 1;
        while (tokens[followingIndex]?.char === 'っ') {
          followingIndex += 1;
        }

        const following = tokens[followingIndex];
        const repeated = following?.keys.flatMap((keys) => {
          if (!/^[bcdfghjklmpqrstvwxyz]/.test(keys)) return [];

          const count = followingIndex - index;
          const initials = keys.startsWith('ch') ? ['c', 't'] : [keys[0]];
          return initials.map((initial) => ({ keys: initial.repeat(count) + keys, next: followingIndex + 1 }));
        });

        return [...(repeated ?? []), ...options];
      }

      return options;
    });
  }

  function create(reading) {
    const paths = buildPaths(tokenize(reading));
    const end = paths.length;
    const previews = [''];

    previews[end] = '';
    for (let index = end - 1; index >= 0; index -= 1) {
      const first = paths[index][0];
      previews[index] = first.keys + previews[first.next];
    }

    let frontier = [{ pending: '', next: 0 }];
    let typed = '';
    let errors = 0;
    let complete = end === 0;

    function input(key) {
      if (complete || typeof key !== 'string') return 'ignored';

      const char = punctuation[key] ?? key.toLowerCase();
      if (!/^[\x21-\x7e]$/.test(char)) return 'ignored';

      const matches = new Map();
      for (const state of frontier) {
        const options = state.pending ? [{ keys: state.pending, next: state.next }] : paths[state.next];
        for (const option of options) {
          if (option.keys[0] !== char) continue;
          const pending = option.keys.slice(1);
          const id = `${option.next}:${pending}`;
          if (!matches.has(id)) matches.set(id, { pending, next: option.next });
        }
      }

      if (!matches.size) {
        errors += 1;
        return 'incorrect';
      }

      frontier = [...matches.values()];
      typed += char;
      complete = frontier.some((state) => !state.pending && state.next === end);
      return 'correct';
    }

    function getState() {
      const first = frontier[0];
      const remaining = complete ? '' : first.pending + previews[first.next];
      return {
        typed,
        remaining,
        progress: complete ? 1 : typed.length / (typed.length + remaining.length),
        complete,
        correct: typed.length,
        errors,
      };
    }

    return { input, getState };
  }

  window.YofukashiTyping = { create };
})();
