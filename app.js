//File:app.js
// HÀM TẠO THÔNG BÁO XỊN XÒ (Thay thế alert)
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color: var(--accent-green);"></i>' : '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red);"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}
// ========================================================
// 0. KHỞI TẠO FIREBASE & BẢO MẬT TÀI KHOẢN (AUTH)
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBoIkHVROkrYuybb0_w55uU43GTAwF9aQc",
    authDomain: "omnistats-9669.firebaseapp.com",
    projectId: "omnistats-9669",
    storageBucket: "omnistats-9669.firebasestorage.app",
    messagingSenderId: "948519147661",
    appId: "1:948519147661:web:869b08c83024b2eeca6ac4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
let CURRENT_USER = null;

// ========================================================
// 1. BỘ ĐỊNH TUYẾN COMPONENTS & PAGES (ROUTER ENGINE)
// ========================================================
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(`${filePath}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Không tìm thấy ${filePath}`);
        const htmlContent = await response.text();
        document.getElementById(elementId).innerHTML = htmlContent;
    } catch (error) {
        console.error("Lỗi tải component:", error);
    }
}

async function initApp() {
    await Promise.all([
        loadComponent('sidebar-container', 'components/sidebar.html'),
        loadComponent('header-container', 'components/header.html'),
        loadComponent('right-panel-container', 'components/right-panel.html')
    ]);

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.checked = !document.body.classList.contains('light-mode');

    await navigateTo('dashboard');
}

async function navigateTo(pageName) {
    document.querySelectorAll('.sidebar .nav-item, .sidebar .user-profile').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeMenu = document.querySelector(`[data-page="${pageName}"]`);
    if (activeMenu) activeMenu.classList.add('active');

    await loadComponent('page-content', `pages/${pageName}.html`);

    if (pageName === 'dashboard') fetchAndRenderLiveMatches();
    else if (pageName === 'schedule') initScheduleListeners();

    if (CURRENT_USER) syncUserData();
}

// ========================================================
// 2. LẮNG NGHE ĐĂNG NHẬP & XỬ LÝ AUTH
// ========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        CURRENT_USER = user;
        document.getElementById('sidebar-container').style.display = 'flex';
        document.getElementById('header-container').style.display = 'flex';
        document.getElementById('right-panel-container').style.display = 'block';
        await initApp(); 
    } else {
        CURRENT_USER = null;
        document.getElementById('sidebar-container').style.display = 'none';
        document.getElementById('header-container').style.display = 'none';
        document.getElementById('right-panel-container').style.display = 'none';
        loadComponent('page-content', `pages/login.html`); 
    }
});

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    if(!email || !pass) { showToast("Vui lòng nhập Email và Mật khẩu!", "error"); return; }
    
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        showToast("Đăng nhập thành công!", "success");
    } catch (error) {
        showToast("Sai email hoặc mật khẩu!", "error");
    }
}

async function handleRegister() {
    // 1. Lấy dữ liệu từ các ô nhập liệu
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const repass = document.getElementById('reg-repassword').value;
    const displayName = document.getElementById('reg-displayname').value;
    const username = document.getElementById('reg-username').value;

    // 2. Chốt chặn kiểm tra rỗng
    if (!email || !pass || !displayName || !username) {
        showToast("Vui lòng điền đầy đủ tất cả thông tin!", "error");
        return;
    }
    
    // 3. Chốt chặn mật khẩu khớp nhau
    if (pass !== repass) {
        showToast("Mật khẩu xác nhận không khớp!", "error");
        return;
    }

    try {
        // 4. Tạo tài khoản trên hệ thống Firebase Auth
        const userCred = await auth.createUserWithEmailAndPassword(email, pass);
        
        // 5. Tạo file save (Profile) trên Database với thông tin chi tiết
        await db.collection("users").doc(userCred.user.uid).set({
            email: email,
            displayName: displayName,
            username: username,
            balance: 0, // Vốn khởi nghiệp
            history: []
        });
        
        // 6. Ép Đăng xuất ngay lập tức (Chống auto-login của Firebase)
        await auth.signOut();
        
        // 7. Dọn dẹp giao diện và báo cáo thành công
        document.getElementById('register-modal').classList.remove('active'); // Tắt Pop-up
        
        // Xóa trắng các ô nhập liệu để lần sau mở lên không bị dính chữ cũ
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-repassword').value = '';
        document.getElementById('reg-displayname').value = '';
        document.getElementById('reg-username').value = '';
        
        // Bắn thông báo Toast Pop-up xịn xò trong web
        showToast("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.", "success");
        
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        // Bắt lỗi chi tiết để báo lại cho người dùng bằng Toast
        if (error.code === 'auth/email-already-in-use') {
            showToast("Email này đã được sử dụng cho tài khoản khác!", "error");
        } else if (error.code === 'auth/weak-password') {
            showToast("Mật khẩu quá yếu (Cần ít nhất 6 ký tự).", "error");
        } else {
            showToast("Đã có lỗi xảy ra. Vui lòng thử lại!", "error");
        }
    }
}

function handleLogout() {
    auth.signOut();
}

// ========================================================
// 3. QUẢN LÝ DỮ LIỆU ĐÁM MÂY VÀ LỊCH SỬ GIAO DỊCH
// ========================================================
async function syncUserData() {
    if (!CURRENT_USER) return;
    try {
        const userRef = db.collection("users").doc(CURRENT_USER.uid);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data();
            updateBalanceUI(data.balance);
            renderHistoryUI(data.history || []);
            renderRealtimeCalendar(data.lastClaimDate);

            // --- BƠM TÊN THẬT VÀ TẠO AVATAR TỪ DATABASE ---
            const realName = data.displayName || CURRENT_USER.email.split('@')[0];
            const headerGreeting = document.getElementById('header-greeting');
            const sidebarName = document.getElementById('sidebar-username');
            
            if (headerGreeting) headerGreeting.innerHTML = `Chào mừng trở lại, ${realName}! <i class="fa-regular fa-bell" style="margin-left: 15px; font-size: 16px; cursor: pointer;"></i>`;
            if (sidebarName) sidebarName.innerText = realName;
            
            // Cập nhật Avatar dựa trên tên thật
            const avatarImg = document.querySelector('.sidebar .avatar');
            if (avatarImg) {
                avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=00d2ff&color=fff&rounded=true`;
            }
            // -----------------------------------------------
        }
    } catch (error) {
        console.error("Lỗi đồng bộ Firebase:", error);
    }
}

// Chức năng 1: Vẽ lại Lịch sử giao dịch thật
function renderHistoryUI(historyArray) {
    const historyList = document.getElementById('transaction-history');
    if (!historyList) return; 
    
    historyList.innerHTML = '';
    if (historyArray.length === 0) {
        historyList.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted);">Chưa có giao dịch nào.</div>';
        return;
    }

    // Đảo ngược mảng để giao dịch mới nhất luôn trồi lên trên cùng
    [...historyArray].reverse().forEach(item => {
        historyList.innerHTML += `
            <div class="history-item">
                <span><i class="${item.icon}" style="color: var(--accent-blue); margin-right: 8px;"></i> ${item.text} <br><small style="color: var(--text-muted); font-size: 11px;">${item.time}</small></span>
                <span style="color: ${item.color}; font-weight: 600;">${item.amount}</span>
            </div>
        `;
    });
}

// Chức năng 2: Tạo bộ lịch thời gian thực thông minh
function renderRealtimeCalendar(lastClaimDate) {
    const calendarGrid = document.getElementById('dynamic-calendar');
    const monthText = document.getElementById('calendar-month-text');
    const btn = document.getElementById('btn-claim-daily');
    if (!calendarGrid) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const dateToday = now.getDate();
    const todayStr = now.toLocaleDateString('vi-VN');

    if (monthText) monthText.innerText = `Điểm danh Tháng ${month + 1}`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendarGrid.innerHTML = ''; 

    let isClaimedToday = (lastClaimDate === todayStr);

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'cal-day';
        dayDiv.innerText = i;
        
        if (i === dateToday) {
            dayDiv.id = 'today-box';
            if (isClaimedToday) dayDiv.classList.add('done');
            else dayDiv.classList.add('today');
        } else if (i < dateToday) {
            dayDiv.style.opacity = '0.5'; // Làm mờ các ngày quá khứ
        }
        
        calendarGrid.appendChild(dayDiv);
    }

    // Khóa hoặc mở nút bấm theo trạng thái của đám mây
    if (btn) {
        if (isClaimedToday) {
            btn.disabled = true;
            btn.innerText = "Đã nhận. Đợi tới ngày mai";
            btn.style.backgroundColor = 'var(--bg-hover)';
        } else {
            btn.disabled = false;
            btn.innerText = "Nhận 200 Xu hôm nay";
            btn.style.backgroundColor = 'var(--accent-green)';
        }
    }
}

function updateBalanceUI(amount) {
    const mainBalance = document.getElementById('main-balance');
    const sidebarBalance = document.getElementById('sidebar-balance');
    const formatted = amount.toLocaleString('en-US');
    if (mainBalance) mainBalance.innerText = formatted;
    if (sidebarBalance) sidebarBalance.innerText = formatted + ' Xu';
}

// Chức năng 3: Chốt chặn gian lận và Lưu lịch sử
async function claimDailyCoin() {
    const btn = document.getElementById('btn-claim-daily');
    if (!btn || !CURRENT_USER) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu Cloud...';
    
    try {
        const userRef = db.collection("users").doc(CURRENT_USER.uid);
        const docSnap = await userRef.get();
        const data = docSnap.exists ? docSnap.data() : { balance: 0, history: [] };
        
        const todayStr = new Date().toLocaleDateString('vi-VN');
        
        // Cú lừa F5 sẽ bị chặn đứng tại đây
        if (data.lastClaimDate === todayStr) {
            showToast("Hệ thống phát hiện bạn đã nhận Xu hôm nay rồi nhé!", "error");
            syncUserData();
            return;
        }
        const newCoins = data.balance + 200;
        
        // Đóng gói 1 dòng lịch sử hoàn chỉnh
        const newHistoryItem = {
            text: "Điểm danh hàng ngày",
            amount: "+200 Xu",
            color: "var(--accent-green)",
            icon: "fa-solid fa-calendar-check",
            time: new Date().toLocaleString('vi-VN')
        };

        // Bắn 1 mũi tên trúng 3 đích: Cập nhật Tiền + Đóng dấu ngày + Chèn lịch sử mảng
        await userRef.update({ 
            balance: newCoins,
            lastClaimDate: todayStr,
            history: firebase.firestore.FieldValue.arrayUnion(newHistoryItem)
        });
        
        syncUserData();
        
        // Bật mở hộp lịch sử ra cho ngầu
        const historyList = document.getElementById('transaction-history');
        if (historyList && !historyList.classList.contains('show')) toggleHistory();

    } catch (error) {
        console.error("Lỗi lưu Xu:", error);
        btn.innerText = "Lỗi mạng, thử lại sau!";
        btn.disabled = false;
    }
}
// ========================================================
// 4. LÕI KÉO DỮ LIỆU ĐỘNG (DIỄN BIẾN TRẬN ĐẤU LIVE)
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

            container.innerHTML += `
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
// 5. ĐIỀU KHIỂN TƯƠNG TÁC GIAO DIỆN (UI CONTROLLERS)
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
