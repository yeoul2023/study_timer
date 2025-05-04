export const ModalManager = {
    open(html, onShow) {
        const overlay = document.getElementById('modalOverlay');
        const content = document.getElementById('modalContent');

        content.innerHTML = html;
        overlay.classList.remove('hidden');

        if (onShow) onShow();

        // ESC 키로 모달 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                document.removeEventListener('keydown', escHandler);
            }
        };

        document.addEventListener('keydown', escHandler);

        // 모달 외부 클릭 시 닫기
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.close();
            }
        };
    },

    close() {
        document.getElementById('modalOverlay').classList.add('hidden');
    },

    goalModal(day, cb) {
        const html = `
      <h3>목표 시간 설정</h3>
      <div class="input-group">
        <label>시간</label>
        <input type="number" id="goalHours" min="0" max="24" value="${Math.floor(day.goalHours || 4)}">
      </div>
      <div class="input-group">
        <label>분</label>
        <input type="number" id="goalMinutes" min="0" max="59" value="${Math.round(((day.goalHours || 4) % 1) * 60)}">
      </div>
      <div class="modal-actions">
        <button id="cancelGoal" class="secondary">취소</button>
        <button id="saveGoal">저장</button>
      </div>
    `;

        this.open(html, () => {
            document.getElementById('saveGoal').onclick = () => {
                const h = parseInt(document.getElementById('goalHours').value) || 0;
                const m = parseInt(document.getElementById('goalMinutes').value) || 0;

                if (h === 0 && m === 0) {
                    alert('목표 시간은 최소 1분 이상이어야 합니다.');
                    return;
                }

                cb(h, m);
                this.close();
            };

            document.getElementById('cancelGoal').onclick = () => this.close();
        });
    },

    summaryModal(completionRate, cb) {
        const html = `
      <h3>목표 달성률: ${completionRate}%</h3>
      <p>목표를 달성하지 못한 이유를 기록해 주세요.</p>
      <div class="input-group">
        <label>이유</label>
        <select id="underGoalReason">
          <option value="시간 부족">시간 부족</option>
          <option value="컨디션 저하">컨디션 저하</option>
          <option value="예상치 못한 일정">예상치 못한 일정</option>
          <option value="목표 과다 설정">목표 과다 설정</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="input-group">
        <label>메모</label>
        <textarea id="underGoalMemo" rows="3"></textarea>
      </div>
      <div class="modal-actions">
        <button id="skipSummary" class="secondary">건너뛰기</button>
        <button id="saveSummary">저장</button>
      </div>
    `;

        this.open(html, () => {
            document.getElementById('saveSummary').onclick = () => {
                const reason = document.getElementById('underGoalReason').value;
                const memo = document.getElementById('underGoalMemo').value;
                cb(reason, memo);
                this.close();
            };

            document.getElementById('skipSummary').onclick = () => this.close();
        });
    },

    recordsModal(sessions, onDelete) {
        if (!sessions || sessions.length === 0) {
            this.open(`
        <h3>세션 기록</h3>
        <p>오늘 기록된 세션이 없습니다.</p>
        <div class="modal-actions">
          <button id="closeRecords">닫기</button>
        </div>
      `, () => {
                document.getElementById('closeRecords').onclick = () => this.close();
            });
            return;
        }

        const formatTime = (timestamp) => {
            if (!timestamp) return '진행 중';
            const d = new Date(timestamp);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        const formatDuration = (ms) => {
            // 음수 시간 방지
            ms = Math.max(0, ms);
            const mins = Math.floor(ms / 60000);
            const hrs = Math.floor(mins / 60);
            const remainMins = mins % 60;
            return `${hrs}시간 ${remainMins}분`;
        };

        let html = `
      <h3>세션 기록</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 1rem;">
        <tr>
          <th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid #ddd;">시작</th>
          <th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid #ddd;">종료</th>
          <th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid #ddd;">시간</th>
          <th style="text-align:center; padding: 0.5rem; border-bottom: 1px solid #ddd;">삭제</th>
        </tr>
    `;

        sessions.forEach((s, idx) => {
            const duration = s.end ? Math.max(0, s.end - s.start - (s.acc || 0)) : 0;

            html += `
        <tr>
          <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${formatTime(s.start)}</td>
          <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${formatTime(s.end)}</td>
          <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${s.end ? formatDuration(duration) : '-'}</td>
          <td style="text-align:center; padding: 0.5rem; border-bottom: 1px solid #eee;">
            <button class="delete-session" data-idx="${idx}" style="background: #ff7f7f; color: white; border: none; border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer;">삭제</button>
          </td>
        </tr>
      `;
        });

        html += `
      </table>
      <div class="modal-actions">
        <button id="closeRecords">닫기</button>
      </div>
    `;

        this.open(html, () => {
            document.getElementById('closeRecords').onclick = () => this.close();

            document.querySelectorAll('.delete-session').forEach(btn => {
                btn.onclick = () => {
                    if (confirm('이 세션을 삭제하시겠습니까?')) {
                        const idx = parseInt(btn.dataset.idx);
                        onDelete(idx);
                        this.close();
                    }
                };
            });
        });
    },

    statsModal(stats) {
        this.open(`
      <h3>통계</h3>
      <div>${stats}</div>
      <div class="modal-actions">
        <button id="closeStats">닫기</button>
      </div>
    `, () => {
            document.getElementById('closeStats').onclick = () => this.close();
        });
    },

    chartSettingsModal(currentMaxHours, cb) {
        const html = `
      <h3>차트 설정</h3>
      <div class="input-group">
        <label>Y축 최대 시간 (시간)</label>
        <input type="number" id="chartMaxHours" min="1" step="0.5" value="${currentMaxHours || 4}">
        <p class="hint">비워두면 데이터 기반으로 자동 설정됩니다.</p>
      </div>
      <div class="modal-actions">
        <button id="cancelChartSettings" class="secondary">취소</button>
        <button id="saveChartSettings">저장</button>
      </div>
    `;

        this.open(html, () => {
            document.getElementById('saveChartSettings').onclick = () => {
                const maxHours = document.getElementById('chartMaxHours').value;
                cb(maxHours);
                this.close();
            };

            document.getElementById('cancelChartSettings').onclick = () => this.close();
        });
    }
};
