document.addEventListener('DOMContentLoaded', () => {
    // --- 数据库和状态 ---
    const actionLibrary = [
        { name: '杠铃卧推', tags: ['胸', '臂'] }, { name: '哑铃飞鸟', tags: ['胸'] },
        { name: '引体向上', tags: ['背', '臂'] }, { name: '杠铃划船', tags: ['背'] },
        { name: '站姿推举', tags: ['肩', '臂'] }, { name: '侧平举', tags: ['肩'] },
        { name: '杠铃深蹲', tags: ['腿'] }, { name: '腿举', tags: ['腿'] },
        { name: '二头弯举', tags: ['臂'] }, { name: '三头下压', tags: ['臂'] },
    ];
    let workoutHistory = {};
    let todayLog = [];
    let currentFilter = 'all';
    let restTimerInterval;
    const today = new Date().toISOString().slice(0, 10);

    // --- 获取页面元素 ---
    const currentDateElem = document.getElementById('current-date');
    const currentTimeElem = document.getElementById('current-time');
    const focusInput = document.getElementById('focus-input');
    const workoutBody = document.getElementById('workout-body');
    const addWorkoutBtn = document.getElementById('add-workout-btn');
    const exportBtn = document.getElementById('export-btn');
    // 动作模态框
    const actionModal = document.getElementById('action-modal');
    const closeActionModalBtn = document.getElementById('close-action-modal-btn');
    const actionList = document.getElementById('action-list');
    const modalFilterContainer = document.getElementById('modal-filter-container');
    // 日志模态框
    const viewLogBtn = document.getElementById('view-log-btn');
    const logModal = document.getElementById('log-modal');
    const closeLogModalBtn = document.getElementById('close-log-modal-btn');
    const logList = document.getElementById('log-list');
    const exportSelectedBtn = document.getElementById('export-selected-btn');

    // --- 主流程 ---
    function init() {
        updateTime();
        setInterval(updateTime, 1000);
        loadData();
        renderTable();
        renderFilterButtons();
        setupEventListeners();
    }

    // --- 事件监听器设置 ---
    function setupEventListeners() {
        addWorkoutBtn.addEventListener('click', () => actionModal.style.display = 'flex');
        closeActionModalBtn.addEventListener('click', () => actionModal.style.display = 'none');
        exportBtn.addEventListener('click', () => exportToCSV([today]));

        focusInput.addEventListener('change', () => {
            workoutHistory[today].focus = focusInput.value;
            saveData();
        });

        modalFilterContainer.addEventListener('click', handleFilterClick);
        actionList.addEventListener('click', handleActionSelect);
        workoutBody.addEventListener('click', handleTableClick);
        workoutBody.addEventListener('change', handleTableInputChange);

        // 日志功能事件
        viewLogBtn.addEventListener('click', showLogModal);
        closeLogModalBtn.addEventListener('click', () => logModal.style.display = 'none');
        exportSelectedBtn.addEventListener('click', exportSelectedLogs);
    }

    // --- 渲染和核心逻辑 ---
    function renderTable() {
        workoutBody.innerHTML = '';
        if (todayLog.length === 0) {
            workoutBody.innerHTML = `<tr><td colspan="8">点击右下角 "+" 开始添加训练</td></tr>`;
            return;
        }
        todayLog.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            row.innerHTML = `
                <td>${item.name}</td>
                <td class="set-cell">${item.set}</td>
                <td><input type="number" class="weight-input" value="${item.weight || ''}"></td>
                <td><input type="text" class="reps-input" value="${item.reps || ''}"></td>
                <td><input type="number" class="rpe-input" step="0.1" value="${item.rpe || ''}"></td>
                <td><input type="text" class="notes-input" value="${item.notes || ''}"></td>
                <td class="rest-cell"></td>
                <td class="delete-cell"><i class="fas fa-trash-alt delete-btn"></i></td>
            `;
            const restCell = row.querySelector('.rest-cell');
            updateRestCell(restCell, item);
            workoutBody.appendChild(row);
        });
        saveData();
    }

    function updateRestCell(cell, item) {
        if (item.isResting) {
            cell.innerHTML = `<div class="timer-display">${item.restTime}s</div><button class="btn-stop-rest">停止</button>`;
        } else {
            cell.innerHTML = `<span>${item.restTime > 0 ? item.restTime + 's' : '--'}</span><button class="btn-start-rest">计时</button>`;
        }
    }

    function addSet(actionName, options = {}) {
        todayLog.push({
            name: actionName,
            set: options.set || 1,
            weight: options.weight || '',
            reps: options.reps || '',
            rpe: options.rpe || '',
            notes: options.notes || '',
            restTime: 0,
            isResting: false
        });
        renderTable();
    }
    
    // --- 事件处理函数 ---
    function handleTableClick(e) {
        const target = e.target;
        const row = target.closest('tr');
        if (!row || !row.dataset.index) return;
        
        const index = parseInt(row.dataset.index);
        const item = todayLog[index];

        if (target.classList.contains('set-cell')) {
            addSet(item.name, { set: item.set + 1, weight: item.weight, rpe: item.rpe });
        } else if (target.classList.contains('delete-btn')) {
            if (confirm(`确定要删除“${item.name}”的第 ${item.set} 组吗？`)) {
                todayLog.splice(index, 1);
                renderTable();
            }
        } else if (target.classList.contains('btn-start-rest')) {
            clearInterval(restTimerInterval);
            item.isResting = true;
            item.restTime = 0;
            restTimerInterval = setInterval(() => {
                item.restTime++;
                renderTable();
            }, 1000);
            renderTable();
        } else if (target.classList.contains('btn-stop-rest')) {
            clearInterval(restTimerInterval);
            item.isResting = false;
            renderTable();
        }
    }

    function handleTableInputChange(e) {
        const target = e.target;
        const row = target.closest('tr');
        if (!row || !row.dataset.index) return;
        const index = parseInt(row.dataset.index);
        const item = todayLog[index];
        
        const classMap = {
            'weight-input': 'weight',
            'reps-input': 'reps',
            'rpe-input': 'rpe',
            'notes-input': 'notes'
        };
        const key = classMap[target.className];
        if (key) {
            item[key] = target.value;
            saveData();
        }
    }

    function handleFilterClick(e) {
        if (e.target.classList.contains('filter-btn')) {
            currentFilter = e.target.dataset.part;
            renderFilterButtons();
        }
    }
    
    function handleActionSelect(e) {
        if (e.target.classList.contains('action-item')) {
            addSet(e.target.textContent);
            actionModal.style.display = 'none';
        }
    }
    
    // --- 日志功能 ---
    function showLogModal() {
        renderLogList();
        logModal.style.display = 'flex';
    }

    function renderLogList() {
        logList.innerHTML = '';
        const dates = Object.keys(workoutHistory).sort().reverse(); // 按日期倒序
        if (dates.length === 0) {
            logList.innerHTML = '<p>没有历史记录。</p>';
            return;
        }
        dates.forEach(date => {
            const dayData = workoutHistory[date];
            if (dayData.log && dayData.log.length > 0) { // 只显示有训练记录的日期
                const item = document.createElement('div');
                item.className = 'log-item';
                item.innerHTML = `
                    <input type="checkbox" data-date="${date}">
                    <div class="log-item-info">
                        <span class="date">${date}</span>
                        <span class="focus">重点: ${dayData.focus || '未填写'}</span>
                    </div>
                `;
                logList.appendChild(item);
            }
        });
    }

    function exportSelectedLogs() {
        const selectedDates = [];
        logList.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            selectedDates.push(checkbox.dataset.date);
        });
        if (selectedDates.length === 0) {
            alert('请至少选择一个日期进行导出。');
            return;
        }
        exportToCSV(selectedDates);
    }

    // --- 数据导入导出 ---
    function exportToCSV(dates) {
        let allLogs = [];
        dates.forEach(date => {
            const dayData = workoutHistory[date];
            if (dayData && dayData.log) {
                const focus = dayData.focus || '未填写';
                dayData.log.forEach(item => {
                    allLogs.push({ ...item, date, focus });
                });
            }
        });

        if (allLogs.length === 0) {
            alert('选中的日期没有训练记录可以导出。');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "日期,训练重点,动作,组数,重量(kg),次数,RPE,备注,休息时间(s)\n";

        allLogs.forEach(item => {
            const rowData = [
                item.date,
                item.focus,
                item.name,
                item.set,
                item.weight,
                `"${item.reps}"`, // 用引号包裹以防逗号问题
                item.rpe,
                `"${item.notes}"`,
                item.restTime
            ].join(",");
            csvContent += rowData + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const filename = dates.length > 1 ? `健身记录-多日` : `健身记录-${dates[0]}`;
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- 渲染和时间函数 ---
    function renderFilterButtons() {
        const parts = ['all', '胸', '背', '肩', '腿', '臂'];
        modalFilterContainer.innerHTML = '';
        parts.forEach(part => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.part = part;
            btn.textContent = part === 'all' ? '全部' : part;
            if (currentFilter === part) btn.classList.add('active');
            modalFilterContainer.appendChild(btn);
        });
        renderActionList();
    }

    function renderActionList() {
        actionList.innerHTML = '';
        const filteredActions = actionLibrary.filter(action =>
            currentFilter === 'all' || action.tags.includes(currentFilter)
        );
        filteredActions.forEach(action => {
            const div = document.createElement('div');
            div.className = 'action-item';
            div.textContent = action.name;
            actionList.appendChild(div);
        });
    }
    
    function updateTime() {
        const now = new Date();
        currentDateElem.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        currentTimeElem.textContent = now.toLocaleTimeString('zh-CN');
    }

    // --- 本地存储 ---
    function saveData() {
        localStorage.setItem('fitnessAppHistory', JSON.stringify(workoutHistory));
    }

    function loadData() {
        const savedHistory = localStorage.getItem('fitnessAppHistory');
        if (savedHistory) {
            workoutHistory = JSON.parse(savedHistory);
        }
        if (workoutHistory[today]) {
            todayLog = workoutHistory[today].log;
            focusInput.value = workoutHistory[today].focus || '';
        } else {
            workoutHistory[today] = { focus: '', log: [] };
            todayLog = workoutHistory[today].log;
        }
    }
    
    init();
});