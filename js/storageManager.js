export const StorageManager = {
    loadData() {
        try {
            const data = localStorage.getItem('studyData');
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error loading data from localStorage:', e);
            return {};
        }
    },

    saveData(data) {
        try {
            localStorage.setItem('studyData', JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving data to localStorage:', e);
            return false;
        }
    },

    backup(data) {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `study_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            localStorage.setItem('lastBackupDate', new Date().toISOString().slice(0, 10));
            return true;
        } catch (e) {
            console.error('Error creating backup:', e);
            return false;
        }
    },

    restore(file, cb) {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);

                // 데이터 구조 검증
                if (!data || typeof data !== 'object') {
                    throw new Error('유효하지 않은 데이터 형식');
                }

                // 최소한의 데이터 구조 확인
                const sampleDate = Object.keys(data)[0];
                if (sampleDate && (!data[sampleDate].sessions || !data[sampleDate].summary)) {
                    throw new Error('세션 또는 요약 데이터가 없습니다');
                }

                cb(data);
            } catch (e) {
                alert('백업 파일을 불러오는 중 오류가 발생했습니다: ' + e.message);
            }
        };

        reader.onerror = () => alert('파일을 읽는 중 오류가 발생했습니다');
        reader.readAsText(file);
    },

    // 자동 저장 설정 (5초마다)
    setupAutoSave(data) {
        this._autoSaveInterval = setInterval(() => {
            this.saveData(data);
            console.debug('Auto-saved at ' + new Date().toLocaleTimeString());
        }, 5000);

        // 브라우저 닫힐 때 저장
        window.addEventListener('beforeunload', () => {
            this.saveData(data);
        });
    },

    // 자동 백업 설정 (30분마다)
    setupAutoBackup(data) {
        const backupInterval = 30 * 60 * 1000; // 30분
        const lastBackup = localStorage.getItem('lastAutoBackupTime');
        let nextBackupTime;

        if (lastBackup) {
            const timeSinceLastBackup = Date.now() - parseInt(lastBackup);
            nextBackupTime = Math.max(0, backupInterval - timeSinceLastBackup);
        } else {
            nextBackupTime = backupInterval;
        }

        // 다음 예정된 백업 실행
        setTimeout(() => {
            this._performAutoBackup(data);

            // 이후 정기적으로 백업
            this._autoBackupInterval = setInterval(() => {
                this._performAutoBackup(data);
            }, backupInterval);
        }, nextBackupTime);
    },

    _performAutoBackup(data) {
        // 데이터를 백업 객체에 저장
        const backupObj = {
            timestamp: Date.now(),
            data: { ...data }
        };

        // 백업 목록 가져오기
        let backups = JSON.parse(localStorage.getItem('autoBackups') || '[]');

        // 최대 5개 백업 유지
        backups.push(backupObj);
        if (backups.length > 5) {
            backups.shift(); // 가장 오래된 백업 제거
        }

        // 저장
        localStorage.setItem('autoBackups', JSON.stringify(backups));
        localStorage.setItem('lastAutoBackupTime', Date.now().toString());
        console.debug('Auto-backup created at ' + new Date().toLocaleTimeString());
    },

    // 자동 백업 목록 조회
    getAutoBackups() {
        return JSON.parse(localStorage.getItem('autoBackups') || '[]');
    },

    // 자동 백업에서 복원
    restoreFromAutoBackup(index, cb) {
        const backups = this.getAutoBackups();
        if (backups[index]) {
            cb(backups[index].data);
            return true;
        }
        return false;
    },

    // localStorage 지원 여부 확인
    isLocalStorageSupported() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    }
};

// localStorage 미지원 시 메모리 스토리지로 대체
if (!StorageManager.isLocalStorageSupported()) {
    const memoryData = {};

    StorageManager.loadData = function () {
        const data = memoryData['studyData'];
        return data ? JSON.parse(data) : {};
    };

    StorageManager.saveData = function (data) {
        memoryData['studyData'] = JSON.stringify(data);
        return true;
    };
}
