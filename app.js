"use strict";

const subjects = [
  { id: "ch", title: "國文", icon: "國" },
  { id: "en", title: "英文", icon: "En" },
  { id: "math", title: "數學乙", icon: "∑" },
  { id: "social", title: "歷史與地理", icon: "地" }
];
const labels = { ch: "國文", en: "英文", mb: "數學乙", hg: "歷史與地理", hi: "歷史", ge: "地理" };
const groups = { ch: ["ch"], en: ["en"], math: ["mb"], social: ["hg", "hi", "ge"] };
const app = document.getElementById("app");
const account = document.getElementById("account");
const modal = document.getElementById("original");
const papers = window.POLICE_BANK;
const lessons = window.POLICE_LESSONS;
const mathStudy = window.POLICE_MATH_STUDY;
const mathDiagrams = window.POLICE_MATH_DIAGRAMS;
const socialStudy = window.POLICE_SOCIAL_STUDY;
const socialVisuals = window.POLICE_SOCIAL_VISUALS;
const languageStudy = window.POLICE_LANGUAGE_STUDY;
const languageVisuals = window.POLICE_LANGUAGE_VISUALS;
const prefix = "police-study.v1.";

const languageMethods = {
  sound: ["字音與字形拆解", "先把單字放回完整詞語，再檢查讀音的聲母、韻母和聲調，或用詞義確認應寫哪個字。"],
  meaning: ["詞義與用法", "先用自己的話解釋詞語，再代回句子。留意褒貶、使用對象，以及前後有沒有變化。"],
  writing: ["語句與寫法拆解", "先看句子如何連接、描寫誰，或怎麼安排先後。再檢查這個寫法帶來的效果。"],
  poem: ["詩句怎麼讀", "先把景物、時間和動作說成白話，再從它們的搭配找情緒或意思。"],
  culture: ["典故與辨認線索", "先看題目要找人物、作品、文體還是場合。用兩條線索交叉確認，別只靠一個熟悉的字。"],
  classic: ["文言換成白話", "先找誰在做什麼，再把關鍵字換成白話放回原句。句子有轉折或省略時，把省掉的意思補出來。"],
  reading: ["閱讀線索拆解", "先圈題目問的對象、範圍或否定詞，再回文找能直接支持或反駁選項的句子。"],
  vocab: ["關鍵字與用法", "先看空格需要的詞性，再找例子、反義或結果的提示。把選出的字連同常搭配的詞一起念。"],
  phrase: ["片語怎麼用", "整組讀動詞和介系詞，確認後面接人、事物還是動作。把整個片語換成中文，再看上下文通不通。"],
  grammar: ["句型拆解", "先找主詞和主要動詞，再看空格需要的時態、主動或被動，以及前面的字要求哪種形式。"],
  link: ["前後句的關係", "分別翻譯前後兩段，再判斷是因果、讓步、補充還是條件。最後檢查連接語後面接名詞還是完整句子。"],
  main: ["篇章怎麼讀", "把每段濃縮成一句話，優先比較首尾與重複出現的概念。主旨要能涵蓋全文，段落功能則看它在替全文做什麼。"]
};

function load(key, fallback, storage = "localStorage") {
  return JSON.parse(window[storage].getItem(prefix + key)) ?? fallback;
}

function save(key, value, storage = "localStorage") {
  window[storage].setItem(prefix + key, JSON.stringify(value));
}

function html(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function loadStudent(id, name) {
  return { id, name, records: load("records." + id, {}) };
}

function restoreStudent() {
  try {
    const id = load("signed-in", "", "sessionStorage");
    if (!id) return null;
    const profiles = load("profiles", {});
    return Object.hasOwn(profiles, id) ? loadStudent(id, profiles[id].name) : null;
  } catch {
    return null;
  }
}

let student = restoreStudent();
let session = null;
let screen = "";
let filter = { year: "", group: "" };

function action(label, event, kind = "plain", data = "") {
  return `<button class="${kind}" data-action="${event}" data-value="${html(data)}" type="button">${label}</button>`;
}

function jumpTop() {
  window.scrollTo(0, 0);
}

function showHome(creating = false, name = "") {
  screen = "home";
  session = null;
  account.innerHTML = student
    ? `<span class="account-name">${html(student.name)}</span>${action("登出", "logout")}`
    : "";
  const hero = `<section class="hero"><p class="eyebrow">臺灣警察專科學校 · 110–115 學年度</p>
    <h1>${student ? "今天要練哪一科？" : "警專入學考試題庫"}</h1>
    <p>按科目練習歷屆選擇題。做完一題看解析，也能整卷作答後再訂正。</p></section>`;
  if (!student) {
    app.innerHTML = hero + `<section class="card login"><h2>${creating ? "建立學生帳號" : "學生登入"}</h2>
      <p class="note">帳號和錯題保存在這個瀏覽器。下次請用同一個瀏覽器登入。</p>
      <form id="login" method="post" data-mode="${creating ? "register" : "login"}">
        <label>學生姓名或代稱<input name="name" required maxlength="24" autocomplete="username" value="${html(name)}"></label>
        <label>四位數密碼<input name="pin" required type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="${creating ? "new-password" : "current-password"}"></label>
        <div class="form-actions"><button class="primary" type="submit">${creating ? "建立帳號並登入" : "登入"}</button><button class="plain" type="button" id="switch-login">${creating ? "返回登入" : "初次使用，建立帳號"}</button></div>
        <p class="error" id="login-error" role="alert"></p>
      </form></section>`;
    return;
  }
  const { records } = student;
  const practiced = itemsFor().filter(q => Object.hasOwn(records, q.id));
  app.innerHTML = hero + `<section class="subjects" aria-label="選擇科目">${subjects.map(subject => {
    const count = itemsFor(subject.id).length;
    return `<button class="subject" data-action="subject" data-value="${subject.id}"><span aria-hidden="true" class="icon">${subject.icon}</span><b>${subject.title}</b><small>${count} 題</small></button>`;
  }).join("")}</section><section class="card"><h2>我的練習</h2>
  <div class="overview"><span>已練習 <b>${practiced.length}</b> 題</span><span>待訂正 <b>${practiced.filter(q => records[q.id].wrong).length}</b> 題</span></div>
  ${action("複習全部錯題", "all-wrong", "soft")}</section>`;
}

function hex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

async function pinDigest(pin, salt) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", iterations: 120000, salt: encoder.encode(salt)
  }, material, 256);
  return hex(new Uint8Array(bits));
}

app.addEventListener("click", event => {
  if (event.target.id !== "switch-login") return;
  const form = event.target.form;
  showHome(form.dataset.mode === "login", form.elements.namedItem("name").value);
  document.querySelector('#login input[name="name"]').focus();
});

app.addEventListener("submit", async event => {
  if (event.target.id !== "login") return;
  event.preventDefault();
  const form = event.target;
  const message = document.getElementById("login-error");
  const data = new FormData(form);
  const name = String(data.get("name")).trim();
  const id = name.normalize("NFKC").toLowerCase();
  const pin = String(data.get("pin"));
  const creating = form.dataset.mode === "register";
  if (!id) { message.textContent = "請輸入學生姓名或代稱。"; return; }
  if (!/^[0-9]{4}$/.test(pin)) { message.textContent = "請輸入四位數密碼。"; return; }
  if (!window.crypto?.subtle) { message.textContent = "請用支援安全登入的瀏覽器開啟本站 HTTPS 網址。"; return; }
  const buttons = [...form.querySelectorAll("button")];
  message.textContent = "";
  buttons.forEach(button => button.disabled = true);
  try {
    const profiles = load("profiles", {});
    const existing = Object.hasOwn(profiles, id) ? profiles[id] : null;
    if (creating && existing) { message.textContent = "這個帳號已建立，請直接登入。"; return; }
    if (!creating && !existing) { message.textContent = "這個瀏覽器找不到此帳號。請確認姓名或代稱，首次使用請建立帳號。"; return; }
    const salt = existing?.salt ?? hex(crypto.getRandomValues(new Uint8Array(16)));
    const digest = await pinDigest(pin, salt);
    if (!form.isConnected) return;
    if (existing && digest !== existing.digest) { message.textContent = "密碼有誤，請再試一次。"; return; }
    const nextStudent = loadStudent(id, existing?.name ?? name);
    if (creating) {
      const latest = load("profiles", {});
      if (Object.hasOwn(latest, id)) { message.textContent = "這個帳號已建立，請直接登入。"; return; }
      save("profiles", { ...latest, [id]: { name, salt, digest } });
    }
    save("signed-in", id, "sessionStorage");
    student = nextStudent;
    showHome();
    jumpTop();
  } catch {
    message.textContent = "無法讀取或儲存帳號資料。請確認瀏覽器允許本站儲存資料後再試一次。";
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
});

function itemsFor(subject, selectedPapers = papers) {
  return selectedPapers.filter(p => !subject || groups[subject].includes(p.subject))
    .flatMap(p => p.questions.map(q => ({ ...q, paper: p, id: `${p.id}-${q.no}` })));
}

function subjectTitle(subject) {
  return subjects.find(s => s.id === subject)?.title ?? "全部科目";
}

function showSubject(subject) {
  screen = subject;
  session = null;
  const { records } = student;
  const available = papers.filter(p => groups[subject].includes(p.subject));
  const selected = available.filter(p => (!filter.year || +filter.year === p.year) && (!filter.group || filter.group === p.subject));
  const items = itemsFor(subject, selected);
  const taught = items.filter(q => lessons[q.id]);
  const wrong = items.filter(q => records[q.id]?.wrong);
  const option = (value, label, current) => `<option value="${value}" ${String(value) === current ? "selected" : ""}>${label}</option>`;
  app.innerHTML = `<div class="breadcrumb">${action("全部科目", "home")} <span>${subjectTitle(subject)}</span></div>
    <div class="heading"><h1>${subjectTitle(subject)}</h1></div>
    <div class="filter"><label>學年度<select id="year">${option("", "全部學年度", filter.year)}${[...new Set(available.map(p => p.year))].map(y => option(y, `${y} 學年度`, filter.year)).join("")}</select></label>
    ${groups[subject].length > 1 ? `<label>試卷<select id="group">${option("", "全部試卷", filter.group)}${groups[subject].map(g => option(g, labels[g], filter.group)).join("")}</select></label>` : ""}</div>
    <div class="actions overview">
    ${items.length ? action("隨機練習 10 題", "random", "primary") : ""}
    ${taught.length ? action(`有詳解的題目（${taught.length}）`, "taught", "soft") : ""}
    ${wrong.length ? action(`複習錯題（${wrong.length}）`, "subject-wrong", "soft") : ""}
    </div>
    <section class="papers" aria-label="歷屆試卷">${selected.length ? selected.map(p => {
      const count = p.questions.filter(q => lessons[`${p.id}-${q.no}`]).length;
      const note = count ? ` · ${count} 題附詳解` : "";
      return `<article class="card paper"><div><h2>${p.year} 學年度 · ${labels[p.subject]}</h2><p class="note">第 ${p.year - 70} 期 · ${p.questions.length} 題${note}</p></div>
      <div class="actions">${action("逐題練習", "practice", "soft", p.id)}${action("整卷作答", "exam", "plain", p.id)}</div></article>`;
    }).join("") : '<p class="card">這個學年度沒有符合條件的試卷。</p>'}</section>`;
}

function getFiltered() {
  return itemsFor(screen, papers.filter(p =>
    (!filter.year || +filter.year === p.year) && (!filter.group || filter.group === p.subject)));
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function begin(items, mode, title) {
  if (!items.length) {
    app.innerHTML = `<div class="card end"><h2>目前沒有待訂正的錯題</h2>${action("回到科目首頁", "back", "primary")}</div>`;
    return;
  }
  session = { items, mode, title, index: 0, picks: {}, marked: {}, complete: false };
  showQuestion();
  jumpTop();
}

function pagePath(year, page) {
  return `./media/${year}/p${page}.webp`;
}

function openOriginal(q) {
  document.getElementById("original-pages").innerHTML = q.paper.pages.map(page =>
    `<div id="original-${page}"><p class="note">這份試卷第 ${q.paper.pages.indexOf(page) + 1} 頁</p>
    <img src="${pagePath(q.paper.year, page)}" alt="原卷第 ${q.paper.pages.indexOf(page) + 1} 頁" loading="lazy"></div>`).join("");
  modal.showModal();
  document.getElementById(`original-${q.context ?? q.page}`)?.scrollIntoView({ block: "start" });
}

function showQuestion() {
  const { items, index, picks, marked, mode, title, complete } = session;
  const q = items[index];
  const selected = picks[q.id] || "";
  const checked = mode === "exam" ? complete : Object.hasOwn(marked, q.id);
  const score = checked ? grade(q, selected) : null;
  const answered = items.filter(item => mode === "exam" ? picks[item.id] : Object.hasOwn(marked, item.id)).length;
  const detailed = lessons[q.id];
  const imageVersion = q.imageVersion ? `?v=${q.imageVersion}` : "";
  const questionImages = q.crops?.length
    ? q.crops.map((_, i) => `./media/${q.paper.year}/${q.paper.subject}-${q.no}-${i}.webp${imageVersion}`)
    : [pagePath(q.paper.year, q.page)];
  app.innerHTML = `<div class="breadcrumb">${action("離開練習", "back")} <span>${title}</span></div>
    <div class="heading"><h1>${labels[q.paper.subject]} · ${q.paper.year} 學年度</h1><span class="muted">${index + 1} / ${items.length} 題</span></div>
    <progress class="progress" max="${items.length}" value="${answered}" aria-label="已作答題數"></progress>
    <div class="quiz-layout"><section class="card question">
      <h2 id="question-title">原卷第 ${q.no} 題</h2>
      <p class="note">${q.options === 5 ? "多選題，可勾選多個答案" : "單選題，選一個答案"}${!q.crops?.length ? " · 請在原卷影像找到題號" : ""}</p>
      <div class="source-tools">${action(q.context ? "閱讀題組文章" : "開啟原卷與題組", "original", "plain")}${action("放大題圖", "zoom", "plain")}</div>
      ${q.passage ? `<div class="passage" role="group" aria-label="閱讀題組">${html(q.passage)}</div>` : ""}
      <div class="question-images ${q.crops?.length ? "" : "whole"} ${q.text ? "has-text" : ""}">${questionImages.map((path, i) =>
        `<a href="${path}" target="_blank" rel="noopener"><img src="${path}" alt="原卷第 ${q.no} 題影像${questionImages.length > 1 ? `，第 ${i + 1} 部分` : ""}"></a>`).join("")}</div>
      ${q.text ? `<details class="transcript" ${window.matchMedia("(max-width: 490px)").matches ? "open" : ""}><summary>文字題目</summary><div>${html(q.text)}</div></details>` : ""}
      <div class="choices" role="group" aria-label="選擇答案">${"ABCDE".slice(0, q.options).split("").map(letter => {
        const pressed = selected.includes(letter);
        const correct = checked && score.key !== "*" && score.key.includes(letter);
        return `<button class="choice ${correct ? "correct" : checked && pressed && score.key !== "*" ? "incorrect" : pressed ? "selected" : ""}" aria-pressed="${pressed}" data-action="pick" data-value="${letter}" ${checked ? "disabled" : ""}>${letter}</button>`;
      }).join("")}</div>
      ${feedback(q, score, detailed)}
      <div class="actions">
      <button class="plain" data-action="prev" ${index === 0 ? "disabled" : ""}>上一題</button>
      ${mode !== "exam" && !checked ? `<button class="primary" data-action="check" ${selected ? "" : "disabled"}>確認答案</button>` : ""}
      ${index < items.length - 1 ? action("下一題", "next", "plain") : ""}
      ${mode === "exam" && !complete ? action("交卷", "submit-exam", "primary") : ""}
      ${(complete || (mode !== "exam" && index === items.length - 1)) ? action("查看結果", "result", "soft") : ""}
      </div><p class="error" id="record-error" role="alert" hidden></p></section>
      <aside class="card navigator"><h2>題號</h2><p class="note">已作答 ${answered} / ${items.length} 題</p>
      <div class="numbers">${items.map((item, i) => `<button data-action="goto" data-value="${i}" class="${picks[item.id] || Object.hasOwn(marked, item.id) ? "done" : ""}" ${i === index ? 'aria-current="step"' : ""} aria-label="第 ${i + 1} 題">${i + 1}</button>`).join("")}</div></aside></div>`;
}

function feedback(q, score, detailed) {
  if (!score) return "";
  const line = score.key === "*" ? "本題依標準答案一律給分" :
    `${score.ratio === 1 ? "答對了" : score.ratio ? "部分答對" : "這題可以再練一次"} · 正確答案 ${q.answers.join(" 或 ")}`;
  return `<section class="feedback ${score.ratio === 1 ? "" : "wrong"}" id="feedback" tabindex="-1" aria-live="polite">
    <h3>${line}</h3>
    ${lessonFeedback(q, detailed, score.key)}
  </section>`;
}

function lessonFeedback(q, detailed, key) {
  if (!detailed) {
    return key === "*" ? "<p>原卷公告已更正本題計分方式。</p>" : "<p>這題目前有標準答案，逐題詳解待補。</p>";
  }
  const [concept, ...steps] = detailed;
  const language = languageStudy?.[q.paper.id]?.[q.no - 1];
  if (language) return languageLesson(q.id, concept, steps, language, key);
  const context = socialStudy?.[q.paper.id]?.[q.no - 1];
  if (context) return socialLesson(q.id, concept, steps, context);
  const worked = q.paper.subject === "mb" ? mathStudy?.[q.paper.year]?.[q.no] : null;
  if (!worked) {
    return `<p><b>觀念</b>　${html(concept)}</p><ol class="steps">${steps.map(step => `<li>${html(step)}</li>`).join("")}</ol>`;
  }
  const [startingPoint, ...formulas] = worked;
  const diagram = mathDiagrams?.[q.id];
  return `<div class="math-lesson">
    <h4>先從哪裡下手</h4><p><b>${html(concept)}</b></p><p>${html(startingPoint)}</p>
    ${diagram ? lessonDiagram(`./math-diagrams/${q.id}.webp`, diagram, "math-diagram") : ""}
    <h4>一步一步算</h4>
    <ol class="steps math-steps">${steps.map((step, index) => `<li><p>${html(step)}</p>
      ${formulas[index]?.map(mathLine).join("") ?? ""}</li>`).join("")}</ol>
  </div>`;
}

function lessonDiagram(path, [caption, description], className) {
  return `<figure class="lesson-diagram ${className}">
    <img src="${path}" alt="${html(description)}" width="840" height="420" loading="lazy" decoding="async">
    <figcaption><span>${html(caption)}</span><a href="${path}" target="_blank" rel="noopener">看大圖</a></figcaption>
  </figure>`;
}

function socialLesson(id, concept, steps, [subject, background, outcome]) {
  const history = subject === "history";
  return `<div class="lesson-context social-lesson">
    <p class="lesson-concept"><b>${html(concept)}</b></p>
    ${socialVisual(socialVisuals?.[id])}
    <section><h4>${history ? "背景與成因" : "形成原因"}</h4><p>${html(background)}</p></section>
    <section><h4>${history ? "事件經過與題目線索" : "題目線索與判斷"}</h4>
      <ol class="steps">${steps.map(step => `<li>${html(step)}</li>`).join("")}</ol>
    </section>
    <section><h4>${history ? "後續影響" : "結果與應用"}</h4><p>${html(outcome)}</p></section>
  </div>`;
}

function socialVisual(visual) {
  if (!visual) return "";
  if (visual.image) {
    return lessonDiagram(`./social-diagrams/${visual.image}.webp`, [visual.title, visual.alt], "social-diagram");
  }
  return studyFlow(visual, "social-flow");
}

function languageLesson(id, concept, steps, [type, worked], key) {
  const [heading, method] = languageMethods[type];
  const visual = languageVisuals?.[id];
  const awarded = key === "*";
  return `<div class="lesson-context language-lesson">
    <p class="lesson-concept"><b>${html(concept)}</b></p>
    ${visual ? studyFlow(visual, "language-flow") : ""}
    <section><h4>${awarded ? "更正後如何計分" : heading}</h4><p>${html(worked)}</p></section>
    <section><h4>${awarded ? "原題說明" : "答案怎麼判斷"}</h4>
      <ol class="steps">${steps.map(step => `<li>${html(step)}</li>`).join("")}</ol>
    </section>
    ${awarded ? "" : `<section class="language-method"><h4>下次遇到這類題目</h4><p>${html(method)}</p></section>`}
  </div>`;
}

function studyFlow({ title, stages, ordered = true }, className) {
  const list = ordered ? "ol" : "ul";
  return `<figure class="study-flow ${className}"><figcaption>${html(title)}</figcaption>
    <${list} role="list">${stages.map(([label, description]) => `<li><b>${html(label)}</b><span>${html(description)}</span></li>`).join("")}</${list}>
  </figure>`;
}

function mathLine(line) {
  const parts = line.split(/(\[\[[^\[\]|]+\|[^\[\]|]+\]\]|\{\{[^{}]+\}\}|\^\{[^{}]+\})/g);
  const spoken = [];
  const expression = parts.map((part, index) => {
    if (index % 2 === 0) {
      spoken.push(part);
      return html(part);
    }
    if (part.startsWith("[[")) {
      const [top, bottom] = part.slice(2, -2).split("|");
      spoken.push(`（${top}）除以（${bottom}）`);
      return `<span class="math-fraction"><span>${html(top)}</span><span>${html(bottom)}</span></span>`;
    }
    if (part.startsWith("{{")) {
      const rows = part.slice(2, -2).split(";").map(row => row.split(","));
      spoken.push(`矩陣，${rows.map(row => row.join("、")).join("；")}`);
      return `<span class="math-matrix">${rows.map(row => `<span>${row.map(cell => `<span>${html(cell)}</span>`).join("")}</span>`).join("")}</span>`;
    }
    const power = part.slice(2, -1);
    spoken.push(`的 ${power} 次方`);
    return `<sup>${html(power)}</sup>`;
  }).join("");
  return `<div class="math-line" role="math" aria-label="${html(spoken.join(""))}"><span aria-hidden="true">${expression}</span></div>`;
}

function grade(q, pick = "") {
  const key = q.answers.includes("*") ? "*" : q.answers.reduce((best, answer) => {
    const distance = value => Array.from("ABCDE").filter(c => pick.includes(c) !== value.includes(c)).length;
    return distance(answer) < distance(best) ? answer : best;
  });
  const mismatches = Array.from("ABCDE").filter(c => pick.includes(c) !== key.includes(c)).length;
  return { key, ratio: key === "*" || mismatches === 0 ? 1 : q.options === 5 && pick && mismatches === 1 ? .5 : 0 };
}

function storeGrades(items) {
  try {
    const key = "records." + student.id;
    const latest = load(key, {});
    for (const q of items) {
      const result = grade(q, session.picks[q.id]);
      latest[q.id] = { wrong: result.ratio < 1 };
    }
    save(key, latest);
    student.records = latest;
    return true;
  } catch {
    const message = document.getElementById("record-error");
    message.hidden = false;
    message.textContent = "這次作答尚未儲存。請確認瀏覽器允許本站儲存資料後再試一次。";
    return false;
  }
}

function weight(q) {
  if (q.paper.subject === "ch") return 2;
  if (q.paper.questions.some(item => item.options === 5)) return q.options === 5 ? 4 : 2;
  return 2.5;
}

function showResult() {
  const { items, mode, marked, picks, title } = session;
  const submitted = mode === "exam" ? items : items.filter(q => Object.hasOwn(marked, q.id));
  const wrong = submitted.filter(q => grade(q, picks[q.id]).ratio !== 1);
  const total = items.reduce((sum, q) => sum + weight(q), 0);
  const earned = submitted.reduce((sum, q) => sum + weight(q) * grade(q, picks[q.id]).ratio, 0);
  app.innerHTML = `<section class="card end"><p class="note">${title}</p><h1>本次練習結果</h1>
    <p>完全答對 <b>${submitted.length - wrong.length}</b> 題 · 待訂正 <b>${wrong.length}</b> 題${mode === "practice" ? ` · 未確認 ${items.length - submitted.length} 題` : ""}</p>
    ${mode === "exam" ? `<p><b>${earned} / ${total} 分</b>${items[0].paper.subject === "ch" ? "（國文選擇題）" : ""}</p>` : ""}
    <div class="actions">${wrong.length ? action("重練這次的錯題", "retry", "primary") : ""}
    ${action("查看作答", "review")}${action("返回", "back")}</div></section>`;
  jumpTop();
}

function goBack() {
  if (screen === "home") showHome();
  else showSubject(screen);
  jumpTop();
}

document.getElementById("home").addEventListener("click", () => { showHome(); jumpTop(); });
app.addEventListener("change", event => {
  if (event.target.id === "year") filter.year = event.target.value;
  else if (event.target.id === "group") filter.group = event.target.value;
  else return;
  showSubject(screen);
  document.getElementById(event.target.id)?.focus();
});

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || !student) return;
  const { action: eventName, value } = button.dataset;
  const q = session?.items[session.index];
  switch (eventName) {
    case "home": showHome(); jumpTop(); return;
    case "logout":
      try {
        window.sessionStorage.removeItem(prefix + "signed-in");
      } catch {
        window.alert("無法登出。請關閉這個分頁以結束練習。");
        return;
      }
      student = null; showHome(); jumpTop(); return;
    case "subject":
      filter = { year: "", group: "" }; showSubject(value); jumpTop(); return;
    case "back": goBack(); return;
    case "practice": case "exam":
      begin(itemsFor(null, papers.filter(p => p.id === value)), eventName, eventName === "exam" ? "整卷作答" : "逐題練習"); return;
    case "random": begin(shuffle(getFiltered()).slice(0, 10), "practice", "隨機練習"); return;
    case "taught": begin(getFiltered().filter(item => lessons[item.id]), "practice", "有詳解的題目"); return;
    case "all-wrong": begin(itemsFor().filter(item => student.records[item.id]?.wrong), "practice", "錯題複習"); return;
    case "subject-wrong": begin(getFiltered().filter(item => student.records[item.id]?.wrong), "practice", "錯題複習"); return;
    case "original": openOriginal(q); return;
    case "zoom": {
      const zoomed = app.querySelector(".question-images").classList.toggle("zoom");
      button.textContent = zoomed ? "還原題圖" : "放大題圖";
      return;
    }
    case "pick": {
      const current = session.picks[q.id] || "";
      session.picks[q.id] = q.options === 4 ? value
        : current.includes(value) ? current.replace(value, "") : [...current, value].sort().join("");
      const choice = session.picks[q.id];
      app.querySelectorAll(".choice").forEach(option => {
        const selected = choice.includes(option.dataset.value);
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", selected);
      });
      app.querySelector(`[data-action="goto"][data-value="${session.index}"]`)?.classList.toggle("done", Boolean(choice));
      const confirm = app.querySelector('[data-action="check"]');
      if (confirm) confirm.disabled = !choice;
      if (session.mode === "exam") {
        const answered = session.items.filter(item => session.picks[item.id]).length;
        app.querySelector("progress").value = answered;
        app.querySelector(".navigator .note").textContent = `已作答 ${answered} / ${session.items.length} 題`;
      }
      return;
    }
    case "check":
      if (!storeGrades([q])) return;
      session.marked[q.id] = true; showQuestion(); document.getElementById("feedback").focus(); return;
    case "submit-exam": {
      const blank = session.items.filter(item => !session.picks[item.id]).length;
      if (blank && !window.confirm(`還有 ${blank} 題未作答。確定要交卷嗎？`)) return;
      if (!storeGrades(session.items)) return;
      session.complete = true; showResult(); return;
    }
    case "result": showResult(); return;
    case "retry": {
      const wrong = session.items.filter(item => (session.complete || Object.hasOwn(session.marked, item.id)) && grade(item, session.picks[item.id]).ratio < 1);
      begin(wrong, "practice", "本次錯題"); return;
    }
    case "prev": session.index--; break;
    case "next": session.index++; break;
    case "goto": session.index = +value; break;
    case "review": break;
    default: return;
  }
  showQuestion();
  jumpTop();
});

showHome();
