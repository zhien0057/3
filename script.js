const apiUrl = "https://script.google.com/macros/s/AKfycbxlH3h2PWdZugvDgZmAEk-FKm0LD4M6lZpyumj9dtRm1gWdIzOha-Z22uVdUud--GoL/exec"; // 換成你自己的
const form = document.getElementById("recordForm");
const recordsContainer = document.getElementById("records");
const monthFilter = document.getElementById("monthFilter");
const toggleViewBtn = document.getElementById("toggleView");
const reportSection = document.getElementById("report");
const reportCanvas = document.getElementById("reportChart");
const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budget");
const budgetDisplay = document.getElementById("budgetDisplay");
const budgetProgress = document.getElementById("budgetProgress");

let allRecords = [];
let currentView = "records";
let currentBudget = 0;
let chart;

// 預設今天
document.getElementById("date").valueAsDate = new Date();

// 載入紀錄
async function loadRecords() {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    allRecords = data.slice(1).map((item, index) => ({
      row: index + 2,
      date: item[0],
      category: item[1],
      amount: Number(item[2]),
      note: item[3]
    }));

    generateMonthOptions();
    if (currentView === "records") renderRecords();
    else renderChart();
  } catch (error) {
    console.error("讀取錯誤：", error);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const category = document.getElementById("category").value;
  const amount = Number(document.getElementById("amount").value);
  const note = document.getElementById("note").value;

  if (isNaN(amount) || amount <= 0) {
    alert("請輸入正確金額！");
    return;
  }

  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", date, category, amount, note }),
    mode: "no-cors"
  });

  form.reset();
  document.getElementById("date").valueAsDate = new Date();
  setTimeout(loadRecords, 800);
});

function renderRecords() {
  const selectedMonth = monthFilter.value;
  const filtered = selectedMonth
    ? allRecords.filter(r => r.date.startsWith(selectedMonth))
    : allRecords;

  recordsContainer.innerHTML = "";
  let total = 0;

  filtered.forEach(record => {
    total += record.amount;
    const div = document.createElement("div");
    div.className = "record";
    div.innerHTML = `
      <p><strong>日期：</strong>${formatDate(record.date)}</p>
      <p><strong>類別：</strong><input type="text" value="${record.category}" data-type="category" data-row="${record.row}"></p>
      <p><strong>金額：</strong><input type="number" value="${record.amount}" data-type="amount" data-row="${record.row}"></p>
      <p><strong>備註：</strong><input type="text" value="${record.note}" data-type="note" data-row="${record.row}"></p>
      <button class="edit-btn" data-row="${record.row}">儲存</button>
      <button class="delete-btn" data-row="${record.row}">刪除</button>
    `;
    recordsContainer.appendChild(div);
  });

  const totalDiv = document.createElement("div");
  totalDiv.innerHTML = `<h3>總支出：${total} 元</h3>`;
  recordsContainer.appendChild(totalDiv);

  addDeleteEvents();
  addEditEvents();
  updateBudgetProgress(total);
}

function addDeleteEvents() {
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.getAttribute("data-row");
      if (confirm("確定刪除？")) {
        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", row: Number(row) }),
          mode: "no-cors"
        });
        setTimeout(loadRecords, 800);
      }
    });
  });
}

function addEditEvents() {
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.getAttribute("data-row");
      const inputs = document.querySelectorAll(`input[data-row="${row}"]`);
      const updated = {};
      inputs.forEach(input => {
        updated[input.dataset.type] = input.value;
      });

      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          row: Number(row),
          date: updated.date || "", // date 不需要改
          category: updated.category,
          amount: Number(updated.amount),
          note: updated.note
        }),
        mode: "no-cors"
      });

      alert("已儲存變更！");
      setTimeout(loadRecords, 800);
    });
  });
}

function generateMonthOptions() {
  const months = new Set();
  allRecords.forEach(r => months.add(r.date.slice(0, 7)));
  monthFilter.innerHTML = `<option value="">全部月份</option>`;
  Array.from(months).sort().forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthFilter.appendChild(option);
  });
}

monthFilter.addEventListener("change", () => {
  if (currentView === "records") renderRecords();
  else renderChart();
});

toggleViewBtn.addEventListener("click", () => {
  currentView = currentView === "records" ? "report" : "records";
  if (currentView === "records") {
    recordsContainer.style.display = "block";
    reportSection.style.display = "none";
    renderRecords();
    toggleViewBtn.textContent = "切換模式：支出報表";
  } else {
    recordsContainer.style.display = "none";
    reportSection.style.display = "block";
    renderChart();
    toggleViewBtn.textContent = "切換模式：支出紀錄";
  }
});

function renderChart() {
  const selectedMonth = monthFilter.value;
  const filtered = selectedMonth
    ? allRecords.filter(r => r.date.startsWith(selectedMonth))
    : allRecords;

  const totals = {};
  filtered.forEach(record => {
    totals[record.category] = (totals[record.category] || 0) + record.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);

  if (chart) chart.destroy();
  chart = new Chart(reportCanvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ["#A8C3B9", "#C1B2C8", "#D8B4A6", "#B9C8C4", "#E6D3CF"]
      }]
    }
  });
}

budgetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const budgetValue = Number(budgetInput.value);
  if (isNaN(budgetValue) || budgetValue <= 0) {
    alert("請輸入有效預算！");
    return;
  }
  currentBudget = budgetValue;
  updateBudgetProgress();
});

function updateBudgetProgress(totalSpent = 0) {
  if (currentBudget > 0) {
    const percent = Math.min((totalSpent / currentBudget) * 100, 100);
    budgetProgress.style.width = percent + "%";
    budgetProgress.textContent = `${percent.toFixed(1)}% 已花費`;
    budgetDisplay.innerHTML = `預算：${currentBudget} 元<br>已花費：${totalSpent} 元`;
  } else {
    budgetProgress.style.width = "0%";
    budgetProgress.textContent = "未設定預算";
    budgetDisplay.innerHTML = "尚未設定預算";
  }
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

window.addEventListener("load", loadRecords);
