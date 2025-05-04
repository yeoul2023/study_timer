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

            // ���� ���� ���� Ȯ�� �� ����
            const state = this.getCurrentState();
            if (state === 'paused') {
                // �Ͻ����� ���� ���� ����
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
        if (!s) return; // ������ ������ �Լ� ����

        const now = Date.now();
        s.pt = now;
        s.pauses.push(now);
        s.pauseReasons = s.pauseReasons || [];
        s.pauseReasons.push({ time: now, reason });
        StorageManager.saveData(this.data);
    },

    resumeSession() {
        const s = this.getCurrentSession();
        if (!s || !s.pt) return; // �����̳� pt ���� ������ �Լ� ����

        const now = Date.now();
        s.acc += Math.max(0, now - s.pt); // ���� ����
        s.pt = null; // pt �� �ʱ�ȭ
        s.resumes.push(now);
        StorageManager.saveData(this.data);
    },

    endSession() {
        const s = this.getCurrentSession();
        if (!s) return; // ������ ������ �Լ� ����

        // �Ͻ����� ���¿��� �����ϴ� ���
        if (s.pauses.length > s.resumes.length && s.pt) {
            s.acc += Math.max(0, Date.now() - s.pt); // ���� ����
        }

        s.end = Date.now();

        // ���� �ð� ����
        const sessionDuration = Math.max(0, (s.end - s.start) - s.acc);
        if (sessionDuration < 0) {
            console.error("Invalid session duration:", sessionDuration);
            s.end = s.start + s.acc; // ����
        }

        this.updateSummary();
        StorageManager.saveData(this.data);
    },

    updateSummary() {
        const d = this.data[this.todayKey];
        const total = d.sessions.reduce((sum, s) => {
            if (!s.end) return sum;

            // ���� �ð� ��� �� ���� ����
            const sessionTime = Math.max(0, s.end - s.start - (s.acc || 0));
            return sum + sessionTime;
        }, 0);

        d.summary.actualHours = +(total / 3600000).toFixed(2);

        // ��ǥ�� 0�� ��� ������ ���� ����
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

        // ��� ��¥�� ���� ����
        Object.keys(this.data).forEach(date => {
            const daySessions = this.data[date].sessions.map(s => ({
                ...s,
                date
            }));
            allSessions.push(...daySessions);
        });

        // �Ϸ�� ���Ǹ� ���͸�
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

        // ���� ���� ��� (�и���)
        const sessionLengths = completedSessions.map(s => {
            const duration = Math.max(0, s.end - s.start - (s.acc || 0));
            return { duration, date: s.date };
        });

        // ���� ���� ��
        const todaySessions = sessionLengths.filter(s => s.date === this.todayKey).length;

        // ���� �� ���� (�ð�)
        const longestSession = Math.max(...sessionLengths.map(s => s.duration)) / 3600000;

        // ��� ���� ���� (�ð�)
        const avgSessionLength = sessionLengths.reduce((sum, s) => sum + s.duration, 0) /
            sessionLengths.length / 3600000;

        // �Ͻ����� ���� ���
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

                // ������ ����� ���� ���� �ð��� �ð��뿡 ��� �ð� �Ҵ�
                hourlyStats[startHour].totalDuration += duration;
                hourlyStats[startHour].sessionCount++;
                hourlyStats[startHour].pauseCount += (s.pauses ? s.pauses.length : 0);
            });
        });

        // �ð��� ��� ���ߵ� ��� (�Ͻ����� Ƚ���� ���� ���� ���̰� �� �ð��밡 ���� ����)
        const productivityScores = hourlyStats.map((stat, hour) => {
            if (stat.sessionCount === 0) return { hour, score: 0 };

            const avgDuration = stat.totalDuration / stat.sessionCount;
            const avgPauses = stat.pauseCount / stat.sessionCount;

            // ���� ���: ��� ���� �ð��� ��� �Ͻ������� �������� ���� ����
            const score = (avgDuration / 3600000) * (1 / (avgPauses + 1));

            return { hour, score };
        });

        // ���� ���� �������� ����
        return productivityScores.sort((a, b) => b.score - a.score);
    },

    predictGoalCompletion() {
        const today = this.data[this.todayKey];
        if (!today) return null;

        const currentHours = today.summary.actualHours;
        const goalHours = today.goalHours || 4;
        const remainingHours = goalHours - currentHours;

        if (remainingHours <= 0) {
            return { status: 'completed', message: '��ǥ �޼� �Ϸ�!' };
        }

        // �ֱ� 3�ϰ��� �ð��� ���η� ���
        const recentDays = Object.keys(this.data)
            .sort()
            .slice(-4, -1); // ���� ���� �ֱ� 3��

        if (recentDays.length === 0) {
            return { status: 'unknown', message: '������ ���� �����Ͱ� �����մϴ�.' };
        }

        let totalStudyRate = 0;
        let dayCount = 0;

        recentDays.forEach(date => {
            const day = this.data[date];
            if (day && day.summary && day.summary.actualHours > 0) {
                // üũ�κ��� ������ ���� ��������� �ð� ���
                const firstSession = day.sessions[0];
                const lastSession = day.sessions[day.sessions.length - 1];

                if (firstSession && lastSession && lastSession.end) {
                    const totalTimeSpan = (lastSession.end - firstSession.start) / 3600000; // �ð� ����
                    const studyRate = day.summary.actualHours / totalTimeSpan; // �ð��� ���� ���� �ð�

                    totalStudyRate += studyRate;
                    dayCount++;
                }
            }
        });

        if (dayCount === 0) {
            return { status: 'unknown', message: '������ ���� �����Ͱ� �����մϴ�.' };
        }

        const avgStudyRate = totalStudyRate / dayCount;
        const estimatedHoursNeeded = remainingHours / avgStudyRate;

        // ���� �ð�
        const now = new Date();
        const estimatedCompletionTime = new Date(now.getTime() + estimatedHoursNeeded * 3600000);

        return {
            status: 'in_progress',
            remainingHours,
            estimatedCompletionTime,
            message: `��ǥ �޼����� �� ${Math.round(estimatedHoursNeeded * 10) / 10}�ð� �� �ʿ��մϴ�.`
        };
    },

    // AI �м��� ������ ����
    exportDataForAI() {
        const aiData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            userData: {
                // ����� ������ �߰��� �� ����
            },
            dailyData: []
        };

        // ��� ��¥ �����͸� �ð迭 �������� ��ȯ
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

            // �� ������ �ð迭 �����ͷ� ��ȯ
            day.sessions.forEach(s => {
                if (!s.end) return; // �Ϸ���� ���� ���� ����

                const session = {
                    startTime: s.start,
                    endTime: s.end,
                    durationMs: Math.max(0, s.end - s.start - (s.acc || 0)),
                    durationHours: Math.max(0, s.end - s.start - (s.acc || 0)) / 3600000,
                    pauseCount: s.pauses ? s.pauses.length : 0,
                    pauseTotalTimeMs: s.acc || 0,
                    pauseReasons: s.pauseReasons || []
                };

                // ���� �� Ȱ�� �ð迭 ������
                session.timeline = [];

                // ���� �̺�Ʈ
                session.timeline.push({
                    time: s.start,
                    type: "start"
                });

                // �Ͻ����� �̺�Ʈ
                if (s.pauses) {
                    s.pauses.forEach((time, i) => {
                        session.timeline.push({
                            time,
                            type: "pause",
                            reason: s.pauseReasons && s.pauseReasons[i] ? s.pauseReasons[i].reason : ""
                        });
                    });
                }

                // �簳 �̺�Ʈ
                if (s.resumes) {
                    s.resumes.forEach(time => {
                        session.timeline.push({
                            time,
                            type: "resume"
                        });
                    });
                }

                // ���� �̺�Ʈ
                session.timeline.push({
                    time: s.end,
                    type: "end"
                });

                // �ð������� ����
                session.timeline.sort((a, b) => a.time - b.time);

                dailyEntry.sessions.push(session);
            });

            aiData.dailyData.push(dailyEntry);
        });

        return aiData;
    },

    // CSV �������� �������� (������ �м���)
    exportCSV() {
        let csvContent = "��¥,��ǥ�ð�,�����ð�,�޼���,���Ǽ�,��ռ��ǽð�,�Ͻ�����Ƚ��\n";

        Object.keys(this.data).sort().forEach(date => {
            const day = this.data[date];
            const sessions = day.sessions.filter(s => s.end); // �Ϸ�� ���Ǹ�

            const totalDuration = sessions.reduce((sum, s) => {
                return sum + Math.max(0, s.end - s.start - (s.acc || 0));
            }, 0);

            const avgSessionTime = sessions.length ? totalDuration / sessions.length / 60000 : 0; // �� ����

            const totalPauses = sessions.reduce((sum, s) => {
                return sum + (s.pauses ? s.pauses.length : 0);
            }, 0);

            csvContent += `${date},${day.goalHours || 0},${day.summary.actualHours},${day.summary.completionRate},${sessions.length},${avgSessionTime.toFixed(2)},${totalPauses}\n`;
        });

        return csvContent;
    }
};
