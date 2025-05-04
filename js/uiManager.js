export const UIManager = {
    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    },

    updateDateTime() {
        const now = new Date();
        const currentDateKey = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8);

        document.getElementById('dateTime').textContent = `${currentDateKey} ${timeStr}`;

        // 날짜가 변경되었는지 확인 (자정 지남)
        if (window.SessionManager && SessionManager.todayKey !== currentDateKey) {
            // 현재 세션이 있으면 종료하고 새 날짜로 전환
            if (SessionManager.getCurrentSession() && !SessionManager.getCurrentSession().end) {
                this.toast('날짜가 변경되었습니다. 세션을 종료합니다.');
                SessionManager.endSession();
            }

            SessionManager.todayKey = currentDateKey;
            SessionManager.init();

            // UI 업데이트
            this.update5DayAvg(SessionManager.data);
            this.updateGoalBar(SessionManager.data[currentDateKey]);

            if (window.ChartManager) {
                ChartManager.drawWeekly(SessionManager.data);
            }
        }
    },

    update5DayAvg(data) {
        const keys = Object.keys(data).sort().slice(-5);
        let sum = 0, cnt = 0;

        keys.forEach(k => {
            const h = data[k]?.summary?.actualHours || 0;
            if (h > 0) { sum += h; cnt++; }
        });

        const avg = cnt ? sum / cnt : 0;
        const h = Math.floor(avg);
        const m = Math.round((avg - h) * 60);

        document.getElementById('avg5Day').textContent = `5일 평균: ${h}시간 ${m}분`;
    },

    updateGoalBar(todayData) {
        if (!todayData) return;

        // 음수 방지 추가
        const actual = Math.max(0, todayData.summary.actualHours);
        const goal = todayData.goalHours || 0.1;
        const pct = Math.min(100, Math.round(actual / goal * 100));

        document.getElementById('goalFill').style.width = pct + '%';
        document.getElementById('goalText').textContent = pct + '%';

        const H = Math.floor(todayData.goalHours || 0);
        const M = Math.round(((todayData.goalHours || 0) - H) * 60).toString().padStart(2, '0');

        document.getElementById('goalInfo').textContent = `목표: ${H}시간 ${M}분`;

        // 목표 달성 시 축하 효과
        if (pct >= 100 && todayData.summary.actualHours > 0 && !todayData.goalCelebrated) {
            this.celebrateGoalAchievement();
            todayData.goalCelebrated = true;
        }
    },

    updateTimerDisplay(ms) {
        const tot = Math.floor(ms / 1000);
        const h = String(Math.floor(tot / 3600)).padStart(2, '0');
        const m = String(Math.floor((tot % 3600) / 60)).padStart(2, '0');
        const s = String(tot % 60).padStart(2, '0');

        document.getElementById('timerDisplay').textContent = `${h}:${m}:${s}`;
    },

    showBackupReminder() {
        try {
            const last = localStorage.getItem('lastBackupDate') || '';
            const diff = last
                ? (new Date().getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
                : Infinity;

            document.getElementById('backupReminder').textContent =
                diff >= 7 ? '📁 마지막 백업 7일 초과, 백업을 권장합니다.' : '';
        } catch (e) {
            console.error('Error showing backup reminder:', e);
        }
    },

    celebrateGoalAchievement() {
        this.toast('🎉 목표를 달성했습니다! 축하합니다! 🎉');

        // 축하 효과 (색종이)
        const celebration = document.createElement('div');
        celebration.className = 'celebration';
        document.body.appendChild(celebration);

        // 색종이 생성
        const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            celebration.appendChild(confetti);
        }

        // 3초 후 제거
        setTimeout(() => {
            document.body.removeChild(celebration);
        }, 3000);
    },

    updateSessionStats(stats) {
        const html = `
      <h3>통계 요약</h3>
      <p>총 공부 시간: ${stats.totalHours}시간</p>
      <p>평균 세션 길이: ${stats.avgSessionLength}시간</p>
      <p>최장 집중 시간: ${stats.longestSession}시간</p>
      <p>오늘 세션 수: ${stats.sessionsToday}회</p>
      
      <h3>일시정지 이유 분석</h3>
      <ul>
        ${Object.entries(stats.pauseReasons).map(([reason, count]) =>
            `<li>${reason}: ${count}회</li>`
        ).join('')}
      </ul>
    `;

        return html;
    },

    updateProductivityAnalysis(productivityScores) {
        const topHours = productivityScores.filter(h => h.score > 0).slice(0, 5);

        const html = `
      <h3>집중도 분석</h3>
      <p>가장 집중이 잘 되는 시간대:</p>
      <ul>
        ${topHours.map(h =>
            `<li>${h.hour}시: 점수 ${h.score.toFixed(2)}</li>`
        ).join('')}
      </ul>
      <p class="hint">점수는 세션 길이와 일시정지 횟수를 기반으로 계산됩니다.</p>
    `;

        return html;
    },

    updateGoalPrediction(prediction) {
        if (!prediction) return '예측을 위한 데이터가 부족합니다.';

        if (prediction.status === 'completed') {
            return `<p>🎉 ${prediction.message}</p>`;
        } else if (prediction.status === 'unknown') {
            return `<p>${prediction.message}</p>`;
        } else {
            const completionTime = prediction.estimatedCompletionTime.toLocaleTimeString();
            return `
        <p>남은 목표 시간: ${prediction.remainingHours.toFixed(2)}시간</p>
        <p>예상 완료 시간: ${completionTime}</p>
        <p>${prediction.message}</p>
      `;
        }
    }
};
