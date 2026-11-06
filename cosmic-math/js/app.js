"use strict";

const LEVELS = {
  1: {
    tables: [2, 3, 4],
    name: "Лунный маршрут",
    boss: "Ледяной гигант",
    color: "#73d7ff"
  },
  2: {
    tables: [5, 6, 7],
    name: "Кольца туманности",
    boss: "Каменный страж",
    color: "#d6a4ff"
  },
  3: {
    tables: [8, 9],
    name: "Кристальная галактика",
    boss: "Кристаллическое ядро",
    color: "#ff9bc3"
  }
};
const COLORS = ["#60c2ff", "#78f0cd", "#ffca64", "#ca97ff"];
function rocketSVG(color) {
  return `<svg viewBox="0 0 120 200">
    <g class="flame">
      <path d="M44 150 Q60 205 76 150 Z" fill="#ffd76a"/>
      <path d="M51 150 Q60 185 69 150 Z" fill="#fff4c2"/>
    </g>
    <path d="M30 118 L10 150 L36 146 Z" fill="#ff8fd8"/>
    <path d="M90 118 L110 150 L84 146 Z" fill="#ff8fd8"/>
    <path d="M60 6 C92 30 96 90 86 150 L34 150 C24 90 28 30 60 6 Z" fill="${color}"/>
    <path d="M60 6 C80 22 88 60 86 110 C70 70 66 40 60 6 Z" fill="#ffffff" opacity=".25"/>
    <circle cx="60" cy="70" r="17" fill="#ffffff"/>
    <circle cx="60" cy="70" r="12" fill="#1b1446"/>
    <circle cx="55" cy="65" r="4" fill="#7fd8ff"/>
    <rect x="40" y="132" width="40" height="8" rx="4" fill="#1b1446" opacity=".25"/>
    <path d="M60 136 L60 160" stroke="#ff8fd8" stroke-width="8" stroke-linecap="round"/>
  </svg>`;
}
const SHIPS = [
  "Синий исследователь", "Ледяной путешественник",
  "Золотой защитник", "Звёздный странник"
];
const KEY = "cosmic-browser-v2";
const $ = id => document.getElementById(id);
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const obj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const validKey = k => typeof k === "string" && /^[2-9]:(?:[1-9]|10)$/.test(k);
const MAX = Number.MAX_SAFE_INTEGER;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function defaults() {
  return {
    version: 2,
    stars: 0, completed: [], ship: 0, mode: "learn",
    settings: {
      music: 25, sound: 60, particles: true,
      flashes: false, shake: false, motion: !reducedMotion
    },
    practice: {
      tick: 0, lastReview: -100, recent: [], decks: {}, stats: {}
    },
    mission: null
  };
}

function validMission(m) {
  if (!obj(m) || !int(m.level, 1, 3)) return false;
  if (!["learn", "challenge"].includes(m.mode)) return false;
  if (!int(m.normal, 0, 15) || !int(m.bosses, 0, 2)) return false;
  if (!int(m.shield, 0, 3) || !int(m.left, 0, m.level + 2)) return false;
  if (!int(m.mistakes, 0, MAX) || !int(m.earned, 0, 30)) return false;
  if (!int(m.seed, 0, 999999)) return false;
  if (!Number.isFinite(m.x) || m.x < 160 || m.x > 700) return false;
  if (!validKey(m.question)) return false;
  if (!LEVELS[m.level].tables.includes(Number(m.question.split(":")[0])))
    return false;
  if (["boss", "helped", "hint"].some(k => typeof m[k] !== "boolean"))
    return false;

  const boss = m.normal > 0 && m.normal % 5 === 0 &&
    m.bosses < m.normal / 5;
  const completedBosses = Math.floor((m.normal - (boss ? 1 : 0)) / 5);

  return m.boss === boss &&
    m.bosses === completedBosses &&
    (boss ? m.left >= 1 : m.left === 0) &&
    m.earned === m.normal + m.bosses * 5;
}

let notice = "";

function load() {
  const d = defaults();
  try {
    const rawText = localStorage.getItem(KEY);
    if (!rawText) return d;
    const r = JSON.parse(rawText);
    if (!obj(r) || r.version !== 2) throw Error("Формат сохранения");

    if (int(r.stars, 0, MAX)) d.stars = r.stars;
    if (Array.isArray(r.completed))
      d.completed = [...new Set(r.completed.filter(n => int(n, 1, 3)))];
    if (int(r.ship, 0, 3) &&
        (r.ship === 0 || d.completed.includes(r.ship)))
      d.ship = r.ship;
    if (["learn", "challenge"].includes(r.mode)) d.mode = r.mode;

    if (obj(r.settings)) {
      for (const k of ["music", "sound"])
        if (int(r.settings[k], 0, 100)) d.settings[k] = r.settings[k];
      for (const k of ["particles", "flashes", "shake", "motion"])
        if (typeof r.settings[k] === "boolean")
          d.settings[k] = r.settings[k];
    }

    const p = r.practice;
    if (obj(p) && int(p.tick, 0, MAX) && int(p.lastReview, -100, p.tick)) {
      d.practice.tick = p.tick;
      d.practice.lastReview = p.lastReview;
      if (Array.isArray(p.recent))
        d.practice.recent = p.recent.filter(validKey).slice(-8);
      if (obj(p.decks)) {
        for (const level of [1, 2, 3]) {
          if (Array.isArray(p.decks[level]))
            d.practice.decks[level] = [...new Set(p.decks[level].filter(
              k => validKey(k) &&
                LEVELS[level].tables.includes(Number(k.split(":")[0]))
            ))];
        }
      }
      if (obj(p.stats)) {
        for (const [k, s] of Object.entries(p.stats)) {
          if (validKey(k) && obj(s) &&
              int(s.errors, 0, MAX) && int(s.weight, 0, 6) &&
              int(s.streak, 0, 2) && int(s.due, 0, MAX))
            d.practice.stats[k] = s;
        }
      }
    }
    if (validMission(r.mission)) d.mission = r.mission;
    else if (r.mission != null)
      notice = "Повреждённая миссия пропущена. Можно начать новую.";
  } catch {
    notice = "Сохранение не прочитано. Можно играть с новым прогрессом.";
  }
  return d;
}

const data = load();
let screen = "menu", settingsBack = "menu";
let answer = "", message = "Введи ответ и нажми OK!";
let messageColor = "#eef4ff";
let freeze = 1, transition = 0, shake = 0;
let time = 0, saveElapsed = 0, hitX = 700;
let particles = [], finished = null, ctx = null;
let audio = null, musicElapsed = 0, musicIndex = 0;
const musicNotes = [261.63,329.63,392,329.63,293.66,349.23,440,349.23];

function unlocked() {
  return Math.min(3, Math.max(1, ...data.completed.map(n => n + 1)));
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    notice = "Сохранение недоступно: прогресс может потеряться после закрытия.";
  }
  $("notice").textContent = notice;
}

// Звук активируется после нажатия пользователя.
function unlockAudio() {
  try {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) return;
    if (!audio) audio = new Constructor();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {}
}
function tone(frequency, delay, duration, volume, type = "sine") {
  if (!audio || audio.state !== "running" || volume <= 0) return;
  try {
    const t = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(t);
    oscillator.stop(t + duration + .01);
  } catch {}
}
function sound(name) {
  const notes = {
    correct: [523.25, 783.99],
    wrong: [246.94, 220],
    hit: [130.81, 98],
    boss: [392, 523.25, 783.99]
  }[name];
  notes.forEach((f, i) => tone(f, i * .11, .16, data.settings.sound / 700));
}

// Очередь заданий и повторение трудных примеров.
function entry(k) {
  return data.practice.stats[k] ||= {errors: 0, weight: 0, streak: 0, due: 0};
}
function dueLater() {
  return data.practice.tick + 4 + Math.floor(Math.random() * 3);
}
function difficult(k, error = true) {
  const s = entry(k);
  if (error) s.errors++;
  s.weight = Math.min(6, s.weight + 1);
  s.streak = 0;
  s.due = dueLater();
}
function solved(k, independent) {
  const s = entry(k);
  if (!s.weight) return;
  s.streak = independent ? s.streak + 1 : 0;
  if (s.streak >= 2) {
    s.weight = 0;
    s.due = 0;
  } else s.due = dueLater();
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function nextQuestion(level) {
  const p = data.practice;
  p.tick++;
  const pool = LEVELS[level].tables.flatMap(a =>
    Array.from({length: 10}, (_, i) => `${a}:${i + 1}`)
  );
  let deck = p.decks[level];
  if (!deck || !deck.length) deck = p.decks[level] = shuffle([...pool]);

  const recent = new Set(p.recent.slice(-3));
  const due = p.tick - p.lastReview >= 3 ? pool.filter(k => {
    const s = entry(k);
    return s.weight > 0 && s.due <= p.tick && !recent.has(k);
  }) : [];

  let selected;
  if (due.length) {
    let r = Math.random() * due.reduce((sum, k) => sum + entry(k).weight, 0);
    selected = due[due.length - 1];
    for (const k of due) {
      r -= entry(k).weight;
      if (r < 0) { selected = k; break; }
    }
    p.lastReview = p.tick;
  } else {
    selected = deck.find(k => !recent.has(k)) ||
      deck.find(k => k !== p.recent[p.recent.length - 1]) || deck[0];
  }

  const index = deck.indexOf(selected);
  if (index >= 0) deck.splice(index, 1);
  p.recent.push(selected);
  p.recent = p.recent.slice(-8);
  return selected;
}

// Миссии.
function spawn() {
  const m = data.mission;
  const wasBoss = m.boss;
  m.boss = m.normal > 0 && m.normal % 5 === 0 &&
    m.bosses < m.normal / 5;
  if (m.boss && m.left <= 0) m.left = m.level + 2;
  if (!m.boss || !wasBoss) m.seed = Math.floor(Math.random() * 1000000);
  m.question = nextQuestion(m.level);
  m.x = 700;
  m.mistakes = 0;
  m.helped = m.hint = false;
  answer = "";
}
function start(level) {
  if (!int(level, 1, unlocked())) return;
  if (data.mission &&
      !confirm("Заменить незавершённую миссию? Собранные звёзды сохранятся."))
    return;

  data.mission = {
    level, mode: data.mode, normal: 0, bosses: 0,
    boss: false, left: 0, shield: 3, question: "",
    x: 700, seed: 0, mistakes: 0, helped: false,
    hint: false, earned: 0
  };
  particles = [];
  transition = shake = 0;
  freeze = 1;
  message = "Введи ответ и нажми OK — корабль выстрелит!";
  messageColor = "#eef4ff";
  spawn();
  go("play");
  save();
}
function resume() {
  const m = data.mission;
  if (!m) return;
  go(m.mode === "challenge" && m.shield <= 0 ? "failed" : "play");
}
function hintText() {
  const [a,b] = data.mission.question.split(":").map(Number);
  if (a <= 5)
    return `${a} × ${b} = ${Array(a).fill(b).join(" + ")} = ${a*b}`;
  return `5 × ${b} = ${5*b}. Ещё ${a-5} × ${b} = ${(a-5)*b}.
    Вместе: ${5*b} + ${(a-5)*b} = ${a*b}.`;
}
function hint() {
  if (screen !== "play" || transition > 0) return;
  const m = data.mission;
  if (!m.helped) difficult(m.question, false);
  m.helped = m.hint = true;
  freeze = Math.max(freeze, 6);
  message = "Посмотрим на пример по частям.";
  messageColor = "#80caff";
  sync();
  save();
}
function digit(n) {
  if (screen !== "play" || transition > 0 || answer.length >= 3) return;
  answer += n;
  sync();
}
function erase() {
  if (screen !== "play" || transition > 0) return;
  answer = answer.slice(0, -1);
  sync();
}
function reward(n) {
  data.stars += n;
  data.mission.earned += n;
}
function burst(x, boss) {
  if (data.settings.shake) shake = .2;
  if (!data.settings.particles) return;
  for (let i = 0; i < (boss ? 38 : 22); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 170;
    particles.push({
      x, y: 180,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: .4 + Math.random() * .5,
      color: boss ? LEVELS[data.mission.level].color : "#ffda82"
    });
  }
}
function submit() {
  if (screen !== "play" || !answer || transition > 0) return;
  const m = data.mission;
  const [a,b] = m.question.split(":").map(Number);

  if (Number(answer) !== a*b) {
    m.mistakes++;
    difficult(m.question);
    answer = "";
    freeze = Math.max(freeze, 2.5);
    message = "Попробуем ещё! Ошибка не отнимает щит.";
    messageColor = "#ffaaaa";
    if (m.mistakes >= 2) {
      m.helped = m.hint = true;
      freeze = Math.max(freeze, 6);
    }
    sound("wrong");
    sync();
    save();
    return;
  }

  solved(m.question, m.mistakes === 0 && !m.helped);
  message = `Верно! ${a} × ${b} = ${a*b}. Отличная работа!`;
  messageColor = "#83edb7";
  hitX = m.x;
  burst(hitX, m.boss);
  let defeated = false;

  if (m.boss) {
    m.left--;
    if (m.left === 0) {
      m.bosses++;
      reward(5);
      defeated = true;
      message = "Босс побеждён! Ты получаешь 5 звёзд!";
    }
  } else {
    m.normal++;
    reward(1);
  }
  sound(defeated ? "boss" : "correct");

  if (m.bosses === 3) {
    const first = !data.completed.includes(m.level);
    if (first) {
      data.completed.push(m.level);
      data.ship = m.level;
    }
    finished = {level: m.level, earned: m.earned, first};
    data.mission = null;
    answer = "";
    transition = 0;
    go("victory");
  } else {
    spawn();
    transition = .65;
    freeze = Math.max(freeze, .65);
    sync();
  }
  save();
}
function collision() {
  const m = data.mission;
  m.shield--;
  m.x = 700;
  freeze = 1.5;
  message = "Астероид задел щит. Попробуем остановить его!";
  messageColor = "#ffda82";
  if (data.settings.shake) shake = .25;
  sound("hit");
  if (m.shield <= 0) go("failed");
  else sync();
  save();
}

// Интерфейс.
let shownStars = null, renderedScreen = null;
function showStars() {
  const el = $("stars");
  if (shownStars !== null && data.stars > shownStars) {
    const box = $("starsBox");
    box.classList.remove("bump");
    void box.offsetWidth;
    box.classList.add("bump");
  }
  shownStars = data.stars;
  el.textContent = data.stars;
}
function button(text, action, disabled = false, css = "") {
  return `<button type="button" data-action="${action}"
    class="${css}" ${disabled ? "disabled" : ""}>${text}</button>`;
}
function go(next) {
  screen = next;
  render();
}
function render() {
  ctx = null;
  document.body.classList.toggle("still", !data.settings.motion);
  $("app").classList.toggle("fresh", screen !== renderedScreen);
  renderedScreen = screen;
  showStars();
  $("notice").textContent = notice;
  const m = data.mission;
  let html = "";

  if (screen === "menu") {
    html = `<section class="hero-screen">
      <div class="hero-copy reveal">
        <span class="eyebrow">✦ Таблица умножения от 2 до 9</span>
        <h2 class="display">Умножение —<br>это <span class="accent">космос</span></h2>
        <p class="lead">Решай примеры, разбивай астероиды и открывай новые галактики.
          Никаких оценок и спешки — только ты, твой корабль и звёзды.</p>
        <nav class="controls" aria-label="Главное меню">
          ${m ? button("▶ Продолжить миссию", "resume", false, "primary main")
              : button("🚀 Начать полёт", "levels", false, "primary main")}
          ${button("🪐 Выбрать уровень", "levels", false, "light")}
          ${button("🛸 Мой корабль", "garage")}
          ${button("⚙ Настройки", "settings")}
        </nav>
      </div>
      <div class="hero-art reveal" aria-hidden="true">
        <div class="orbit"></div>
        <div class="orbit inner"></div>
        <div class="rocket">${rocketSVG(COLORS[data.ship])}</div>
        <span class="bubble b1">7 × 8 = ?</span>
        <span class="bubble b2">★ +5</span>
        <span class="bubble b3">Верно!</span>
      </div>
    </section>
    <section class="features">
      <article class="panel feature reveal">
        <div class="icon">🪐</div>
        <h3>Три галактики</h3>
        <p>От Лунного маршрута до Кристальной галактики — каждая со своими таблицами.</p>
      </article>
      <article class="panel feature reveal">
        <div class="icon">👾</div>
        <h3>Боссы и награды</h3>
        <p>Победи гигантов, собери звёзды и открой новые цвета корабля.</p>
      </article>
      <article class="panel feature reveal">
        <div class="icon">🤖</div>
        <h3>Добрый помощник</h3>
        <p>Подскажет, как разложить пример, и вернёт трудные задачки на повтор.</p>
      </article>
    </section>
    <p class="center muted"><small>Играй экранными кнопками или клавиатурой.</small></p>`;
  } else if (screen === "levels") {
    html = `<section class="panel reveal">
      <div class="screen-title">
        <h2>Выбери путешествие</h2>
        ${button("← Назад", "menu")}
      </div>
      <div class="row">
        ${button("🌙 Учусь", "mode:learn", false,
          data.mode === "learn" ? "selected" : "")}
        ${button("⚡ Космический вызов", "mode:challenge", false,
          data.mode === "challenge" ? "selected" : "")}
      </div>
      <p class="muted">${data.mode === "learn"
        ? "Астероиды ждут ответа. Таймера и потери щита нет."
        : "Астероиды летят к кораблю. У тебя три деления щита."}</p>
      <div class="cards">${[1,2,3].map(n => `
        <article class="panel card ${n > unlocked() ? "locked" : ""}"
          style="--c:${LEVELS[n].color}">
          <div class="card-glow"></div>
          <div class="planet ${n === 2 ? "ring" : ""}"></div>
          <span class="tag">${data.completed.includes(n) ? "✓ Пройден" :
            n > unlocked() ? "🔒 Закрыт" : "Уровень " + n}</span>
          <h2>${LEVELS[n].name}</h2>
          <p class="muted">Умножение на ${LEVELS[n].tables.join(", ")}.
            Босс: ${LEVELS[n].boss}.</p>
          ${button(n <= unlocked() ? "Начать" : "Пока закрыт",
            `start:${n}`, n > unlocked(), n <= unlocked() ? "primary" : "")}
        </article>`).join("")}</div>
      <p class="muted center">В каждой миссии: 15 обычных астероидов и три босса.</p>
    </section>`;
  } else if (screen === "garage") {
    html = `<section class="panel center reveal">
      <div class="rocket" style="width:120px;margin:0 auto 10px">${rocketSVG(COLORS[data.ship])}</div>
      <h2>Мой корабль</h2>
      <p class="muted">Новые цвета открываются за завершение уровней.</p>
      <div class="stack">${SHIPS.map((name,i) => button(
        `<span style="color:${COLORS[i]}">◆</span> ${name}
        ${data.ship === i ? "✓" : ""}`,
        `ship:${i}`, i > 0 && !data.completed.includes(i),
        data.ship === i ? "selected" : ""
      )).join("")}</div>
      ${button("Назад", "menu")}
    </section>`;
  } else if (screen === "settings") {
    html = `<section class="panel center reveal">
      <h2>Настройки</h2>
      <div class="stack">
        ${[["music","Музыка"],["sound","Звуки"]].map(([k,label]) => `
          <label class="volume">${label}
            <span id="volume-${k}">${data.settings[k]}%</span>
            <input aria-label="${label}" type="range" min="0" max="100"
              step="5" value="${data.settings[k]}" data-volume="${k}">
          </label>`).join("")}
        ${[
          ["particles","Частицы разрушения"],
          ["flashes","Мягкие вспышки"],
          ["shake","Тряска при попадании"],
          ["motion","Движение фона"]
        ].map(([k,label]) => button(
          `${label}: ${data.settings[k] ? "вкл." : "выкл."}`, `toggle:${k}`
        )).join("")}
        ${button("Назад", "back")}
      </div>
      <small>Музыка играет во время миссии.
      Движение фона не отключает полёт астероидов в режиме вызова.</small>
    </section>`;
  } else if (screen === "play" && m) {
    html = `<div class="game">
      <div>
        <section class="panel stage">
          <div class="stats" id="stats"></div>
          <canvas id="field" width="900" height="330"
            aria-label="Корабль и астероид с примером"></canvas>
        </section>
        <section class="panel assistant">
          <div class="bot" aria-hidden="true">🤖</div>
          <strong style="color:var(--blue)">Бортовой помощник</strong>
          <p id="message" role="status" aria-live="polite"></p>
          <p id="hint"></p>
        </section>
      </div>
      <section class="panel">
        <div class="center" id="question"></div>
        <div class="answer" id="answer" aria-label="Твой ответ"></div>
        <div class="keys">
          ${["1","2","3","4","5","6","7","8","9","⌫","0","OK"].map(k =>
            button(k, k === "⌫" ? "erase" :
              k === "OK" ? "submit" : `digit:${k}`,
              false, k === "OK" ? "primary" : "")
          ).join("")}
        </div>
        <div class="tools">
          ${button("Подсказка", "hint")}
          ${button("Пауза", "pause")}
        </div>
      </section>
    </div>`;
  } else if (screen === "pause") {
    html = `<section class="panel center reveal">
      <h2>Пауза</h2>
      <p>Астероиды остановлены. Можно немного отдохнуть.</p>
      <div class="stack">
        ${button("Продолжить", "resume", false, "primary")}
        ${button("Настройки", "settings")}
        ${button("В главное меню", "menu")}
      </div>
    </section>`;
  } else if (screen === "failed" && m) {
    html = `<section class="panel center reveal">
      <h2>Кораблю нужен ремонт</h2>
      <p>Награды сохранены. Давай попробуем ещё!</p>
      <div class="stack">
        ${button("Продолжить без спешки", "learn", false, "primary")}
        ${button("Повторить миссию", `start:${m.level}`)}
        ${button("В главное меню", "menu")}
      </div>
    </section>`;
  } else if (screen === "victory" && finished) {
    html = `<section class="panel center reveal">
      <div class="hero"><span class="twinkle">🌟</span></div>
      <h2>Миссия выполнена!</h2>
      <p>15 астероидов уничтожены. Все три босса побеждены!</p>
      <h2 class="gold">Получено звёзд: ${finished.earned}</h2>
      ${finished.first ? "<p>Открыто новое оформление корабля!</p>" : ""}
      <div class="stack">
        ${finished.level < 3
          ? button("Следующий уровень", `start:${finished.level + 1}`)
          : button("Все галактики исследованы! Выбрать уровень", "levels")}
        ${button("В главное меню", "menu")}
      </div>
    </section>`;
  }

  $("app").innerHTML = html;
  if (screen === "play") {
    ctx = $("field").getContext("2d");
    sync();
    paint();
  }
}
function sync() {
  showStars();
  if (screen !== "play" || !data.mission) return;
  const m = data.mission;
  const [a,b] = m.question.split(":");
  $("stats").textContent =
    `Уровень ${m.level} · Астероиды: ${m.normal}/15 · Боссы: ${m.bosses}/3 · ` +
    (m.mode === "learn" ? "Без спешки" : `Щит: ${m.shield}/3`);
  $("question").textContent =
    transition > 0 ? "Точное попадание!" : `Сколько будет ${a} × ${b}?`;
  $("answer").textContent = answer || "?";
  $("message").textContent = message;
  $("message").style.color = messageColor;
  $("hint").textContent = m.hint ? hintText() : "";
  document.querySelectorAll(".keys button, [data-action='hint']")
    .forEach(b => b.disabled = transition > 0);
}

// События мыши, сенсорного экрана и клавиатуры.
$("app").addEventListener("click", event => {
  const b = event.target.closest("button[data-action]");
  if (!b || b.disabled) return;
  unlockAudio();
  const [action, value] = b.dataset.action.split(":");

  switch (action) {
    case "digit": digit(value); break;
    case "erase": erase(); break;
    case "submit": submit(); break;
    case "hint": hint(); break;
    case "start": start(Number(value)); break;
    case "resume": resume(); break;
    case "pause": go("pause"); save(); break;
    case "menu": go("menu"); save(); break;
    case "levels": go("levels"); break;
    case "garage": go("garage"); break;
    case "mode":
      data.mode = value; render(); save(); break;
    case "ship":
      if (Number(value) === 0 || data.completed.includes(Number(value))) {
        data.ship = Number(value); render(); save();
      }
      break;
    case "settings":
      settingsBack = screen; go("settings"); save(); break;
    case "back":
      go(settingsBack); break;
    case "toggle":
      if (["particles","flashes","shake","motion"].includes(value)) {
        data.settings[value] = !data.settings[value];
        if (value === "particles") particles = [];
        if (value === "motion") skyDirty = true;
        render(); save();
      }
      break;
    case "learn":
      if (!data.mission) break;
      data.mission.mode = "learn";
      data.mission.shield = 3;
      data.mission.x = 700;
      freeze = 1;
      message = "Теперь можно спокойно подумать.";
      messageColor = "#80caff";
      go("play"); save(); break;
  }
});
$("app").addEventListener("input", event => {
  const k = event.target.dataset.volume;
  if (!["music","sound"].includes(k)) return;
  data.settings[k] = Number(event.target.value);
  $(`volume-${k}`).textContent = `${data.settings[k]}%`;
  unlockAudio();
  save();
});
window.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (screen === "play") { go("pause"); save(); }
    else if (screen === "pause") resume();
    else if (screen === "settings") go(settingsBack);
    else go("menu");
    return;
  }
  if (screen !== "play") return;
  if (/^[0-9]$/.test(event.key) ||
      ["Backspace","Enter"].includes(event.key)) {
    event.preventDefault();
    unlockAudio();
    if (/^[0-9]$/.test(event.key)) digit(event.key);
    else if (event.key === "Backspace") erase();
    else submit();
  }
});
function autoPause() {
  if (screen === "play") go("pause");
  save();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoPause();
});
window.addEventListener("blur", () => {
  if (screen === "play") autoPause();
});
window.addEventListener("pagehide", save);

// Рисование без картинок и внешних файлов.
const backgroundStars = Array.from({length: 95}, () => ({
  x: Math.random() * 900, y: Math.random() * 330,
  r: Math.random() < .8 ? 1 : 2,
  speed: 3 + Math.random() * 12
}));

function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function paint() {
  if (!ctx || !data.mission) return;
  const m = data.mission;
  const info = LEVELS[m.level];
  const gradient = ctx.createLinearGradient(0, 0, 900, 330);
  gradient.addColorStop(0, "#080a26");
  gradient.addColorStop(1, ["","#17306a","#3a1e6e","#5a1f5c"][m.level]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 900, 330);

  // Туманности.
  for (const [x, y, r, c] of [
    [700, 60, 260, info.color], [140, 300, 220, "#5ff0c8"], [480, 340, 240, "#ff8fd8"]
  ]) {
    const n = ctx.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, c + "38");
    n.addColorStop(1, c + "00");
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, 900, 330);
  }

  for (const s of backgroundStars) {
    const x = data.settings.motion
      ? ((s.x - time*s.speed) % 900 + 900) % 900 : s.x;
    ctx.globalAlpha = data.settings.motion
      ? .5 + .5 * Math.abs(Math.sin(time * s.speed * .3 + s.y)) : .85;
    ctx.fillStyle = s.r > 1 ? "#fff3c4" : "#dce8ff";
    ctx.beginPath();
    ctx.arc(x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Планета уровня.
  const glow = ctx.createRadialGradient(240, 70, 30, 240, 70, 110);
  glow.addColorStop(0, info.color + "55");
  glow.addColorStop(1, info.color + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(120, 0, 240, 190);
  const body = ctx.createRadialGradient(222, 52, 6, 240, 70, 54);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(.25, info.color);
  body.addColorStop(1, "#1a1442");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(240, 70, 52, 0, Math.PI*2);
  ctx.fill();

  if (m.level === 2) {
    ctx.strokeStyle = "#e2d2ff";
    ctx.globalAlpha = .75;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(240, 70, 82, 18, -.2, 0, Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  if (data.settings.shake && shake > 0)
    ctx.translate(Math.random()*6-3, Math.random()*4-2);

  // Корабль.
  const flame = data.settings.motion ? Math.sin(time*9)*6 : 0;
  ctx.shadowColor = "#ffb347";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffd76a";
  ctx.beginPath();
  ctx.moveTo(65,164); ctx.lineTo(28-flame,180); ctx.lineTo(65,196);
  ctx.fill();
  ctx.fillStyle = "#fff4c2";
  ctx.beginPath();
  ctx.moveTo(65,172); ctx.lineTo(44-flame/2,180); ctx.lineTo(65,188);
  ctx.fill();
  ctx.shadowColor = COLORS[data.ship];
  ctx.shadowBlur = 18;
  ctx.fillStyle = COLORS[data.ship];
  ctx.strokeStyle = "#eef4ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(139,180); ctx.lineTo(60,148);
  ctx.lineTo(74,180); ctx.lineTo(60,212);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1b1446";
  ctx.beginPath();
  ctx.ellipse(99,180,15,9,0,0,Math.PI*2);
  ctx.fill();

  if (transition <= 0) {
    const rand = seeded(m.seed);
    const kind = m.boss ? m.level-1 : m.seed%3;
    const color = ["#78c2dc","#958071","#ae6fd9"][kind];
    const radius = m.boss ? 75+18*m.left/(m.level+2) : 60;
    const rotation = data.settings.motion ? time*.17 : 0;
    const count = kind === 2 ? 8 : 11;
    const points = [];

    for (let i=0; i<count; i++) {
      const angle = i*Math.PI*2/count+rotation;
      const r = radius*(.83+rand()*.31);
      points.push([m.x+Math.cos(angle)*r,180+Math.sin(angle)*r]);
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = "#e8edff";
    ctx.beginPath();
    points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (kind === 1) {
      ctx.fillStyle = "#685951";
      for (let i=0; i<6; i++) {
        ctx.beginPath();
        ctx.arc(
          m.x+(rand()-.5)*radius,
          180+(rand()-.5)*radius,
          5+rand()*8,0,Math.PI*2
        );
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = kind === 0 ? "#d4f8ff" : "#efbfff";
      for (const [x,y] of points) {
        ctx.beginPath();
        ctx.moveTo(m.x,180); ctx.lineTo(x,y); ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(10,8,38,.82)";
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(m.x-80,150,160,60,20);
    else ctx.rect(m.x-80,150,160,60);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "800 36px Unbounded,Nunito,system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const [a,b] = m.question.split(":");
    ctx.fillText(`${a} × ${b}`,m.x,180);

    if (m.boss) {
      ctx.fillStyle = info.color;
      ctx.font = "700 22px Unbounded,Nunito,system-ui,sans-serif";
      ctx.fillText(info.boss,470,28);
      const total = m.level+2;
      for (let i=0; i<total; i++) {
        ctx.fillStyle = i<m.left ? info.color : "#45506a";
        ctx.fillRect(470-total*23+i*46,50,36,10);
      }
    }
  } else if (transition > .30) {
    ctx.strokeStyle = "#8deeff";
    ctx.shadowColor = "#5ff0c8";
    ctx.shadowBlur = 20;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(140,180); ctx.lineTo(hitX,180); ctx.stroke();
    if (data.settings.flashes) {
      ctx.beginPath();
      ctx.arc(hitX,180,25+(1-transition/.65)*50,0,Math.PI*2);
      ctx.stroke();
    }
  }

  if (data.settings.particles) {
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1,p.life*2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,3,0,Math.PI*2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Живое звёздное небо на фоне всей страницы.
const sky = $("sky");
const skyCtx = sky.getContext("2d");
let skyStars = [], meteors = [], meteorTimer = 3, skyW = 0, skyH = 0;
let skyDirty = true, skyAcc = 0;
function resizeSky() {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  skyW = window.innerWidth;
  skyH = window.innerHeight;
  sky.width = skyW * dpr;
  sky.height = skyH * dpr;
  skyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round(Math.min(160, skyW * skyH / 7000));
  const tints = ["#ffffff", "#ffffff", "#cfe9ff", "#ffe8b0", "#ffd0f0"];
  skyStars = Array.from({length: count}, () => ({
    x: Math.random() * skyW,
    y: Math.random() * skyH * .85,
    r: Math.random() < .85 ? .5 + Math.random() * .9 : 1.4 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
    speed: .6 + Math.random() * 1.8,
    color: tints[Math.floor(Math.random() * tints.length)]
  }));
  skyDirty = true;
}
function drawSky(dt) {
  const moving = data.settings.motion && !reducedMotion;
  // Без анимации небо рисуется один раз; с анимацией — не чаще ~30 кадров/с.
  if (!moving && !skyDirty) return;
  skyAcc += dt;
  if (moving && !skyDirty && skyAcc < 1 / 30) return;
  dt = skyAcc; skyAcc = 0; skyDirty = false;
  skyCtx.clearRect(0, 0, skyW, skyH);
  const t = performance.now() / 1000;
  for (const s of skyStars) {
    const a = moving ? .45 + .55 * Math.abs(Math.sin(t * s.speed + s.phase)) : .8;
    skyCtx.globalAlpha = a;
    skyCtx.fillStyle = s.color;
    skyCtx.beginPath();
    skyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    skyCtx.fill();
    if (s.r > 1.6) {
      skyCtx.globalAlpha = a * .5;
      skyCtx.fillRect(s.x - s.r * 3, s.y - .4, s.r * 6, .8);
      skyCtx.fillRect(s.x - .4, s.y - s.r * 3, .8, s.r * 6);
    }
  }
  if (moving) {
    meteorTimer -= dt;
    if (meteorTimer <= 0) {
      meteorTimer = 4 + Math.random() * 6;
      meteors.push({
        x: skyW * (.2 + Math.random() * .8), y: Math.random() * skyH * .4,
        vx: -(380 + Math.random() * 260), vy: 160 + Math.random() * 120, life: 1
      });
    }
    for (const m of meteors) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt * .9;
      const g = skyCtx.createLinearGradient(m.x, m.y, m.x - m.vx * .18, m.y - m.vy * .18);
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(1, "rgba(160,200,255,0)");
      skyCtx.globalAlpha = Math.max(0, m.life);
      skyCtx.strokeStyle = g;
      skyCtx.lineWidth = 2;
      skyCtx.lineCap = "round";
      skyCtx.beginPath();
      skyCtx.moveTo(m.x, m.y);
      skyCtx.lineTo(m.x - m.vx * .18, m.y - m.vy * .18);
      skyCtx.stroke();
    }
    meteors = meteors.filter(m => m.life > 0);
  }
  skyCtx.globalAlpha = 1;
}
resizeSky();
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeSky, 150);
});

// Лёгкий параллакс сцены за курсором.
const layers = [...document.querySelectorAll(".layer[data-depth]")];
window.addEventListener("pointermove", event => {
  if (!data.settings.motion || reducedMotion || event.pointerType === "touch") return;
  const dx = event.clientX / window.innerWidth - .5;
  const dy = event.clientY / window.innerHeight - .5;
  for (const l of layers) {
    const d = Number(l.dataset.depth);
    l.style.transform = `translate3d(${-dx * d}px, ${-dy * d * .6}px, 0)`;
  }
});

// Главный цикл: при паузе время миссии не идёт.
let previous = performance.now();
function frame(now) {
  const dt = Math.min(.05,Math.max(0,(now-previous)/1000));
  previous = now;
  drawSky(dt);

  if (screen === "play" && data.mission) {
    time += dt;
    const oldTransition = transition;
    const stopped = freeze>0 || transition>0;
    freeze = Math.max(0,freeze-dt);
    transition = Math.max(0,transition-dt);
    shake = Math.max(0,shake-dt);

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
    }
    particles = particles.filter(p => p.life>0);

    const m = data.mission;
    if (!stopped && m.mode === "challenge") {
      // Скорость адаптации: примерно 16–21 секунды на обычный астероид.
      const speed = (22+m.level*4)*(m.boss ? .85 : 1);
      m.x -= speed*dt;
      if (m.x <= 160) collision();
    }

    if (oldTransition>0 && transition===0) sync();
    if (screen === "play") {
      paint();
      musicElapsed += dt;
      if (musicElapsed >= .55) {
        musicElapsed = 0;
        tone(musicNotes[musicIndex++ % musicNotes.length],
             0,.48,data.settings.music/1600);
      }
    }

    saveElapsed += dt;
    if (saveElapsed >= 5) {
      saveElapsed = 0;
      save();
    }
  }
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
