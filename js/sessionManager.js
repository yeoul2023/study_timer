import { StorageManager } from './storageManager.js';

export const SessionManager = {
    data: null,
    todayKey: null,

    init() {
        try {
            this.data = StorageManager.loadData();
            this.todayKey = new Date().toISOString().slice(0, 10);

            if (!this.data[this.todayKey]) {
                this.data[this.todayKey] = {
                    sessions: [],
                    summary: {
                        actualHours: 0,
                        completionRate: 0,
                        underGoalReason: '',
                        memo: ''
                    },
                    checkIn: null,
                    goalHours: 4
                };
                StorageManager.saveData(this.data);
            }

            // 현재 세션 상태 확인 및 복원
            const state = this.getCurrentState();
            if (state === 'paused') {
                // 일시정지 상태 복원 로직
                console.debug('Session was paused, restoring state');
            }
        } catch (e) {
            console.error('Error initializing SessionManager:', e);
            this.data = {};
            this.data[this.todayKey] = {
                sessions: [],
                summary: {
                    actualHours: 0,
                    completionRate: 0,
                    underGoalReason: '',
                    memo: ''
                },
                checkIn: null,
                goalHours: 4
            };
        }
    },

    startSession() {
        const newSession = {
            start: Date.now(),
            pauses: [],
            resumes: [],
            acc: 0,
            end: 0,
            pauseReasons: []
        };
        this.data[this.todayKey].sessions.push(newSession);
        StorageManager.saveData(this.data);
        return newSession;
    },

    pauseSession(reason) {
        const s = this.getCurrentSession();
        if (!s) return; // 세션이 없으면 함수 종료

        const now = Date.now();
        s.pt = now;
        s.pauses.push(now);
        s.pauseReasons = s.pauseReasons || [];
        s.pauseReasons.push({ time: now, reason });
        StorageManager.saveData(this.data);
    },

    resumeSession() {
        const s = this.getCurrentSession();
        if (!s || !s.pt) return; // 세션이나 pt 값이 없으면 함수 종료

        const now = Date.now();
        s.acc += Math.max(0, now - s.pt); // 음수 방지
        s.pt = null; // pt 값 초기화
        s.resumes.push(now);
        StorageManager.saveData(this.data);
    },

    endSession() {
        const s = this.getCurrentSession();
        if (!s) return; // 세션이 없으면 함수 종료

        // 일시정지 상태에서 종료하는 경우
        if (s.pauses.length > s.resumes.length && s.pt) {
            s.acc += Math.max(0, Date.now() - s.pt); // 음수 방지
        }

        s.end = Date.now();

        // 세션 시간 검증
        const sessionDuration = Math.max(0, (s.end - s.start) - s.acc);
        if (sessionDuration < 0) {
            console.error("Invalid session duration:", sessionDuration);
            s.end = s.start + s.acc; // 보정
        }

        this.updateSummary();
        StorageManager.saveData(this.data);
    },

    updateSummary() {
        const d = this.data[this.todayKey];
        const total = d.sessions.reduce((sum, s) => {
            if (!s.end) return sum;

            // 세션 시간 계산 및 음수 방지
            const sessionTime = Math.max(0, s.end - s.start - (s.acc || 0));
            return sum + sessionTime;
        }, 0);

        d.summary.actualHours = +(total / 3600000).toFixed(2);

        // 목표가 0인 경우 나눗셈 오류 방지
        const goalHours = d.goalHours || 0.1;
        d.summary.completionRate = Math.min(100, Math.round(d.summary.actualHours / goalHours * 100));

        StorageManager.saveData(this.data);
    },

    getCurrentSession() {
        const arr = this.data[this.todayKey]?.sessions;
        return arr && arr.length > 0 ? arr[arr.length - 1] : null;
    },

    getCurrentState() {
        const session = this.getCurrentSession();
        if (!session) return 'inactive';
        if (session.end) return 'ended';
        if (session.pauses.length > session.resumes.length) return 'paused';
        return 'active';
    },

    validateSession(session) {
        if (!session) return ['No session'];
        const errors = [];
        if (session.start > Date.now()) errors.push('Start time in future');
        if (session.end && session.end < session.start) errors.push('End before start');
        if (session.acc < 0) errors.push('Negative pause time');
        return errors.length ? errors : null;
    },

    getSessionStats() {
        const allSessions = [];

        // 모든 날짜의 세션 수집
        Object.keys(this.data).forEach(date => {
            const daySessions = this.data[date].sessions.map(s => ({
                ...s,
                date
            }));
            allSessions.push(...daySessions);
        });

        // 완료된 세션만 필터링
        const completedSessions = allSessions.filter(s => s.end);

        if (completedSessions.length === 0) {
            return {
                totalHours: 0,
                avgSessionLength: 0,
                longestSession: 0,
                sessionsToday: 0,
                pauseReasons: {}
            };
        }

        // 세션 길이 계산 (밀리초)
        const sessionLengths = completedSessions.map(s => {
            const duration = Math.max(0, s.end - s.start - (s.acc || 0));
            return { duration, date: s.date };
        });

        // 오늘 세션 수
        const todaySessions = sessionLengths.filter(s => s.date === this.todayKey).length;

        // 가장 긴 세션 (시간)
        const longestSession = Math.max(...sessionLengths.map(s => s.duration)) / 3600000;

        // 평균 세션 길이 (시간)
        const avgSessionLength = sessionLengths.reduce((sum, s) => sum + s.duration, 0) /
            sessionLengths.length / 3600000;

        // 일시정지 이유 통계
        const pauseReasons = {};
        completedSessions.forEach(s => {
            if (!s.pauseReasons) return;

            s.pauseReasons.forEach(p => {
                pauseReasons[p.reason] = (pauseReasons[p.reason] || 0) + 1;
            });
        });

        return {
            totalHours: this.getTotalHours(),
            avgSessionLength: avgSessionLength.toFixed(2),
            longestSession: longestSession.toFixed(2),
            sessionsToday: todaySessions,
            pauseReasons
        };
    },

    getTotalHours() {
        return Object.values(this.data).reduce(
            (sum, d) => sum + (d.summary?.actualHours || 0),
            0
        ).toFixed(1);
    },

    analyzeProductiveHours() {
        const hourlyStats = Array(24).fill(0).map(() => ({
            totalDuration: 0,
            sessionCount: 0,
            pauseCount: 0
        }));

        Object.values(this.data).forEach(day => {
            day.sessions.forEach(s => {
                if (!s.end) return;

                const startHour = new Date(s.start).getHours();
                const duration = Math.max(0, s.end - s.start - (s.acc || 0));

                // 간단한 계산을 위해 시작 시간의 시간대에 모든 시간 할당
                hourlyStats[startHour].totalDuration += duration;
                hourlyStats[startHour].sessionCount++;
                hourlyStats[startHour].pauseCount += (s.pauses ? s.pauses.length : 0);
            });
        });

        // 시간당 평균 집중도 계산 (일시정지 횟수가 적고 세션 길이가 긴 시간대가 높은 점수)
        const productivityScores = hourlyStats.map((stat, hour) => {
            if (stat.sessionCount === 0) return { hour, score: 0 };

            const avgDuration = stat.totalDuration / stat.sessionCount;
            const avgPauses = stat.pauseCount / stat.sessionCount;

            // 점수 계산: 평균 지속 시간이 길고 일시정지가 적을수록 높은 점수
            const score = (avgDuration / 3600000) * (1 / (avgPauses + 1));

            return { hour, score };
        });

        // 점수 기준 내림차순 정렬
        return productivityScores.sort((a, b) => b.score - a.score);
    },

    predictGoalCompletion() {
        const today = this.data[this.todayKey];
        if (!today) return null;

        const currentHours = today.summary.actualHours;
        const goalHours = today.goalHours || 4;
        const remainingHours = goalHours - currentHours;

        if (remainingHours <= 0) {
            return { status: 'completed', message: '목표 달성 완료!' };
        }

        // 최근 3일간의 시간당 공부량 계산
        const recentDays = Object.keys(this.data)
            .sort()
            .slice(-4, -1); // 오늘 제외 최근 3일

        if (recentDays.length === 0) {
            return { status: 'unknown', message: '예측을 위한 데이터가 부족합니다.' };
        }

        let totalStudyRate = 0;
        let dayCount = 0;

        recentDays.forEach(date => {
            const day = this.data[date];
            if (day && day.summary && day.summary.actualHours > 0) {
                // 체크인부터 마지막 세션 종료까지의 시간 계산
                const firstSession = day.sessions[0];
                const lastSession = day.sessions[day.sessions.length - 1];

                if (firstSession && lastSession && lastSession.end) {
                    const totalTimeSpan = (lastSession.end - firstSession.start) / 3600000; // 시간 단위
                    const studyRate = day.summary.actualHours / totalTimeSpan; // 시간당 실제 공부 시간

                    totalStudyRate += studyRate;
                    dayCount++;
                }
            }
        });

        if (dayCount === 0) {
            return { status: 'unknown', message: '예측을 위한 데이터가 부족합니다.' };
        }

        const avgStudyRate = totalStudyRate / dayCount;
        const estimatedHoursNeeded = remainingHours / avgStudyRate;

        // 현재 시간
        const now = new Date();
        const estimatedCompletionTime = new Date(now.getTime() + estimatedHoursNeeded * 3600000);

        return {
            status: 'in_progress',
            remainingHours,
            estimatedCompletionTime,
            message: `목표 달성까지 약 ${Math.round(estimatedHoursNeeded * 10) / 10}시간 더 필요합니다.`
        };
    },

    // AI 분석용 데이터 추출
    exportDataForAI() {
        const aiData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            userData: {
                // 사용자 정보를 추가할 수 있음
            },
            dailyData: []
        };

        // 모든 날짜 데이터를 시계열 형식으로 변환
        Object.keys(this.data).sort().forEach(date => {
            const day = this.data[date];
            const dailyEntry = {
                date,
                summary: {
                    actualHours: day.summary.actualHours,
                    goalHours: day.goalHours || 0,
                    completionRate: day.summary.completionRate,
                    underGoalReason: day.summary.underGoalReason || "",
                    memo: day.summary.memo || ""
                },
                checkIn: day.checkIn,
                sessions: []
            };

            // 각 세션을 시계열 데이터로 변환
            day.sessions.forEach(s => {
                if (!s.end) return; // 완료되지 않은 세션 제외

                const session = {
                    startTime: s.start,
                    endTime: s.end,
                    durationMs: Math.max(0, s.end - s.start - (s.acc || 0)),
                    durationHours: Math.max(0, s.end - s.start - (s.acc || 0)) / 3600000,
                    pauseCount: s.pauses ? s.pauses.length : 0,
                    pauseTotalTimeMs: s.acc || 0,
                    pauseReasons: s.pauseReasons || []
                };

                // 세션 내 활동 시계열 데이터
                session.timeline = [];

                // 시작 이벤트
                session.timeline.push({
                    time: s.start,
                    type: "start"
                });

                // 일시정지 이벤트
                if (s.pauses) {
                    s.pauses.forEach((time, i) => {
                        session.timeline.push({
                            time,
                            type: "pause",
                            reason: s.pauseReasons && s.pauseReasons[i] ? s.pauseReasons[i].reason : ""
                        });
                    });
                }

                // 재개 이벤트
                if (s.resumes) {
                    s.resumes.forEach(time => {
                        session.timeline.push({
                            time,
                            type: "resume"
                        });
                    });
                }

                // 종료 이벤트
                session.timeline.push({
                    time: s.end,
                    type: "end"
                });

                // 시간순으로 정렬
                session.timeline.sort((a, b) => a.time - b.time);

                dailyEntry.sessions.push(session);
            });

            aiData.dailyData.push(dailyEntry);
        });

        return aiData;
    },

    // CSV 형식으로 내보내기 (간단한 분석용)
    exportCSV() {
        let csvContent = "날짜,목표시간,실제시간,달성률,세션수,평균세션시간,일시정지횟수\n";

        Object.keys(this.data).sort().forEach(date => {
            const day = this.data[date];
            const sessions = day.sessions.filter(s => s.end); // 완료된 세션만

            const totalDuration = sessions.reduce((sum, s) => {
                return sum + Math.max(0, s.end - s.start - (s.acc || 0));
            }, 0);

            const avgSessionTime = sessions.length ? totalDuration / sessions.length / 60000 : 0; // 분 단위

            const totalPauses = sessions.reduce((sum, s) => {
                return sum + (s.pauses ? s.pauses.length : 0);
            }, 0);

            csvContent += `${date},${day.goalHours || 0},${day.summary.actualHours},${day.summary.completionRate},${sessions.length},${avgSessionTime.toFixed(2)},${totalPauses}\n`;
        });

        return csvContent;
    }
};
