// File: app.js

// ========================================================
// 1. BỘ ĐỊNH TUYẾN COMPONENTS & PAGES (ROUTER ENGINE)
// ========================================================

async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Không tìm thấy ${filePath}`);
        const htmlContent = await response.text();
        document.getElementById(elementId).innerHTML = htmlContent;
    } catch (error) {
        console.error("Lỗi tải component:", error);
    }
}

async function initApp() {
    // Tải đồng thời 3 khối giao diện bao quanh tĩnh
    await Promise.all([
        loadComponent('sidebar-container', 'components/sidebar.html'),
        loadComponent('header-container', 'components/header.html'),
        loadComponent('right-panel-container', 'components/right-panel.html')
    ]);

    // Thiết lập trạng thái theme ban đầu dựa trên body
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = !document.body.classList.contains('light-mode');
    }

    // Mặc định tải trang chủ đầu tiên
    await navigateTo('dashboard');
}

async function navigateTo(pageName) {
    // Xóa trạng thái active của tất cả các nút trên Sidebar
    document.querySelectorAll('.sidebar .nav-item, .sidebar .user-profile').forEach(item => {
        item.classList.remove('active');
    });
    
    // Thêm active vào nút menu vừa bấm dựa trên thuộc tính data-page
    const activeMenu = document.querySelector(`[data-page="${pageName}"]`);
    if (activeMenu) activeMenu.classList.add('active');

    // Tải nội dung trang tương ứng bơm vào khung giữa
    await loadComponent('page-content', `pages/${pageName}.html`);

    // KÍCH HOẠT LOGIC RIÊNG CHO TỪNG TRANG SAU KHI LOAD XONG HTML
    if (pageName === 'dashboard') {
        fetchAndRenderLiveMatches();
    } else if (pageName === 'schedule') {
        initScheduleListeners();
    }
}

// ========================================================
// 2. LÕI KÉO DỮ LIỆU ĐỘNG (DIỄN BIẾN TRẬN ĐẤU LIVE - BƯỚC 2.3)
// ========================================================

async function fetchAndRenderLiveMatches() {
    const container = document.getElementById('live-matches-container');
    if (!container) return;

    container.innerHTML = `
        <div style="color: var(--accent-blue); padding: 20px; text-align: center; grid-column: span 2;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
            <p>Đang kéo dữ liệu trực tiếp từ kho...</p>
        </div>
    `;

    try {
        const response = await fetch(`https://raw.githubusercontent.com/kudovinh9669/omnistats-vn/main/live-matches.json?t=${Date.now()}`);
        if (!response.ok) throw new Error("Chưa tìm thấy file JSON");
        
        const matchesToRender = await response.json();
        container.innerHTML = ''; 

        if (matchesToRender.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); grid-column: span 2; text-align: center;">Hiện tại không có trận đấu nào.</div>';
            return;
        }

        matchesToRender.forEach(match => {
            let iconHtml = '<i class="fa-solid fa-futbol"></i>';
            if (match.type === 'esports') iconHtml = '<i class="fa-brands fa-twitch" style="color: #9146FF;"></i>';
            if (match.type === 'basketball') iconHtml = '<i class="fa-solid fa-basketball" style="color: #f97316;"></i>';

            const matchCardHtml = `
                <div class="match-card">
                    <div class="live-badge" style="background-color: rgba(0, 210, 255, 0.1); color: var(--accent-blue); box-shadow: none; animation: none;">
                        <span class="match-timer">${match.time}</span>
                    </div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-bottom: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${iconHtml} ${match.league}
                    </div>
                    <div class="teams">
                        <div class="team">
                            <img src="${match.teamHome.logo}" style="border-radius: 50%; width: 45px; height: 45px; object-fit: cover;">
                            <h4 style="font-size: 14px; text-align: center; margin-top: 5px;">${match.teamHome.name}</h4>
                        </div>
                        <div class="score" style="color: var(--text-main); font-size: 24px;">
                            ${match.scoreHome} - ${match.scoreAway}
                        </div>
                        <div class="team">
                            <img src="${match.teamAway.logo}" style="border-radius: 50%; width: 45px; height: 45px; object-fit: cover;">
                            <h4 style="font-size: 14px; text-align: center; margin-top: 5px;">${match.teamAway.name}</h4>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += matchCardHtml;
        });
    } catch (error) {
        console.error("Lỗi đồng bộ dữ liệu tĩnh:", error);
        container.innerHTML = `
            <div style="color: var(--accent-red); padding: 20px; grid-column: span 2; text-align: center;">
                <i class="fa-solid fa-triangle-exclamation"></i> Đang chờ dữ liệu đồng bộ. Vui lòng F5 lại sau!
            </div>
        `;
    }
}

// ========================================================
// 3. ĐIỀU KHIỂN TƯƠNG TÁC GIAO DIỆN (UI CONTROLLERS)
// ========================================================

function toggleFollow(btn) {
    if (btn.classList.contains('followed')) {
        btn.classList.remove('followed');
        btn.innerText = '+ Theo dõi';
    } else {
        btn.classList.add('followed');
        btn.innerText = 'Đang theo dõi';
    }
}

function filterSchedule(btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function initScheduleListeners() {
    document.querySelectorAll('.btn-remind').forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('active');
            const icon = this.querySelector('i');
            if (this.classList.contains('active')) {
                icon.className = 'fa-solid fa-bell';
                this.title = "Bỏ nhắc nhở";
            } else {
                icon.className = 'fa-regular fa-bell';
                this.title = "Nhắc nhở tôi";
            }
        });
    });
}

function toggleHistory() {
    const historyList = document.getElementById('transaction-history');
    const icon = document.getElementById('history-icon');
    if (!historyList || !icon) return;
    
    if (historyList.classList.contains('show')) {
        historyList.classList.remove('show');
        icon.style.transform = 'rotate(0deg)';
    } else {
        historyList.classList.add('show');
        icon.style.transform = 'rotate(180deg)';
    }
}

function claimDailyCoin() {
    const btn = document.getElementById('btn-claim-daily');
    const todayBox = document.getElementById('today-box');
    if (!btn || !todayBox) return;

    todayBox.classList.remove('today');
    todayBox.classList.add('done');
    btn.disabled = true;
    btn.innerText = "Đã nhận. Đợi tới 00:00 ngày mai";
    
    const balanceElem = document.getElementById('main-balance');
    const sidebarBalance = document.getElementById('sidebar-balance');
    let currentCoins = parseInt(balanceElem.innerText.replace(/,/g, ''));
    currentCoins += 200;
    
    balanceElem.innerText = currentCoins.toLocaleString('en-US');
    if (sidebarBalance) sidebarBalance.innerText = currentCoins.toLocaleString('en-US') + ' Xu';
    
    const historyList = document.getElementById('transaction-history');
    if (historyList) {
        const newHistoryItem = document.createElement('div');
        newHistoryItem.className = 'history-item';
        newHistoryItem.innerHTML = `
            <span><i class="fa-solid fa-calendar-check" style="color: var(--accent-blue); margin-right: 8px;"></i> Vừa điểm danh hôm nay</span>
            <span style="color: var(--accent-green); font-weight: 600;">+200 Xu</span>
        `;
        historyList.insertBefore(newHistoryItem, historyList.firstChild);
        if (!historyList.classList.contains('show')) toggleHistory();
    }
}

function toggleTheme() {
    const isDark = document.getElementById('theme-toggle').checked;
    if (isDark) {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
    }
}

// 4. ĐỒNG HỒ ĐẾM GIỜ TRẬN ĐẤU LIVE KHÔNG ĐỔI
let seconds = 15; let minutes = 24;
setInterval(() => {
    seconds++; 
    if (seconds > 59) { seconds = 0; minutes++; }
    const timeSpans = document.querySelectorAll('.match-timer');
    timeSpans.forEach(span => {
        if (span.innerText.includes(':')) {
            span.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    });
}, 1000);

// Chạy khởi tạo ứng dụng
initApp();