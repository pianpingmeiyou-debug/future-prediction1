// FutureFlow - Soft UI App Logic

// User State (Including new params)
let userState = {
    expYear: 1, // 1, 2, 3+
    income: 0, // gross annual
    hasBonus: false,
    bonusAmount: 0, // per bonus, ~2 times a year
    companySize: 'other', // large, medium, startup, public, other
    industry: 'other',
    companyName: '',
    anxietyProfile: 6, // 1~6
    expenses: [], // { id, name, date (YYYY-MM-DD), cost, isTax, desc, isAI }
    
    // Calculated values for AI
    monthlyGross: 0,
    yearlyBonusSum: 0
};

let editingExpenseId = null; // Track if we are editing an existing item

// UI State
let currentCalMonthStr = "";
let chartInstances = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Ensure Step 1 is active and others are hidden
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');

    // Show onboarding
    document.getElementById('onboarding-modal').classList.remove('hidden');
    
    const today = new Date();
    currentCalMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
});

// --- Onboarding Logic ---
function toggleBonusInput() {
    const v = document.getElementById('bonus-timing').value;
    const group = document.getElementById('bonus-amount-group');
    if(v === 'summer-winter') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
    }
}

function nextStep(stepNumber) {
    if(stepNumber === 2) {
        const inc = document.getElementById('income').value;
        if(!inc) return alert("現在の額面年収を入力してください");
        
        userState.income = parseInt(inc) * 10000;
        userState.expYear = parseInt(document.getElementById('exp-year').value);
        userState.companySize = document.getElementById('company-size').value;
        userState.industry = document.getElementById('industry').value;
        userState.companyName = document.getElementById('company-name').value;
        
        const bTime = document.getElementById('bonus-timing').value;
        let bAmt = document.getElementById('bonus-amount').value;
        
        if (bTime === 'summer-winter') {
            userState.hasBonus = true;
            userState.bonusAmount = bAmt ? parseInt(bAmt) * 10000 : 0;
            userState.yearlyBonusSum = userState.bonusAmount * 2;
        } else if (bTime === 'unknown') {
            userState.hasBonus = true;
            // AI Mock: Guess bonus is 15% of annual income over 2 times
            userState.bonusAmount = Math.floor(userState.income * 0.15 / 2);
            userState.yearlyBonusSum = userState.bonusAmount * 2;
        } else {
            userState.hasBonus = false;
            userState.bonusAmount = 0;
            userState.yearlyBonusSum = 0;
        }

        userState.monthlyGross = Math.floor((userState.income - userState.yearlyBonusSum) / 12);
        if(userState.monthlyGross < 0) userState.monthlyGross = Math.floor(userState.income / 12);
    }

    // Class Management
    document.querySelectorAll('.step').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden'); // Ensure old step is fully hidden
    });
    
    const nextItem = document.getElementById(`step-${stepNumber}`);
    nextItem.classList.remove('hidden'); // Ensure hidden is removed
    nextItem.classList.add('active');
}

function selectAnxietyProfile(profileId) {
    userState.anxietyProfile = profileId;
    finishOnboarding();
}

function finishOnboarding() {
    showLoadingAI(() => {
        document.getElementById('onboarding-modal').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        
        runAILogic();
        updateAllUI();
        switchTab('home'); // Default tab
    });
}

function showLoadingAI(callback) {
    const loader = document.getElementById('ai-loading');
    loader.classList.remove('hidden');
    setTimeout(() => {
        loader.classList.add('hidden');
        callback();
    }, 1500); // 1.5s fake AI logic computation
}

// --- Navigation ---
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
        targetTab.classList.add('active');
    }
    
    // Update Nav buttons
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector(`button[onclick="switchTab('${tabId}')"]`);
    if (btn) btn.classList.add('active');

    // Tab specific logic execution
    if(tabId === 'prediction') {
        renderChart();
        // Ensure chart resizes after container is visible
        if (chartInstances.main) {
            setTimeout(() => {
                chartInstances.main.resize();
            }, 50);
        }
    }
    if(tabId === 'calendar') renderCalendar();
}

function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function openOnboardingFromSettings() {
    closeModal('settings-modal');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('onboarding-modal').classList.remove('hidden');
    // Clear existing AI events to allow re-generation
    userState.expenses = userState.expenses.filter(e => !e.isAI);
    nextStep(1);
}

// --- AI Logic (Mock) ---
function runAILogic() {
    // 1. Generate 2nd Year Resident Tax Alarms
    generateAIResidentTaxEvents();
    // 2. Generate Company Analysis Alert
    generateCompanyAnalysis();
}

function generateMonthExpenseAnalysis() {
    const titleObj = document.getElementById('ai-monthly-title');
    const textObj = document.getElementById('ai-monthly-text');
    
    // Calculate current month's total expenses
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    let monthTotal = 0;
    let hasBigExpense = false;
    
    userState.expenses.forEach(e => {
        if(e.date.startsWith(currentMonthStr)) {
            monthTotal += e.cost;
            if(e.cost >= 10) hasBigExpense = true;
        }
    });

    if (monthTotal === 0) {
        titleObj.innerText = "出費予定なし";
        textObj.innerText = "今月の予定された出費はまだありません。余裕があるうちに貯蓄に回すのも良いでしょう。";
    } else if (hasBigExpense) {
        titleObj.innerText = `今月は出費多め（計${monthTotal}万円）`;
        textObj.innerText = "今月は大きな出費が予定されています。ボーナスや貯金など、引き落とし口座の残高を事前に確認しておきましょう。";
    } else {
        titleObj.innerText = `今月は安定（計${monthTotal}万円）`;
        textObj.innerText = `今月の出費予定は計${monthTotal}万円です。毎月の手取り（約${userState.monthlyGross}万円）から無理なく支払える水準です。`;
    }
}

function generateCompanyAnalysis() {
    const titleObj = document.getElementById('ai-company-title');
    const textObj = document.getElementById('ai-company-text');
    
    let compNameStr = userState.companyName ? `「${userState.companyName}」様での勤務、` : "";
    
    let sizeDetails = "";
    if (userState.companySize === 'large') sizeDetails = "大企業は福利厚生が手厚く、住宅手当などが期待できるため、額面以上の可処分所得が残る可能性があります。";
    else if (userState.companySize === 'medium') sizeDetails = "中小企業は能力次第で昇給ペースが早い場合があり、柔軟な働き方ができることが多いです。";
    else if (userState.companySize === 'startup') sizeDetails = "ベンチャーはストックオプションや成果報酬など、ベース年収以外のアップサイドに期待できます。";
    else if (userState.companySize === 'public') sizeDetails = "公務員は非常に安定した昇給曲線を描きやすく、長期的なライフプラン（住宅ローン等）が最も立てやすい属性です。";
    else sizeDetails = "多様な働き方が増えている現在、自身のスキルアップがダイレクトに年収維持に繋がります。";

    let indDetails = "";
    if (userState.industry === 'it') indDetails = "IT・エンジニア職などは独立や転職による年収ジャンプアップが起きやすい業界です。";
    else if (userState.industry === 'finance' || userState.industry === 'realestate' || userState.industry === 'medical') indDetails = "専門性が高く、平均的なベース年収は高めに推移し、ボーナス比率も大きい傾向があります。";
    else if (userState.industry === 'auto' || userState.industry === 'electronics' || userState.industry === 'energy') indDetails = "大手製造業やインフラ系は安定したボーナス支給が多く、業績連動でまとまった収入が入りやすい傾向があります。";
    else indDetails = "安定したパフォーマンスを出し続けることで、着実なキャリア形成が見込めます。";

    titleObj.innerText = `${compNameStr}今後の収入トレンド分析`;
    textObj.innerText = `${sizeDetails} \n${indDetails}`;
}

function calcTaxes(monthIndex, isBonusMonth) {
    let gross = isBonusMonth ? userState.bonusAmount : userState.monthlyGross;
    let health = Math.floor(gross * 0.05); 
    let pension = Math.floor(gross * 0.0915); 
    let emp = Math.floor(gross * 0.006); 
    let taxable = gross - health - pension - emp;
    if(taxable < 0) taxable = 0;
    let incomeTax = Math.floor(taxable * 0.05); 
    let resident = 0;
    if (!isBonusMonth) {
        let monthsToYear2June = 0;
        if(userState.expYear === 1) monthsToYear2June = 8; 
        else if(userState.expYear === 2) monthsToYear2June = 0; 
        else monthsToYear2June = -12; 
        if (monthIndex >= monthsToYear2June) {
            resident = Math.floor((userState.income * 0.1) / 12);
        }
    }
    let net = gross - incomeTax - health - pension - emp - resident;
    return { gross, incomeTax, health, pension, employment: emp, resident, net };
}

function generateAIResidentTaxEvents() {
    const today = new Date();
    const aTitle = document.getElementById('ai-alert-title');
    const aText = document.getElementById('ai-alert-text');
    let resTaxMonthly = Math.floor((userState.income * 0.1) / 12 / 10000); 
    
    if (userState.expYear === 1) {
        let nextYear = today.getFullYear() + 1;
        aTitle.innerText = "2年目の壁（来年6月〜）";
        aText.innerText = `${nextYear}年6月から本格的に「住民税」が引かれ始めます。月額 約${resTaxMonthly}万円 手取りが減る予測ですので、今のうちに貯蓄癖をつけましょう！`;
        userState.expenses.push({
            id: 'ai-res-' + Date.now(),
            name: '住民税の天引き開始',
            date: `${nextYear}-06`,
            cost: resTaxMonthly,
            isTax: true,
            isAI: true,
            desc: `前年度の収入に基づく税金です（以降毎月発生）`
        });
    } else if (userState.expYear === 2) {
        aTitle.innerText = "2年目の住民税引去り中";
        aText.innerText = `現在、去年の収入に基づく住民税が引かれています（月額約${resTaxMonthly}万円）。手取りが減って辛い時期ですが、ここが踏ん張りどころです。`;
    } else {
        aTitle.innerText = "安定期（住民税適応済）";
        aText.innerText = `すでに住民税は安定して引かれています。今後の大幅な手取り減は少ない見込みです。将来の大きな出費に備えましょう。`;
    }
}

function handleAIEventInjection(eventName, dateStr) {
    if (eventName.includes('車')) {
        let [y, m] = dateStr.split('-');
        let nextYear = parseInt(y) + 1;
        userState.expenses.push({
            id: 'ai-car-tax-' + Date.now(),
            name: '自動車税',
            date: `${nextYear}-05-01`, 
            cost: 3, 
            isTax: true,
            isAI: true,
            desc: `<i class="fas fa-robot"></i> AI追加: 車を所有すると毎年5月に税金がかかります`
        });
        let shakenYear = parseInt(y) + 3; 
        userState.expenses.push({
            id: 'ai-car-shaken-' + Date.now(),
            name: '車検',
            date: `${shakenYear}-${m}-01`,
            cost: 10,
            isTax: true, 
            isAI: true,
            desc: `<i class="fas fa-robot"></i> AI追加: 初回（3年後）の車検費用見積もり`
        });
        alert("AI: 車の購入を検知しました！\n今後の「自動車税(毎年5月)」と「車検(3年後)」を自動でカレンダーに書き込みました。");
    }
}

function updateAllUI() {
    document.getElementById('disp-income').innerText = (userState.income / 10000).toLocaleString();
    generateMonthExpenseAnalysis();
    let fwLimit = Math.floor(userState.income * 0.015);
    if(fwLimit < 10000) fwLimit = 10000;
    document.getElementById('furusato-amount').innerText = `${fwLimit.toLocaleString()} 円`;
    updateAnxietyMeter();
}

// --- Calendar ---
function changeCalendarMonth(offset) {
    let [y, m] = currentCalMonthStr.split('-');
    let date = new Date(y, parseInt(m) - 1 + offset, 1);
    currentCalMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    renderCalendar();
}

function renderCalendar() {
    let [yStr, mStr] = currentCalMonthStr.split('-');
    document.getElementById('cal-month-display').innerText = `${yStr}年 ${parseInt(mStr)}月`;
    const list = document.getElementById('expense-list');
    list.innerHTML = '';
    let monthEvents = userState.expenses.filter(e => e.date.substring(0, 7) === currentCalMonthStr);
    if(monthEvents.length === 0) {
        list.innerHTML = `<div class="text-center text-sub py-2">この月の予定や特別な天引きはありません 🌱</div>`;
        return;
    }
    monthEvents.sort((a,b) => (b.cost - a.cost));
    monthEvents.forEach(ex => {
        let el = document.createElement('div');
        el.className = `timeline-item ${ex.isTax ? 'tax-event' : ''}`;
        let costStr = ex.cost > 0 ? `約 ${ex.cost}万円` : '';
        let badge = ex.isAI ? `<span class="badge-ai">AI追加</span>` : '';
        let dayStr = ex.date.length > 7 ? parseInt(ex.date.substring(8, 10)) + "日" : `${parseInt(mStr)}月`;
        el.innerHTML = `
            <div class="t-date">${dayStr}</div>
            <div class="t-content">
                <div class="t-title">${ex.name} ${badge}</div>
                ${costStr ? `<div class="t-cost">${costStr}</div>` : ''}
                ${ex.desc ? `<div class="t-desc">${ex.desc}</div>` : ''}
            </div>
            <div class="t-actions">
                <button class="edit-btn" onclick="editExpense('${ex.id}')"><i class="fas fa-pen"></i></button>
            </div>
        `;
        list.appendChild(el);
    });
    renderCalendarGrid();
}

function renderCalendarGrid() {
    const container = document.getElementById('calendar-grid-container');
    if (!container) return;
    container.innerHTML = '';
    const [y, m] = currentCalMonthStr.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
    let monthDayEvents = {};
    userState.expenses.forEach(e => {
        if(e.date.startsWith(currentCalMonthStr) && e.date.length > 7) {
            monthDayEvents[parseInt(e.date.substring(8, 10))] = true;
        }
    });
    const prevMonthLastDay = new Date(y, m - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.innerText = prevMonthLastDay - i;
        container.appendChild(d);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = d;
        if (isCurrentMonth && d === today.getDate()) dayDiv.classList.add('today');
        if (monthDayEvents[d]) {
            dayDiv.classList.add('has-event');
            const dot = document.createElement('div');
            dot.className = 'day-dot';
            dayDiv.appendChild(dot);
        }
        container.appendChild(dayDiv);
    }
    const currentCells = container.children.length;
    for (let i = 1; i <= 42 - currentCells; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day other-month';
        d.innerText = i;
        container.appendChild(d);
    }
}

function toggleInstallmentSelect() {
    const method = document.getElementById('payment-method').value;
    const group = document.getElementById('installment-group');
    const select = document.getElementById('installment-count');
    if (method !== 'once') {
        group.classList.remove('hidden');
        select.innerHTML = '';
        if (method === 'bank-loan') {
            select.innerHTML = `<option value="12">1年</option><option value="24">2年</option><option value="36">3年</option><option value="60">5年</option><option value="84">7年</option><option value="120">10年</option>`;
        } else if (method === 'shopping-loan') {
            select.innerHTML = `<option value="12">12回</option><option value="24">24回</option><option value="36">36回</option><option value="48">48回</option><option value="60">60回（5年）</option>`;
        } else if (method === 'card-split') {
            select.innerHTML = `<option value="3">3回</option><option value="6">6回</option><option value="10">10回</option><option value="12">12回</option><option value="24">24回</option>`;
        }
    } else group.classList.add('hidden');
}

let activeExpenseMode = 'temp';
function setExpenseMode(mode) {
    activeExpenseMode = mode;
    if (mode === 'temp') {
        document.getElementById('btn-expense-temp').classList.add('active');
        document.getElementById('btn-expense-monthly').classList.remove('active');
        document.getElementById('expense-inputs-temp').classList.remove('hidden');
        document.getElementById('expense-inputs-monthly').classList.add('hidden');
        document.getElementById('expense-payment-section').classList.remove('hidden');
        document.getElementById('expense-date-label').innerText = 'いつ？';
        document.getElementById('expense-cost-label').innerText = 'およその金額（万円）';
    } else {
        document.getElementById('btn-expense-monthly').classList.add('active');
        document.getElementById('btn-expense-temp').classList.remove('active');
        document.getElementById('expense-inputs-monthly').classList.remove('hidden');
        document.getElementById('expense-inputs-temp').classList.add('hidden');
        document.getElementById('expense-payment-section').classList.add('hidden');
        document.getElementById('expense-date-label').innerText = '支払日';
        document.getElementById('expense-cost-label').innerText = '月額（万円）';
    }
}

function addExpense() {
    editingExpenseId = null;
    document.getElementById('expense-modal').classList.remove('hidden');
    document.getElementById('btn-expense-delete').classList.add('hidden');
    document.getElementById('btn-expense-save').innerText = '追加する';
    const today = new Date();
    document.getElementById('expense-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('expense-name-temp').value = "";
    document.getElementById('expense-cost').value = "";
    document.getElementById('payment-method').value = "once";
    toggleInstallmentSelect();
    setExpenseMode('temp');
}

function editExpense(id) {
    editingExpenseId = id;
    const ex = userState.expenses.find(e => e.id === id);
    if (!ex) return;
    
    document.getElementById('expense-modal').classList.remove('hidden');
    document.getElementById('btn-expense-delete').classList.remove('hidden');
    document.getElementById('btn-expense-save').innerText = '更新する';

    // Set tab based on whether it's recurring or not
    if (id.includes('recur')) setExpenseMode('monthly');
    else setExpenseMode('temp');

    if (activeExpenseMode === 'temp') {
        document.getElementById('expense-name-temp').value = ex.name;
    } else {
        document.getElementById('expense-name-monthly').value = ex.name;
    }

    let d = ex.date;
    if (d.length === 7) d += "-01";
    document.getElementById('expense-date').value = d;
    document.getElementById('expense-cost').value = ex.cost;
    document.getElementById('payment-method').value = "once";
    toggleInstallmentSelect();
}

function saveExpense() {
    let name = activeExpenseMode === 'temp' ? document.getElementById('expense-name-temp').value : document.getElementById('expense-name-monthly').value;
    let date = document.getElementById('expense-date').value;
    let cost = parseInt(document.getElementById('expense-cost').value || 0);
    let method = activeExpenseMode === 'temp' ? document.getElementById('payment-method').value : 'once';
    let installments = activeExpenseMode === 'temp' ? parseInt(document.getElementById('installment-count').value || 1) : 1;
    if(!name || !date) return alert("イベント名と支払日は必須です");

    if (editingExpenseId) {
        let idx = userState.expenses.findIndex(e => e.id === editingExpenseId);
        if (idx > -1) {
            userState.expenses[idx].name = name;
            userState.expenses[idx].date = date;
            userState.expenses[idx].cost = cost;
            userState.expenses[idx].desc = ""; 
        }
        editingExpenseId = null;
    } else if (activeExpenseMode === 'monthly') {
        let [y, m, d] = date.split('-').map(Number);
        if(!d) d = 1;
        for (let i = 0; i < 36; i++) {
            let curM = m + i;
            let curY = y + Math.floor((curM - 1) / 12);
            let dispM = ((curM - 1) % 12) + 1;
            userState.expenses.push({ id: `usr-recur-${Date.now()}-${i}`, name: name, date: `${curY}-${String(dispM).padStart(2, '0')}-${String(d).padStart(2, '0')}`, cost: cost, isTax: false, isAI: (i > 0), desc: `<i class="fas fa-redo"></i> 毎月の出費` });
        }
    } else if (method === 'once') {
        userState.expenses.push({ id: 'usr-' + Date.now(), name: name, date: date, cost: cost, isTax: false, isAI: false });
    } else {
        let monthlyCost = Math.ceil(cost / installments);
        let [y, m, d] = date.split('-').map(Number);
        if(!d) d = 1;
        for (let i = 0; i < installments; i++) {
            let curM = m + i;
            let curY = y + Math.floor((curM - 1) / 12);
            let dispM = ((curM - 1) % 12) + 1;
            let label = method === 'bank-loan' ? '銀行ローン' : method === 'shopping-loan' ? 'ショッピングローン' : 'カード分割';
            userState.expenses.push({ id: `usr-split-${Date.now()}-${i}`, name: `${name} (${i + 1}/${installments}回払い)`, date: `${curY}-${String(dispM).padStart(2, '0')}-${String(d).padStart(2, '0')}`, cost: monthlyCost, isTax: false, isAI: true, desc: `<i class="fas fa-credit-card"></i> ${label}` });
        }
    }
    closeModal('expense-modal');
    if (activeExpenseMode === 'temp' && !editingExpenseId) handleAIEventInjection(name, date.substring(0, 7));
    renderCalendar();
    updateAllUI();
}

function deleteExpense() {
    if (!editingExpenseId) return;
    
    let target = userState.expenses.find(e => e.id === editingExpenseId);
    if (!target) return;

    // Batch delete logic for split payments or recurring items
    let parts = editingExpenseId.split('-');
    // IDs are like: usr-split-TIMESTAMP-INDEX or usr-recur-TIMESTAMP-INDEX
    if ((editingExpenseId.includes('recur') || editingExpenseId.includes('split')) && parts.length >= 4) {
        // Find the "common" part of the ID (prefix + timestamp)
        let prefix = parts[0] + '-' + parts[1] + '-' + parts[2];
        let curIdx = parseInt(parts[3]);

        // Remove all items with same prefix and INDEX >= curIdx
        userState.expenses = userState.expenses.filter(e => {
            if (e.id.startsWith(prefix)) {
                let p = e.id.split('-');
                if (parseInt(p[3]) >= curIdx) return false;
            }
            return true;
        });
    } else {
        // Single delete
        userState.expenses = userState.expenses.filter(e => e.id !== editingExpenseId);
    }

    closeModal('expense-modal');
    renderCalendar();
    updateAllUI();
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// --- Chart.js Prediction ---
function renderChart() {
    const ctx = document.getElementById('incomeChart').getContext('2d');
    if (chartInstances.main) chartInstances.main.destroy();

    let labels = [];
    let netData = [];
    let grossData = [];
    let today = new Date();

    for (let i = 0; i < 36; i++) {
        let d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        labels.push(`${d.getFullYear()}/${d.getMonth() + 1}`);
        let isBonus = (d.getMonth() + 1 === 6 || d.getMonth() + 1 === 12) && userState.hasBonus;
        let tax = calcTaxes(i, isBonus);
        let monthTotalExpense = 0;
        let mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        userState.expenses.filter(e => e.date.startsWith(mStr)).forEach(e => monthTotalExpense += e.cost);
        grossData.push(tax.gross / 10000);
        netData.push((tax.net - monthTotalExpense * 10000) / 10000);
    }

    chartInstances.main = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: '手取り(予定支出引下後)', data: netData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 2 },
                { label: '額面月収', data: grossData, borderColor: '#94a3b8', borderDash: [5, 5], fill: false, tension: 0.1, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => v + '万' } }, x: { grid: { display: false } } }
        }
    });
}

function updateAnxietyMeter() {
    const icon = document.getElementById('status-icon');
    const title = document.getElementById('status-title');
    const reason = document.getElementById('status-reason');
    const tag = document.getElementById('status-tag');
    let today = new Date();
    let minNet = 999;
    for (let i = 0; i < 36; i++) {
        let d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        let isBonus = (d.getMonth() + 1 === 6 || d.getMonth() + 1 === 12) && userState.hasBonus;
        let tax = calcTaxes(i, isBonus);
        let monthTotalExpense = 0;
        let mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        userState.expenses.filter(e => e.date.startsWith(mStr)).forEach(e => monthTotalExpense += e.cost);
        let net = (tax.net - monthTotalExpense * 10000) / 10000;
        if(net < minNet) minNet = net;
    }
    if (minNet < 0) { icon.innerText = '🔴'; title.innerText = '警告'; reason.innerText = '収支がマイナスになる月があります。支出の見直しが必要です。'; }
    else if (minNet < 10) { icon.innerText = '🟡'; title.innerText = '注意'; reason.innerText = '余裕が少ない月があります。急な出費に備えましょう。'; }
    else { icon.innerText = '🟢'; title.innerText = '安定'; reason.innerText = '順調な収支予測です。貯蓄や投資の検討も可能です。'; }
    tag.innerText = `安心設定: ${userState.anxietyProfile === 6 ? '標準' : 'カスタム'}`;
}

function startFurusatoNavi() {
    document.getElementById('furusato-navi-area').classList.remove('hidden');
    document.querySelectorAll('.furusato-step').forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    document.getElementById('furusato-q1').classList.remove('hidden');
    document.getElementById('furusato-q1').classList.add('active');
}

function furusatoAnswer(step, ans) {
    if (step === 1) {
        if (ans === 'yes') showFurusatoResult("確定申告が必要", "副業や控除がある場合は、ワンストップ特例が使えません。確定申告で申請しましょう。");
        else {
            document.getElementById('furusato-q1').classList.remove('active');
            document.getElementById('furusato-q1').classList.add('hidden');
            document.getElementById('furusato-q2').classList.remove('hidden');
            document.getElementById('furusato-q2').classList.add('active');
        }
    } else {
        if (ans === 'yes') showFurusatoResult("ワンストップ特例がおすすめ", "5自治体以内であれば、書類を送るだけで簡単に申請が完了します。");
        else showFurusatoResult("確定申告が必要", "6自治体以上の場合は、ワンストップ特例が使えません。確定申告を行いましょう。");
    }
}

function showFurusatoResult(title, desc) {
    document.querySelectorAll('.furusato-step').forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    const res = document.getElementById('furusato-result');
    res.classList.remove('hidden');
    res.classList.add('active');
    document.getElementById('f-result-title').innerText = title;
    document.getElementById('f-result-desc').innerText = desc;
}
