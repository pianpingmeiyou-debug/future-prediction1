// Simple state
const state = {
  user: null,
  events: [], // {id, title, type, date, amount, paymentMethod, installment}
};

const STORAGE_KEY = "futureflow_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.user) state.user = parsed.user;
    if (Array.isArray(parsed.events)) state.events = parsed.events;
  } catch (e) {
    console.warn("Failed to load state", e);
  }
}

function saveState() {
  try {
    const payload = {
      user: state.user,
      events: state.events,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to save state", e);
  }
}

function $(id) {
  return document.getElementById(id);
}

// ---------- Onboarding ----------

function setupOnboarding() {
  const overlay = $("onboarding-overlay");
  const careerYear = $("careerYear");

  setupChipGroup("bonusTypeGroup");
  setupChipGroup("companySizeGroup");
  setupChipGroup("anxietyTypeGroup");
  setupChipGroup("paymentMethodGroup");

  // default installment options for one-time card
  updateInstallmentOptions("card");

  const form = $("onboarding-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const bonusAmountInput = Number($("bonusAmount").value || 0);

    const user = {
      careerYear: Number(careerYear.value),
      salary: Number($("salary").value || 0),
      bonusType: getSelectedValue("bonusTypeGroup"),
      bonusAmount: Number.isFinite(bonusAmountInput) ? bonusAmountInput : 0,
      companySize: getSelectedValue("companySizeGroup"),
      industry: $("industry").value,
      companyName: $("companyName").value.trim(),
      anxietyType: Number(getSelectedValue("anxietyTypeGroup") || 6),
    };

    state.user = user;
    saveState();
    overlay.classList.remove("visible");
    refreshAllViews();
  });

  const openSettings = $("openSettingsOverlay");
  if (openSettings) {
    openSettings.addEventListener("click", () => {
      overlay.classList.add("visible");
    });
  }

  // Auto close onboarding if user data already exists
  if (state.user) {
    overlay.classList.remove("visible");
    // set UI controls from stored user for consistency
    careerYear.value = String(state.user.careerYear ?? 1);
    $("salary").value = state.user.salary || "";
    $("companyName").value = state.user.companyName || "";
    $("bonusAmount").value = state.user.bonusAmount || "";
  }
}

function setupChipGroup(groupId) {
  const container = $(groupId);
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    Array.from(
      container.querySelectorAll("button[data-value]")
    ).forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");

    if (groupId === "paymentMethodGroup") {
      updateInstallmentOptions(btn.dataset.value);
    }
  });
}

function getSelectedValue(groupId) {
  const container = $(groupId);
  if (!container) return null;
  const selected = container.querySelector("button.selected");
  return selected ? selected.dataset.value : null;
}

function normalizeNumber(value) {
  if (value === "unknown") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Tabs ----------

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.target;
      document
        .querySelectorAll(".tab-page")
        .forEach((p) => p.classList.remove("active"));
      $("tab-" + target).classList.add("active");
    });
  });
}

// ---------- Calendar ----------

let currentMonth = new Date();

function setupCalendar() {
  $("prevMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  $("nextMonth").addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  setupAddOverlay();
  setupAddEventForms();
  setupEditOverlay();
  renderCalendar();
}

function openEditModal(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  
  $("editEventId").value = ev.id;
  $("editEventTitle").value = ev.title;
  $("editEventAmount").value = ev.amount;

  $("edit-overlay").classList.add("visible");
}

function setupEditOverlay() {
  const overlay = $("edit-overlay");
  const close = $("closeEditOverlay");

  close.addEventListener("click", () => overlay.classList.remove("visible"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("visible");
  });

  $("saveEditEvent").addEventListener("click", () => {
    const id = $("editEventId").value;
    const title = $("editEventTitle").value.trim();
    const amount = Number($("editEventAmount").value) || 0;
    
    const ev = state.events.find(e => e.id === id);
    if (ev && title) {
      ev.title = title;
      ev.amount = amount;
      saveState();
      renderCalendar();
      refreshHomeAnalysis();
    }
    overlay.classList.remove("visible");
  });

  $("deleteFutureEvents").addEventListener("click", () => {
    const id = $("editEventId").value;
    const ev = state.events.find(e => e.id === id);
    if (!ev) return;
    
    if (confirm("この予定を今月以降の予定からも削除しますか？")) {
      const isAuto = ev.aiGenerated || ev.type === "installment" || ev.type === "recurring";
      const targetTitle = ev.title;
      const targetDate = ev.date;

      state.events = state.events.filter(e => {
        if (e.id === id) return false;
        if (isAuto && e.title === targetTitle && e.date >= targetDate) return false;
        return true;
      });

      saveState();
      renderCalendar();
      refreshHomeAnalysis();
      overlay.classList.remove("visible");
    }
  });
}

function setupAddOverlay() {
  const overlay = $("add-overlay");
  const open = $("openAddOverlay");
  const close = $("closeAddOverlay");

  open.addEventListener("click", () => overlay.classList.add("visible"));
  close.addEventListener("click", () => overlay.classList.remove("visible"));

  // backdrop click to close (but keep clicks inside card)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("visible");
  });
}

function setupAddEventForms() {
  const oneTimeTab = $("oneTimeTab");
  const recurringTab = $("recurringTab");
  const oneTimeForm = $("oneTimeForm");
  const recurringForm = $("recurringForm");

  oneTimeTab.addEventListener("click", () => {
    oneTimeTab.classList.add("pill-filled");
    recurringTab.classList.remove("pill-filled");
    oneTimeForm.classList.remove("hidden");
    recurringForm.classList.add("hidden");
  });

  recurringTab.addEventListener("click", () => {
    recurringTab.classList.add("pill-filled");
    oneTimeTab.classList.remove("pill-filled");
    recurringForm.classList.remove("hidden");
    oneTimeForm.classList.add("hidden");
  });

  $("addOneTimeEvent").addEventListener("click", () => {
    const title = $("oneTimeTitle").value.trim() || "一時的な出費";
    const date = $("oneTimeDate").value;
    const amount = Number($("oneTimeAmount").value || 0);
    const paymentMethod = getSelectedValue("paymentMethodGroup") || "lump";
    const installment = getSelectedValue("installmentGroup") || "";

    if (!date || amount <= 0) {
      alert("支払日と金額を入力してください。");
      return;
    }

    addOneTimeEvent({
      title,
      date,
      amount,
      paymentMethod,
      installment,
    });

    $("oneTimeTitle").value = "";
    $("oneTimeDate").value = "";
    $("oneTimeAmount").value = "";

    renderCalendar();
    refreshHomeAnalysis();
    $("add-overlay").classList.remove("visible");
  });

  $("addRecurringEvent").addEventListener("click", () => {
    const title = $("recurringTitle").value;
    const dayInput = $("recurringDay").value;
    const amount = Number($("recurringAmount").value || 0);

    if (!dayInput || amount <= 0) {
      alert("支払日(毎月)と月額を入力してください。");
      return;
    }
    const day = new Date(dayInput).getDate();

    addRecurringEvent({ title, day, amount });
    $("recurringDay").value = "";
    $("recurringAmount").value = "";

    renderCalendar();
    refreshHomeAnalysis();
    $("add-overlay").classList.remove("visible");
  });
}

function updateInstallmentOptions(method) {
  const section = $("installmentSection");
  const group = $("installmentGroup");
  group.innerHTML = "";

  let options = [];
  if (method === "card") {
    options = ["3回", "6回", "10回", "12回", "24回"];
  } else if (method === "shopping") {
    options = ["12回", "24回", "36回", "48回", "60回"];
  } else if (method === "bank") {
    options = ["1年", "2年", "3年", "5年", "7年", "10年"];
  } else {
    section.style.display = "none";
  }

  if (options.length) {
    section.style.display = "block";
    options.forEach((label, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (idx === 0 ? " selected" : "");
      btn.dataset.value = label;
      btn.textContent = label;
      group.appendChild(btn);
    });
  }

  setupChipGroup("installmentGroup");
}

function addOneTimeEvent({ title, date, amount, paymentMethod, installment }) {
  // 一括払いはその月に全額、ローン/分割は「月々」に割ってカレンダーへ展開する
  if (paymentMethod === "lump") {
    state.events.push({
      id: crypto.randomUUID(),
      title,
      type: "oneTime",
      date,
      amount,
      paymentMethod,
      installment: "",
    });
  } else {
    const times = parseInstallmentTimes(installment);
    const per = times > 0 ? amount / times : amount;
    const first = new Date(date);

    for (let i = 0; i < times; i++) {
      const d = new Date(
        first.getFullYear(),
        first.getMonth() + i,
        first.getDate()
      );
      state.events.push({
        id: crypto.randomUUID(),
        title: i === 0 ? `${title}（月々）` : `${title}（月々）`,
        type: "installment",
        date: d.toISOString().slice(0, 10),
        amount: Math.round(per * 10000) / 10000,
        paymentMethod,
        installment,
        aiGenerated: true,
        loanMonthlyYen: Math.round(per * 10000),
      });
    }
  }

  // AI自動生成 (単純ロジック)
  if (title.includes("車") || title.includes("自動車")) {
    const baseDate = new Date(date);
    const year = baseDate.getFullYear();
    const autoEvents = [
      {
        title: "自動車税",
        offsetMonths: 1,
        kind: "tax",
        amount: Math.round(amount * 0.02),
      },
      {
        title: "車検",
        offsetMonths: 24,
        kind: "event",
        amount: Math.round(amount * 0.15),
      },
      {
        title: "自動車保険",
        offsetMonths: 1,
        kind: "event",
        amount: 8,
      },
    ];

    autoEvents.forEach((ev) => {
      const d = new Date(year, baseDate.getMonth() + ev.offsetMonths, 1);
      state.events.push({
        id: crypto.randomUUID(),
        title: ev.title,
        type: ev.kind === "tax" ? "tax" : "oneTime",
        date: d.toISOString().slice(0, 10),
        amount: ev.amount,
        paymentMethod: "auto",
        installment: "",
        aiGenerated: true,
      });
    });
  }

  saveState();
}

function parseInstallmentTimes(label) {
  if (!label) return 1;
  const m = label.match(/(\d+)/);
  if (!m) return 1;
  const v = Number(m[1]);
  if (label.includes("年")) return v * 12;
  return v;
}

function addRecurringEvent({ title, day, amount }) {
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, day);
    state.events.push({
      id: crypto.randomUUID(),
      title,
      type: "recurring",
      date: d.toISOString().slice(0, 10),
      amount,
      paymentMethod: "monthly",
      installment: "",
    });
  }
  saveState();
}

function renderCalendar() {
  const monthLabel = $("calendarMonthLabel");
  const daysContainer = $("calendarDays");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthLabel.textContent = `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLast = new Date(year, month, 0);

  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({
      day: prevLast.getDate() - i,
      monthOffset: -1,
    });
  }

  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, monthOffset: 0 });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startWeekday + totalDays) + 1;
    cells.push({
      day: nextDay,
      monthOffset: 1,
    });
  }

  daysContainer.innerHTML = "";

  const monthEvents = filterEventsByMonth(year, month);
  const formatter = new Intl.NumberFormat("ja-JP");

  cells.forEach((cell) => {
    const cellDate = new Date(year, month + cell.monthOffset, cell.day);
    const dateStr = cellDate.toISOString().slice(0, 10);
    const dayEvents = monthEvents.filter((ev) => ev.date === dateStr);

    const el = document.createElement("div");
    el.className =
      "calendar-day" +
      (cell.monthOffset !== 0 ? " calendar-day--muted" : "");

    const num = document.createElement("div");
    num.className = "calendar-day-number";
    num.textContent = cell.day;
    el.appendChild(num);

    const list = document.createElement("div");
    list.className = "calendar-day-events";

    dayEvents.slice(0, 3).forEach((ev) => {
      const p = document.createElement("div");
      p.className =
        "calendar-pill " +
        (ev.type === "tax"
          ? "tax"
          : ev.type === "recurring"
          ? "fixed"
          : "event");
      // マス内はシンプルにイベント名だけ表示（例：車購入、家賃など）
      p.textContent = ev.title;
      list.appendChild(p);
    });

    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.className = "calendar-pill";
      more.textContent = `+${dayEvents.length - 3} 件`;
      list.appendChild(more);
    }

    el.appendChild(list);
    daysContainer.appendChild(el);
  });

  const totalMan = monthEvents.reduce((sum, ev) => sum + (ev.amount || 0), 0);
  const totalYen = Math.round(totalMan * 10000);

  const loanMonthlyYen = monthEvents
    .filter((ev) => ev.type === "installment")
    .reduce((sum, ev) => sum + Math.round((ev.amount || 0) * 10000), 0);

  // 1-2: 「この月の予定・天引き 合計目安」は、新しいクラスの方で大きく表示
  const topTotal = $("calendarTopTotalYen");
  const topLoan = $("calendarTopLoanYen");
  if (topTotal) {
    topTotal.textContent =
      totalYen > 0 ? `${totalYen.toLocaleString("ja-JP")} 円` : "-- 円";
  }
  if (topLoan) {
    topLoan.textContent =
      loanMonthlyYen > 0
        ? `ローン・分割：${loanMonthlyYen.toLocaleString("ja-JP")} 円/月`
        : "ローン・分割：-- 円/月";
  }

  const detailsList = $("paymentDetailsList");
  if (detailsList) {
    detailsList.innerHTML = "";
    if (monthEvents.length === 0) {
      detailsList.innerHTML = `<li class="payment-detail-item"><span class="payment-detail-name" style="color:var(--color-text-soft)">今月の支払いはありません</span></li>`;
    } else {
      monthEvents.forEach(ev => {
        let titleDisplay = ev.title;
        if (ev.type === "installment" && ev.installment) {
          titleDisplay += ` (${ev.installment})`;
        }
        const amtYen = Math.round((ev.amount || 0) * 10000);
        
        const li = document.createElement("li");
        li.className = "payment-detail-item";
        li.innerHTML = `
          <span class="payment-detail-name">${titleDisplay}</span>
          <span class="payment-detail-amount">${amtYen.toLocaleString("ja-JP")} <span style="font-size:10px;font-weight:normal">円</span></span>
          <button class="edit-btn" data-id="${ev.id}">編集</button>
        `;
        detailsList.appendChild(li);
      });
      
      detailsList.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          openEditModal(e.target.dataset.id);
        });
      });
    }
  }

  $("calendarSummary").textContent =
    totalYen > 0
      ? `この月の予定・天引き 合計目安：${totalYen.toLocaleString(
          "ja-JP"
        )} 円`
      : "この月の大きな出費はまだ登録されていません。";
}

function filterEventsByMonth(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  return state.events.filter((ev) => ev.date && ev.date.startsWith(ym));
}

// ---------- Home ----------

function refreshHomeView() {
  const user = state.user;
  if (!user) return;

  const salary = user.salary || 0;
  const yearlySalary = salary;

  let bonusTimes = 0;
  if (user.bonusType === "summer" || user.bonusType === "winter") {
    bonusTimes = 1;
  } else if (user.bonusType === "both") {
    bonusTimes = 2;
  }

  const bonusAmount = user.bonusAmount || 0;
  const predicted =
    yearlySalary + bonusTimes * (bonusAmount / 10); // ざっくり調整

  $("predictedIncome").textContent =
    predicted > 0 ? `${Math.round(predicted)} 万円` : "-- 万円";

  // 2年目の壁
  const alertMain = $("secondYearAlertMain");
  const alertDetail = $("secondYearAlertDetail");
  if (user.careerYear <= 1) {
    alertMain.textContent = "来年6月から住民税がスタートしそうです。";
    alertDetail.textContent = "手取り −18,000円/月 前後の変化が出ることが多いです。";
  } else if (user.careerYear === 2) {
    alertMain.textContent = "今がちょうど2年目の壁ゾーンです。";
    alertDetail.textContent = "住民税で手取りが少し減る時期なので、出費を意識できると安心です。";
  } else {
    alertMain.textContent = "住民税はすでに毎月の手取りに反映されています。";
    alertDetail.textContent = "大きな変化は小さいですが、年末調整の通知には目を通しておきましょう。";
  }

  // 不安メーター
  const anxietyMeter = $("anxietyMeter");
  const anxietyReason = $("anxietyReason");
  anxietyMeter.innerHTML = "";

  const badge = document.createElement("span");
  let reason = "";
  if (user.anxietyType === 1 || user.anxietyType === 3) {
    badge.textContent = "🟢 安定";
    badge.className = "badge badge-safe";
    reason = "貯金や手取りに余裕を持ちたいタイプ。今のペースなら前向きに進めそうです。";
  } else if (user.anxietyType === 2 || user.anxietyType === 5) {
    badge.textContent = "🟡 注意";
    badge.className = "badge badge-warning";
    reason = "将来イベントや貯金減少が気になるタイプ。カレンダーで先に出費を見ておくと安心です。";
  } else {
    badge.textContent = "🔴 危険？";
    badge.className = "badge badge-danger";
    reason = "手取りの変化に敏感なタイプ。まずは大きな出費だけ登録して、全体像をつかみましょう。";
  }
  anxietyMeter.appendChild(badge);
  anxietyReason.textContent = reason;

  // AIキャリア分析
  const list = $("careerAnalysisList");
  list.innerHTML = "";
  const points = buildCareerAnalysis(user);
  points.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });

  refreshHomeAnalysis();
}

function buildCareerAnalysis(user) {
  const result = [];
  if (user.industry === "it") {
    result.push("IT業界はスキル次第で昇給チャンスが多い傾向があります。");
  } else if (user.industry === "finance") {
    result.push("金融はボーナス比率が高く、景気の影響を受けやすい業界です。");
  } else if (user.industry === "service") {
    result.push("サービス業は残業やシフトで手取りが変わりやすい特徴があります。");
  }

  if (user.companySize === "large") {
    result.push("大企業は昇給カーブはゆるやかですが、安定度は高めです。");
  } else if (user.companySize === "sme" || user.companySize === "venture") {
    result.push("中小・ベンチャーはボーナスや昇給が年によって大きく変わる可能性があります。");
  } else if (user.companySize === "public") {
    result.push("公務員は収入の変動が小さく、長期の見通しを立てやすいタイプです。");
  }

  if (!result.length) {
    result.push("今の業界・企業での3年目までの手取り変化を先に知っておくと安心です。");
  }

  return result;
}

function refreshHomeAnalysis() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthEvents = state.events.filter(
    (ev) => ev.date && ev.date.startsWith(ym)
  );
  const total = monthEvents.reduce((sum, ev) => sum + (ev.amount || 0), 0);

  const el = $("thisMonthAnalysis");
  if (monthEvents.length === 0) {
    el.textContent =
      "今月の大きな出費は登録されていません。余裕のある月に先取り貯金ができるかもしれません。";
  } else if (total < 10) {
    el.textContent =
      "今月は出費が少なめです。来月以降のイベントをカレンダーに追加して、余裕をキープしましょう。";
  } else if (total < 30) {
    el.textContent =
      "今月はやや出費が多めです。2年目の壁やボーナス前後の変化も合わせてチェックしてみましょう。";
  } else {
    el.textContent =
      "今月はかなり大きな出費があります。支払い方法や分割回数を見直すと安心度が上がるかもしれません。";
  }
}

// ---------- Income forecast ----------

function setupIncomeGraph() {
  const buttons = document.querySelectorAll(
    'section#tab-income .year-toggle .chip'
  );
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const offset = Number(btn.dataset.yearOffset || 0);
      renderIncomeLine(offset);
    })
  );
  renderIncomeLine(0);
  window.addEventListener("resize", () => {
    const selected = document.querySelector(
      'section#tab-income .year-toggle .chip.selected'
    );
    const offset = selected ? Number(selected.dataset.yearOffset || 0) : 0;
    renderIncomeLine(offset);
  });
}

function renderIncomeLine(yearOffset) {
  const canvas = $("incomeCanvas");
  const tooltip = $("incomeTooltip");
  if (!canvas) return;

  // Resize for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = canvas.clientHeight || 320;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const user = state.user;
  if (!user) return;

  const baseSalary = user.salary || 0;
  const yearlyGrowth = user.industry === "it" ? 0.05 : 0.02;
  const salaryThisYear = baseSalary * (1 + yearlyGrowth * yearOffset);

  let bonusTimes = 0;
  if (user.bonusType === "summer" || user.bonusType === "winter") {
    bonusTimes = 1;
  } else if (user.bonusType === "both") {
    bonusTimes = 2;
  }
  const bonusPer = user.bonusAmount || (baseSalary / 4);
  const bonusTotal = bonusTimes * bonusPer;

  const months = Array.from({ length: 12 }, (_, i) => i);

  const taxBaseIncome = salaryThisYear + bonusTotal / 10;
  const taxRate = user.careerYear + yearOffset >= 2 ? 0.23 : 0.18;

  const series = months.map((m) => {
    const monthSalary = salaryThisYear / 12;
    const isBonusMonth =
      bonusTimes === 2
        ? m === 5 || m === 11
        : bonusTimes === 1 && (m === 5 || m === 11);
    const bonus = isBonusMonth ? bonusPer * 0.8 : 0;

    const taxIncome = monthSalary + bonus;
    const tax = taxIncome * taxRate;
    const takeHome = Math.max(taxIncome - tax, 0);

    return {
      month: m + 1,
      takeHome,
      salary: monthSalary,
      bonus,
      taxIncome,
    };
  });

  const maxY = Math.max(
    ...series.map((p) => Math.max(p.takeHome, p.salary + p.bonus))
  );

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssWidth;
  const h = cssHeight;
  const pad = { l: 16, r: 16, t: 16, b: 28 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  // background grid
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(10, 35, 80, 0.08)";
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + plotW, y);
    ctx.stroke();
  }

  // x-axis
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(10, 35, 80, 0.2)";
  ctx.beginPath();
  ctx.moveTo(pad.l, h - pad.b);
  ctx.lineTo(pad.l + plotW, h - pad.b);
  ctx.stroke();

  // y-axis
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, h - pad.b);
  ctx.stroke();

  function xAt(idx) {
    return pad.l + (plotW * idx) / (series.length - 1);
  }
  function yAt(value) {
    return pad.t + plotH - (plotH * value) / (maxY || 1);
  }

  // draw line helper with glow and fill
  function drawLine(values, color, fillColors) {
    if (fillColors) {
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(xAt(values.length - 1), yAt(0));
      ctx.lineTo(xAt(0), yAt(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, fillColors[0]);
      grad.addColorStop(1, fillColors[1]);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }

  // salary (purple) and takehome (blue)
  drawLine(series.map((p) => p.salary), "#8b5cf6", ["rgba(139, 92, 246, 0.2)", "rgba(139, 92, 246, 0.0)"]);
  drawLine(series.map((p) => p.takeHome), "#3b82f6", ["rgba(59, 130, 246, 0.2)", "rgba(59, 130, 246, 0.0)"]);

  // bonus markers
  ctx.fillStyle = "#ef4444";
  ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
  ctx.shadowBlur = 8;
  series.forEach((p, i) => {
    if (p.bonus <= 0) return;
    const x = xAt(i);
    const y = yAt(p.salary + p.bonus);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    // white center
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
    ctx.shadowBlur = 8;
  });
  ctx.shadowBlur = 0;

  // x labels (dark for light canvas)
  ctx.fillStyle = "rgba(10, 35, 80, 0.6)";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, sans-serif";
  series.forEach((p, i) => {
    if (i % 2 === 1) return;
    const x = xAt(i);
    ctx.fillText(`${p.month}月`, x - 10, h - 8);
  });

  // Tooltip interaction
  const rectProvider = () => canvas.getBoundingClientRect();
  function hideTip() {
    tooltip.classList.add("hidden");
  }

  canvas.onmouseleave = hideTip;
  canvas.onmousemove = (e) => {
    const rect = rectProvider();
    const x = e.clientX - rect.left;
    const idx = Math.round(((x - pad.l) / plotW) * (series.length - 1));
    const safeIdx = Math.max(0, Math.min(series.length - 1, idx));
    const p = series[safeIdx];

    const tipX = e.clientX - rect.left + 10;
    const tipY = e.clientY - rect.top - 12;
    tooltip.classList.remove("hidden");
    tooltip.style.left = `${tipX}px`;
    tooltip.style.top = `${tipY}px`;

    const taxBreakdown = buildTaxBreakdown(p.taxIncome, user, yearOffset);
    tooltip.innerHTML = `<strong>${p.month}月の目安</strong><br />
      手取り 約${p.takeHome.toFixed(0)}万円<br />
      ${taxBreakdown}`;
  };

  refreshStabilityText();
}

function buildTaxBreakdown(taxIncome, user, yearOffset) {
  const base = Math.max(taxIncome, 0);
  const incomeTax = Math.round(base * 0.12);
  const residentTax =
    user.careerYear + yearOffset >= 2 ? Math.round(base * 0.15) : 0;
  const pension = Math.round(2.5);
  return `所得税 約${incomeTax}千円 / 住民税 約${residentTax}千円 / 厚生年金 約${pension}万円`;
}

function refreshStabilityText() {
  const user = state.user;
  const el = $("stabilityText");
  if (!user) return;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthEvents = state.events.filter(
    (ev) => ev.date && ev.date.startsWith(ym)
  );
  const totalOut = monthEvents.reduce(
    (sum, ev) => sum + (ev.amount || 0),
    0
  );
  const monthlyTakeHome = (user.salary || 0) / 12;

  if (totalOut === 0) {
    el.textContent =
      "今月の大きな出費は登録されていません。余裕があるうちに将来のイベントも少しずつ登録しておきましょう。";
  } else {
    const ratio = totalOut / (monthlyTakeHome || 1);
    if (ratio < 0.3) {
      el.textContent =
        "出費は手取りの3割未満。安定ゾーンです。貯金や自己投資にまわせる余白もありそうです。";
    } else if (ratio < 0.6) {
      el.textContent =
        "出費は手取りの3〜6割ほど。もう少し増えても大丈夫ですが、2年目の壁タイミングには注意しましょう。";
    } else {
      el.textContent =
        "出費が手取りの多くを占めています。分割払いやタイミング調整で、ピークをならすと安心度が上がります。";
    }
  }
}

// ---------- Furusato ----------

function refreshFurusatoView() {
  const user = state.user;
  if (!user) return;

  const yearly = (user.salary || 0) * 10000;
  const limit = Math.round(yearly * 0.08 / 1000) * 1000;

  $("furusatoLimit").textContent =
    limit > 0 ? `${limit.toLocaleString("ja-JP")} 円まで可能` : "-- 円まで可能";

  const startBtn = $("startFurusatoNav");
  startBtn.addEventListener("click", () => {
    startBtn.classList.add("hidden");
    $("furusatoProgress").classList.remove("hidden");
    $("progressFill").style.width = "0%";
    $("q1-block").classList.remove("hidden");
  });

  const chips = document.querySelectorAll(".furusato-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      // Find siblings and remove selected
      const siblings = chip.parentElement.querySelectorAll(".chip");
      siblings.forEach(s => s.classList.remove("selected"));
      chip.classList.add("selected");
      
      const qNum = parseInt(chip.dataset.q, 10);
      
      if (qNum === 1) {
        $("q1-block").classList.add("hidden");
        $("q2-block").classList.remove("hidden");
        $("progressFill").style.width = "33%";
      } else if (qNum === 2) {
        $("q2-block").classList.add("hidden");
        $("q3-block").classList.remove("hidden");
        $("progressFill").style.width = "66%";
      } else if (qNum === 3) {
        $("q3-block").classList.add("hidden");
        showFurusatoResult();
        $("progressFill").style.width = "100%";
      }
    });
  });

  $("resetFurusatoNav").addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("selected"));
    startBtn.classList.remove("hidden");
    $("furusatoProgress").classList.add("hidden");
    $("q1-block").classList.add("hidden");
    $("q2-block").classList.add("hidden");
    $("q3-block").classList.add("hidden");
    $("furusatoResultBlock").classList.add("hidden");
  });
}

function showFurusatoResult() {
  const q1 = document.querySelector('.furusato-chip[data-q="1"].selected')?.dataset.val === 'yes';
  const q2 = document.querySelector('.furusato-chip[data-q="2"].selected')?.dataset.val === 'yes';
  const q3 = document.querySelector('.furusato-chip[data-q="3"].selected')?.dataset.val === 'yes';

  const needsKakutei = q1 || q2 || q3;
  const main = $("furusatoResultMain");
  const detail = $("furusatoResultDetail");

  $("furusatoResultBlock").classList.remove("hidden");

  if (needsKakutei) {
    main.textContent = "確定申告 が必要になりそうです。";
    let reasons = [];
    if (q1) reasons.push("副業収入等がある");
    if (q2) reasons.push("医療費控除を受ける");
    if (q3) reasons.push("6自治体以上に寄付する");
    detail.textContent = `${reasons.join("、")}ため、ワンストップ特例ではなく確定申告を行いましょう。`;
  } else {
    main.textContent = "ワンストップ特例申請 が使えそうです。";
    detail.textContent = "会社員で条件をすべて満たしているため、確定申告なしでふるさと納税が完了します。書類の郵送やオンライン申請を忘れずに！";
  }
}

// ---------- Boot ----------

function refreshAllViews() {
  refreshHomeView();
  renderCalendar();
  setupIncomeGraph();
  refreshFurusatoView();
}

window.addEventListener("DOMContentLoaded", () => {
  loadState();
  setupTabs();
  setupOnboarding();
  setupCalendar();
  setupIncomeGraph();
  refreshHomeView();
  refreshFurusatoView();
});

