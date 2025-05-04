import { StorageManager } from './storageManager.js';
import { SessionManager } from './sessionManager.js';
import { UIManager } from './uiManager.js';
import { ModalManager } from './modalManager.js';
import { ChartManager } from './chartManager.js';
import { Timer } from './timer.js';

export function bindEvents() {
    // 전역 변수로 SessionManager 노출 (날짜 변경 감지용)
    window.SessionManager = SessionManager;
    window.ChartManager = ChartManager;
    window.UIManager = UIManager;

    SessionManager.init();
    const data = SessionManager.data;
    const today = SessionManager.todayKey;

    // --- 초기 UI 업데이트 ---
    UIManager.updateDateTime();
    setInterval(() => UIManager.updateDateTime(), 1000);
    UIManager.update5DayAvg(data);
    UIManager.updateGoalBar(data[today]);
    ChartManager.drawWeekly(data);
    UIManager.showBackupReminder();

    // --- 타이머 인스턴스 생성 ---
    const timer = new Timer(ms => UIManager.updateTimerDisplay(ms));

    // 세션 상태 복원 및 버튼 상태 업데이트
    updateButtonStates();

    function updateButtonStates() {
        const currentState = SessionManager.getCurrentState();
        console.log("Current state:", currentState);

        if (currentState === 'active') {
            const currentSession = SessionManager.getCurrentSession();
            timer._start = currentSession.start;
            timer._acc = currentSession.acc || 0;
            timer.start();
            document.getElementById('endBtn').disabled = false;

            // 일시정지 버튼 상태 업데이트
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-text">일시정지</span>';
            pauseBtn.classList.remove('state-start', 'state-resume');
            pauseBtn.classList.add('state-pause');
        } else if (currentState === 'paused') {
            const currentSession = SessionManager.getCurrentSession();
            timer._acc = currentSession.acc || 0;
            document.getElementById('pauseOptions').classList.add('show');
            document.getElementById('endBtn').disabled = false;

            // 일시정지 버튼 상태 업데이트
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">공부 시작</span>';
            pauseBtn.classList.remove('state-pause', 'state-start');
            pauseBtn.classList.add('state-resume');
        } else {
            document.getElementById('endBtn').disabled = true;

            // 초기 버튼 상태
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">공부 시작</span>';
            pauseBtn.classList.remove('state-pause', 'state-resume');
            pauseBtn.classList.add('state-start');
        }
    }

    // 🟢 출근 버튼: 목표 설정 + 출근 기록 + 안내 토스트
    document.getElementById('checkInBtn').onclick = () => {
        ModalManager.goalModal(data[today], (h, m) => {
            // 현재 시각
            const now = new Date();
            const hh = now.getHours().toString().padStart(2, '0');
            const mm = now.getMinutes().toString().padStart(2, '0');

            // 출근 기록 및 목표 시간 저장
            data[today].checkIn = `${hh}:${mm}`;
            data[today].goalHours = h + m / 60;
            StorageManager.saveData(data);

            // UI 갱신
            UIManager.updateGoalBar(data[today]);
            UIManager.update5DayAvg(data);

            // 안내 토스트
            UIManager.toast(`${hh}시 ${mm}분 출근, 목표 시간 ${h}시간 ${m}분입니다.`);
        });
    };

    // ⏯ 시작/일시정지 버튼
    document.getElementById('pauseBtn').onclick = () => {
        const current = SessionManager.getCurrentSession();

        if (!current) {
            // 공부 시작
            SessionManager.startSession();
            timer.start();
            document.getElementById('endBtn').disabled = false;

            // 버튼 상태 변경: 시작 -> 일시정지
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-text">일시정지</span>';
            pauseBtn.classList.remove('state-start', 'state-resume');
            pauseBtn.classList.add('state-pause');

            UIManager.toast('공부 시작됨');
            return;
        }

        if (timer._interval) {
            // 일시정지
            document.getElementById('pauseOptions').classList.add('show');
            timer.pause();

            // 버튼 상태 변경: 일시정지 -> 공부(재개)
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">공부 시작</span>';
            pauseBtn.classList.remove('state-pause', 'state-start');
            pauseBtn.classList.add('state-resume');

            UIManager.toast('일시정지됨');
        } else {
            // 재시작
            SessionManager.resumeSession();
            timer.resume();
            document.getElementById('pauseOptions').classList.remove('show');

            // 버튼 상태 변경: 공부(재개) -> 일시정지
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">⏸</span><span class="btn-text">일시정지</span>';
            pauseBtn.classList.remove('state-start', 'state-resume');
            pauseBtn.classList.add('state-pause');

            UIManager.toast('재개됨');
        }
    };

    // 일시정지 사유 선택
    document.getElementById('pauseOptions').onclick = e => {
        if (e.target.dataset.reason) {
            const currentSession = SessionManager.getCurrentSession();
            if (currentSession) {
                SessionManager.pauseSession(e.target.dataset.reason);
                document.getElementById('pauseOptions').classList.remove('show');
                UIManager.toast(`${e.target.dataset.reason} 기록됨`);
            } else {
                UIManager.toast('활성 세션이 없습니다. 먼저 공부를 시작하세요.');
                document.getElementById('pauseOptions').classList.remove('show');
            }
        }
    };

    // ⏹ 공부 끝 버튼
    document.getElementById('endBtn').onclick = () => {
        if (SessionManager.getCurrentSession()) {
            timer.end();
            SessionManager.endSession();
            UIManager.updateGoalBar(data[today]);
            ChartManager.drawWeekly(data);
            UIManager.showBackupReminder();
            UIManager.toast('공부 종료');

            // 버튼 상태 업데이트
            document.getElementById('endBtn').disabled = true;
            document.getElementById('pauseOptions').classList.remove('show');

            // 일시정지 버튼 초기 상태로 복원
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.innerHTML = '<span class="btn-icon">▶</span><span class="btn-text">공부 시작</span>';
            pauseBtn.classList.remove('state-pause', 'state-resume');
            pauseBtn.classList.add('state-start');

            const rate = data[today].summary.completionRate;
            if (rate < 80) {
                ModalManager.summaryModal(rate, (reason, memo) => {
                    data[today].summary.underGoalReason = reason;
                    data[today].summary.memo = memo;
                    StorageManager.saveData(data);
                });
            }
        } else {
            UIManager.toast('활성 세션이 없습니다.');
        }
    };

    // Space 키로도 시작/일시정지 전환
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            document.getElementById('pauseBtn').click();
        }
    });

    // ⚙️ 설정 메뉴
    document.getElementById('settingsBtn').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('settingsMenu').classList.toggle('show');
    };

    // 설정 메뉴 외부 클릭 시 닫기
    document.addEventListener('click', e => {
        const settingsMenu = document.getElementById('settingsMenu');
        const settingsBtn = document.getElementById('settingsBtn');

        if (settingsMenu.classList.contains('show') &&
            !settingsMenu.contains(e.target) &&
            e.target !== settingsBtn) {
            settingsMenu.classList.remove('show');
        }
    });

    // 백업 버튼
    document.getElementById('backupBtn').onclick = () => {
        if (StorageManager.backup(data)) {
            UIManager.toast('백업 완료');
            UIManager.showBackupReminder();
        } else {
            UIManager.toast('백업 실패');
        }
    };

    // 복원 버튼
    document.getElementById('restoreBtn').onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'application/json';
        inp.onchange = e => {
            if (!e.target.files.length) return;

            StorageManager.restore(e.target.files[0], newData => {
                SessionManager.data = newData;
                StorageManager.saveData(newData);
                UIManager.toast('데이터 복원 완료');
                location.reload();
            });
        };
        inp.click();
    };

    // 테마 전환
    document.getElementById('themeToggle').onclick = () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
        UIManager.toast(isDarkMode ? '다크 모드 활성화' : '라이트 모드 활성화');
    };

    // 저장된 테마 적용
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    // 🗂 기록 관리
    document.getElementById('manageRecords').onclick = () => {
        ModalManager.recordsModal(data[today].sessions, idx => {
            data[today].sessions.splice(idx, 1);
            StorageManager.saveData(data);
            UIManager.updateGoalBar(data[today]);
            ChartManager.drawWeekly(data);
            UIManager.toast('세션 삭제됨');
            updateButtonStates(); // 버튼 상태 업데이트
        });
    };

    // 📊 통계 보기
    document.getElementById('viewStats').onclick = () => {
        const stats = SessionManager.getSessionStats();
        const statsHtml = UIManager.updateSessionStats(stats);
        ModalManager.statsModal(statsHtml);
    };

    // 차트 설정
    document.getElementById('chartSettings').onclick = () => {
        const currentMaxHours = localStorage.getItem('chartMaxHours') || 4;

        ModalManager.chartSettingsModal(currentMaxHours, (maxHours) => {
            if (maxHours) {
                localStorage.setItem('chartMaxHours', maxHours);
            } else {
                localStorage.removeItem('chartMaxHours');
            }

            // 차트 다시 그리기
            ChartManager.drawWeekly(SessionManager.data);
            UIManager.toast('차트 설정이 저장되었습니다.');
        });
    };

    // 자동 버튼 상태 업데이트 (1초마다)
    setInterval(updateButtonStates, 1000);
}
