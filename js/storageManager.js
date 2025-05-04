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

                // ������ ���� ����
                if (!data || typeof data !== 'object') {
                    throw new Error('��ȿ���� ���� ������ ����');
                }

                // �ּ����� ������ ���� Ȯ��
                const sampleDate = Object.keys(data)[0];
                if (sampleDate && (!data[sampleDate].sessions || !data[sampleDate].summary)) {
                    throw new Error('���� �Ǵ� ��� �����Ͱ� �����ϴ�');
                }

                cb(data);
            } catch (e) {
                alert('��� ������ �ҷ����� �� ������ �߻��߽��ϴ�: ' + e.message);
            }
        };

        reader.onerror = () => alert('������ �д� �� ������ �߻��߽��ϴ�');
        reader.readAsText(file);
    },

    // �ڵ� ���� ���� (5�ʸ���)
    setupAutoSave(data) {
        this._autoSaveInterval = setInterval(() => {
            this.saveData(data);
            console.debug('Auto-saved at ' + new Date().toLocaleTimeString());
        }, 5000);

        // ������ ���� �� ����
        window.addEventListener('beforeunload', () => {
            this.saveData(data);
        });
    },

    // �ڵ� ��� ���� (30�и���)
    setupAutoBackup(data) {
        const backupInterval = 30 * 60 * 1000; // 30��
        const lastBackup = localStorage.getItem('lastAutoBackupTime');
        let nextBackupTime;

        if (lastBackup) {
            const timeSinceLastBackup = Date.now() - parseInt(lastBackup);
            nextBackupTime = Math.max(0, backupInterval - timeSinceLastBackup);
        } else {
            nextBackupTime = backupInterval;
        }

        // ���� ������ ��� ����
        setTimeout(() => {
            this._performAutoBackup(data);

            // ���� ���������� ���
            this._autoBackupInterval = setInterval(() => {
                this._performAutoBackup(data);
            }, backupInterval);
        }, nextBackupTime);
    },

    _performAutoBackup(data) {
        // �����͸� ��� ��ü�� ����
        const backupObj = {
            timestamp: Date.now(),
            data: { ...data }
        };

        // ��� ��� ��������
        let backups = JSON.parse(localStorage.getItem('autoBackups') || '[]');

        // �ִ� 5�� ��� ����
        backups.push(backupObj);
        if (backups.length > 5) {
            backups.shift(); // ���� ������ ��� ����
        }

        // ����
        localStorage.setItem('autoBackups', JSON.stringify(backups));
        localStorage.setItem('lastAutoBackupTime', Date.now().toString());
        console.debug('Auto-backup created at ' + new Date().toLocaleTimeString());
    },

    // �ڵ� ��� ��� ��ȸ
    getAutoBackups() {
        return JSON.parse(localStorage.getItem('autoBackups') || '[]');
    },

    // �ڵ� ������� ����
    restoreFromAutoBackup(index, cb) {
        const backups = this.getAutoBackups();
        if (backups[index]) {
            cb(backups[index].data);
            return true;
        }
        return false;
    },

    // localStorage ���� ���� Ȯ��
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

// localStorage ������ �� �޸� ���丮���� ��ü
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
