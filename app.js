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
const prefix = "police-study.v1.";

function load(key, fallback, storage = localStorage) {
  try { return JSON.parse(storage.getItem(prefix + key)) ?? fallback; }
  catch { return fallback; }
}

function save(key, value, storage = localStorage) {
  storage.setItem(prefix + key, JSON.stringify(value));
}

function html(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

let profiles = load("profiles", {});
let user = load("signed-in", "", sessionStorage);
if (!Object.hasOwn(profiles, user)) user = "";
let records = user ? load("records." + user, {}) : {};
let session = null;
let screen = "";
let filter = { year: "", group: "" };

function action(label, event, kind = "plain", data = "") {
  return `<button class="${kind}" data-action="${event}" data-value="${html(data)}" type="button">${label}</button>`;
}

function jumpTop() {
  window.scrollTo(0, 0);
}

function showHome() {
  screen = "home";
  session = null;
  account.innerHTML = user
    ? `<span class="account-name">${html(profiles[user].name)}</span>${action("登出", "logout")}`
    : "";
  const hero = `<section class="hero"><p class="eyebrow">臺灣警察專科學校 · 110–115 學年度</p>
    <h1>${user ? "今天要練哪一科？" : "警專入學考試題庫"}</h1>
    <p>按科目練習歷屆選擇題。做完一題看解析，也能整卷作答後再訂正。</p></section>`;
  if (!user) {
    app.innerHTML = hero + `<section class="card login"><h2>學生登入</h2>
      <p class="note">初次使用請建立帳號。帳號和練習紀錄保存在這個瀏覽器。</p>
      <form id="login">
        <label>帳號<input name="name" required maxlength="24" autocomplete="username" placeholder="輸入學生代稱"></label>
        <label>四位數密碼<input name="pin" required type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off"></label>
        <div class="form-actions"><button class="primary" type="submit" value="login">登入</button><button class="plain" type="submit" value="register">建立帳號</button></div>
        <p class="error" id="login-error" role="alert"></p>
      </form></section>`;
    return;
  }
  const practiced = itemsFor().filter(q => Object.hasOwn(records, q.id));
  app.innerHTML = hero + `<section class="subjects" aria-label="選擇科目">${subjects.map(subject => {
    const count = itemsFor(subject.id).length;
    return `<button class="subject" data-action="subject" data-value="${subject.id}"><span aria-hidden="true" class="icon">${subject.icon}</span><b>${subject.title}</b><small>${count} 題</small></button>`;
  }).join("")}</section><section class="card"><h2>我的練習</h2>
  <div class="overview"><span>已練習 <b>${practiced.length}</b> 題</span><span>待訂正 <b>${practiced.filter(q => records[q.id].wrong).length}</b> 題</span></div>
  ${action("複習全部錯題", "all-wrong", "soft")}</section>`;
}

async function pinDigest(pin, salt) {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", iterations: 120000, salt: encoder.encode(salt)
  }, material, 256);
  return Array.from(new Uint8Array(bits), value => value.toString(16).padStart(2, "0")).join("");
}

app.addEventListener("submit", async event => {
  if (event.target.id !== "login") return;
  event.preventDefault();
  const form = event.target;
  const message = document.getElementById("login-error");
  const data = new FormData(form);
  const name = String(data.get("name")).trim();
  const id = name.normalize("NFKC").toLowerCase();
  const pin = String(data.get("pin"));
  const creating = event.submitter?.value === "register";
  if (!id) { message.textContent = "請輸入帳號。"; return; }
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach(button => button.disabled = true);
  try {
    profiles = load("profiles", {});
    const existing = Object.hasOwn(profiles, id) ? profiles[id] : null;
    if (creating && existing) { message.textContent = "這個帳號已建立，請直接登入。"; return; }
    if (!creating && !existing) { message.textContent = "找不到這個帳號。初次使用請先建立帳號。"; return; }
    const salt = existing?.salt ?? crypto.randomUUID();
    const digest = await pinDigest(pin, salt);
    if (existing && digest !== existing.digest) { message.textContent = "密碼有誤，請再試一次。"; return; }
    if (creating) {
      const latest = load("profiles", {});
      if (Object.hasOwn(latest, id)) { message.textContent = "這個帳號已建立，請直接登入。"; return; }
      profiles = { ...latest, [id]: { name, salt, digest } };
      save("profiles", profiles);
    }
    save("signed-in", id, sessionStorage);
    user = id;
    records = load("records." + user, {});
    showHome();
    jumpTop();
  } catch {
    message.textContent = "無法儲存登入資料，請確認瀏覽器允許本站使用本機儲存空間。";
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
  const questionImages = q.crops?.length
    ? q.crops.map((_, i) => `./media/${q.paper.year}/${q.paper.subject}-${q.no}-${i}.webp`)
    : [pagePath(q.paper.year, q.page)];
  app.innerHTML = `<div class="breadcrumb">${action("離開練習", "back")} <span>${title}</span></div>
    <div class="heading"><h1>${labels[q.paper.subject]} · ${q.paper.year} 學年度</h1><span class="muted">${index + 1} / ${items.length} 題</span></div>
    <progress class="progress" max="${items.length}" value="${answered}" aria-label="已作答題數"></progress>
    <div class="quiz-layout"><section class="card question">
      <h2 id="question-title">原卷第 ${q.no} 題</h2>
      <p class="note">${q.options === 5 ? "多選題，可勾選多個答案" : "單選題，選一個答案"}${!q.crops?.length ? " · 請在原卷影像找到題號" : ""}</p>
      <div class="source-tools">${action(q.context ? "閱讀題組文章" : "開啟原卷與題組", "original", "plain")}${action("放大題圖", "zoom", "plain")}</div>
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
      </div></section>
      <aside class="card navigator"><h2>題號</h2><p class="note">已作答 ${answered} / ${items.length} 題</p>
      <div class="numbers">${items.map((item, i) => `<button data-action="goto" data-value="${i}" class="${picks[item.id] || Object.hasOwn(marked, item.id) ? "done" : ""}" ${i === index ? 'aria-current="step"' : ""} aria-label="第 ${i + 1} 題">${i + 1}</button>`).join("")}</div></aside></div>`;
}

function feedback(q, score, detailed) {
  if (!score) return "";
  const line = score.key === "*" ? "本題依標準答案一律給分" :
    `${score.ratio === 1 ? "答對了" : score.ratio ? "部分答對" : "這題可以再練一次"} · 正確答案 ${q.answers.join(" 或 ")}`;
  return `<section class="feedback ${score.ratio === 1 ? "" : "wrong"}" id="feedback" tabindex="-1" aria-live="polite">
    <h3>${line}</h3>
    ${detailed ? `<p><b>觀念</b>　${html(detailed[0])}</p><ol class="steps">${detailed.slice(1).map(step => `<li>${html(step)}</li>`).join("")}</ol>`
    : score.key === "*" ? "<p>原卷公告已更正本題計分方式。</p>" : "<p>這題目前有標準答案，逐題詳解待補。</p>"}
  </section>`;
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
  const latest = load("records." + user, {});
  for (const q of items) {
    const result = grade(q, session.picks[q.id]);
    latest[q.id] = { wrong: result.ratio < 1 };
  }
  records = latest;
  save("records." + user, records);
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
  if (!button || !user) return;
  const { action: eventName, value } = button.dataset;
  const q = session?.items[session.index];
  switch (eventName) {
    case "home": showHome(); jumpTop(); return;
    case "logout":
      sessionStorage.removeItem(prefix + "signed-in"); user = ""; records = {}; showHome(); jumpTop(); return;
    case "subject":
      filter = { year: "", group: "" }; showSubject(value); jumpTop(); return;
    case "back": goBack(); return;
    case "practice": case "exam":
      begin(itemsFor(null, papers.filter(p => p.id === value)), eventName, eventName === "exam" ? "整卷作答" : "逐題練習"); return;
    case "random": begin(shuffle(getFiltered()).slice(0, 10), "practice", "隨機練習"); return;
    case "taught": begin(getFiltered().filter(item => lessons[item.id]), "practice", "有詳解的題目"); return;
    case "all-wrong": begin(itemsFor().filter(item => records[item.id]?.wrong), "practice", "錯題複習"); return;
    case "subject-wrong": begin(getFiltered().filter(item => records[item.id]?.wrong), "practice", "錯題複習"); return;
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
      storeGrades([q]); session.marked[q.id] = true; showQuestion(); document.getElementById("feedback").focus(); return;
    case "submit-exam": {
      const blank = session.items.filter(item => !session.picks[item.id]).length;
      if (blank && !window.confirm(`還有 ${blank} 題未作答。確定要交卷嗎？`)) return;
      storeGrades(session.items); session.complete = true; showResult(); return;
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
