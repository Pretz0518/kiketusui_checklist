const { CONSTITUTIONS, DISCLAIMER, groups, title, subtitle, eventName, organizer } =
  window.KiketsuuiData;

const checklistEl = document.getElementById("checklist");
const formEl = document.getElementById("check-form");
const resultsSection = document.getElementById("results");
const checkSection = document.getElementById("check-section");
const resultHeadlineEl = document.getElementById("result-headline");
const resultTypesEl = document.getElementById("result-types");
const resultDisclaimerEl = document.getElementById("result-disclaimer");
const scoreSummaryEl = document.getElementById("score-summary");
const backBtn = document.getElementById("back-to-check");
const chartCanvas = document.getElementById("score-chart");
const stickyTotalEl = document.getElementById("sticky-total");

/** @type {import('chart.js').Chart | null} */
let chartInstance = null;

function byNumber() {
  return [...CONSTITUTIONS].sort((a, b) => a.number - b.number);
}

function renderMeta() {
  const titleEl = document.getElementById("app-title");
  const leadEl = document.getElementById("app-lead");
  const eventEl = document.getElementById("event-name");
  const orgEl = document.getElementById("organizer-name");
  if (titleEl) titleEl.textContent = title;
  if (leadEl) leadEl.textContent = subtitle;
  if (eventEl) eventEl.textContent = eventName;
  if (orgEl) orgEl.textContent = organizer;
}

function renderChecklist() {
  checklistEl.replaceChildren();

  for (const group of groups) {
    const groupWrap = document.createElement("div");
    groupWrap.className = `group-banner group-banner--${group.id}`;
    groupWrap.innerHTML = `
      <div class="group-banner__badge">${group.label}</div>
      <p class="group-banner__hint">${group.hint}</p>
    `;
    checklistEl.append(groupWrap);

    const grid = document.createElement("div");
    grid.className = "type-grid";
    grid.dataset.group = group.id;

    for (const c of byNumber().filter((x) => x.group === group.id)) {
      grid.append(buildTypeCard(c));
    }
    checklistEl.append(grid);
  }

  updateLiveCounts();
}

function buildTypeCard(c) {
  const card = document.createElement("section");
  card.className = "type-card-check";
  card.dataset.constitutionId = c.id;
  card.style.setProperty("--type-accent", c.color);

  const header = document.createElement("header");
  header.className = "type-card-check__head";
  header.innerHTML = `
    <div class="type-card-check__icon-wrap">
      <img src="${c.icon}" alt="" class="type-card-check__icon" width="72" height="72" loading="lazy" />
    </div>
    <div class="type-card-check__titles">
      <p class="type-card-check__num">${c.number}.</p>
      <h2>
        <span class="type-name">${c.name}</span>
        <span class="type-reading">（${c.reading}）</span>
      </h2>
      <p class="type-nickname">${c.nickname}</p>
    </div>
    <div class="type-card-check__sum" aria-live="polite">
      <span class="sum-label">合計</span>
      <span class="sum-value" data-count-for="${c.id}">0</span>
      <span class="sum-unit">個</span>
    </div>
  `;

  const list = document.createElement("ul");
  list.className = "check-list";

  c.items.forEach((label, index) => {
    const li = document.createElement("li");
    const id = `${c.id}-${index}`;
    const labelEl = document.createElement("label");
    labelEl.htmlFor = id;
    labelEl.className = "check-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.name = c.id;
    input.value = String(index);
    input.dataset.constitutionId = c.id;

    const mark = document.createElement("span");
    mark.className = "check-mark";
    mark.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "check-text";
    text.textContent = label;

    labelEl.append(input, mark, text);
    li.append(labelEl);
    list.append(li);
  });

  card.append(header, list);
  return card;
}

function getScores() {
  /** @type {Record<string, number>} */
  const scores = Object.fromEntries(CONSTITUTIONS.map((c) => [c.id, 0]));
  for (const input of formEl.querySelectorAll('input[type="checkbox"]:checked')) {
    const id = input.dataset.constitutionId;
    if (id && id in scores) scores[id]++;
  }
  return scores;
}

function updateLiveCounts() {
  const scores = getScores();
  let total = 0;
  for (const c of CONSTITUTIONS) {
    const n = scores[c.id];
    total += n;
    const el = document.querySelector(`[data-count-for="${c.id}"]`);
    if (el) el.textContent = String(n);
  }
  if (stickyTotalEl) stickyTotalEl.textContent = String(total);
}

/**
 * ①最多を表示 ②同点が複数なら列挙
 * ③5個以上は最多の後ろに列挙 ④ゼロなら整っている
 */
function resolveResultTypes(scores) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return { kind: "balanced", typeIds: [], scores, total };

  const max = Math.max(...Object.values(scores));
  const primary = CONSTITUTIONS.filter((c) => scores[c.id] === max).map((c) => c.id);
  const highThreshold = CONSTITUTIONS.filter(
    (c) => scores[c.id] >= 5 && !primary.includes(c.id),
  ).map((c) => c.id);

  return {
    kind: "types",
    typeIds: [...primary, ...highThreshold],
    scores,
    max,
    total,
  };
}

function formatTypeNames(typeIds) {
  return typeIds.map((id) => CONSTITUTIONS.find((c) => c.id === id)?.name ?? id);
}

function renderScorePills(scores) {
  scoreSummaryEl.replaceChildren();
  for (const c of byNumber()) {
    const pill = document.createElement("div");
    pill.className = "score-pill";
    pill.style.setProperty("--type-accent", c.color);
    pill.innerHTML = `
      <img src="${c.icon}" alt="" width="40" height="40" />
      <div>
        <strong>${c.name}</strong>
        <span>${scores[c.id]}点</span>
      </div>
    `;
    scoreSummaryEl.append(pill);
  }
}

function renderResults(result) {
  resultsSection.hidden = false;
  checkSection.hidden = true;
  resultDisclaimerEl.textContent = DISCLAIMER;
  resultTypesEl.replaceChildren();
  renderScorePills(result.scores ?? getScores());

  if (result.kind === "balanced") {
    resultHeadlineEl.textContent = "あなたの身体と心は整っています";
    resultHeadlineEl.className = "result-headline result-headline--balanced";
    updateChart(result);
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const names = formatTypeNames(result.typeIds);
  resultHeadlineEl.textContent =
    names.length === 1
      ? `あなたは${names[0]}タイプです`
      : `あなたは、${names.join("、")}タイプです`;
  resultHeadlineEl.className = "result-headline";

  for (const id of result.typeIds) {
    const c = CONSTITUTIONS.find((x) => x.id === id);
    if (!c) continue;
    const article = document.createElement("article");
    article.className = "result-type-card";
    article.style.setProperty("--type-accent", c.color);
    article.innerHTML = `
      <img src="${c.icon}" alt="" class="result-type-card__icon" width="88" height="88" />
      <div>
        <h3>${c.name}<span class="type-reading">（${c.reading}）</span>
          <span class="type-count">${result.scores[id]}個</span>
        </h3>
        <p class="type-nickname">${c.nickname}</p>
        <p>${c.description}</p>
      </div>
    `;
    resultTypesEl.append(article);
  }

  updateChart(result);
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateChart(result) {
  const ordered = byNumber();
  const labels = ordered.map((c) => c.name);
  const data =
    result.kind === "balanced"
      ? ordered.map(() => 0)
      : ordered.map((c) => result.scores[c.id]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(chartCanvas, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "チェック数",
          data,
          backgroundColor: "rgba(139, 94, 60, 0.28)",
          borderColor: "rgba(139, 94, 60, 0.9)",
          borderWidth: 2,
          pointBackgroundColor: "#8b5e3c",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#8b5e3c",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "体質バランスグラフ　気･血･水",
          color: "#2c2419",
          font: { size: 16, weight: "600", family: "inherit" },
          padding: { bottom: 12 },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ` ${ctx.parsed.r} 点`;
            },
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 10,
          beginAtZero: true,
          ticks: {
            stepSize: 2,
            backdropColor: "transparent",
            color: "#6b5f52",
            font: { size: 11 },
          },
          pointLabels: {
            color: "#2c2419",
            font: { size: 13, weight: "600", family: "inherit" },
          },
          grid: { color: "rgba(139, 94, 60, 0.18)" },
          angleLines: { color: "rgba(139, 94, 60, 0.18)" },
        },
      },
    },
  });
}

formEl.addEventListener("change", updateLiveCounts);

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const scores = getScores();
  renderResults(resolveResultTypes(scores));
});

backBtn.addEventListener("click", () => {
  resultsSection.hidden = true;
  checkSection.hidden = false;
  checkSection.scrollIntoView({ behavior: "smooth" });
});

renderMeta();
renderChecklist();
