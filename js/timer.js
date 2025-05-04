export class Timer {
    constructor(onTick) {
        this.onTick = onTick;
        this._interval = null;
        this._start = 0;
        this._acc = 0;
        this._lastTick = 0;
        this._expectedTick = 0;
    }

    start() {
        this._start = Date.now();
        this._lastTick = Date.now();
        this._expectedTick = this._lastTick + 500;
        this._interval = setInterval(() => {
            const now = Date.now();
            const drift = now - this._expectedTick;

            // ���� ��� �ð����� ����
            if (drift > 100) {
                console.debug(`Timer drift detected: ${drift}ms`);
            }

            this._lastTick = now;
            this._expectedTick += 500;

            this.onTick(this.elapsed);
        }, 500);
    }

    pause() {
        clearInterval(this._interval);
        this._interval = null;
        this._acc += Date.now() - this._start;
    }

    resume() {
        this._start = Date.now();
        this._lastTick = Date.now();
        this._expectedTick = this._lastTick + 500;
        this._interval = setInterval(() => {
            const now = Date.now();
            const drift = now - this._expectedTick;

            if (drift > 100) {
                console.debug(`Timer drift detected: ${drift}ms`);
            }

            this._lastTick = now;
            this._expectedTick += 500;

            this.onTick(this.elapsed);
        }, 500);
    }

    end() {
        clearInterval(this._interval);
        this._interval = null;
        return this.elapsed;
    }

    get elapsed() {
        if (this._interval) {
            // Ÿ�̸� ���� ���� ��
            return Date.now() - this._start + this._acc;
        } else {
            // Ÿ�̸� �Ͻ����� ������ ��
            return this._acc;
        }
    }
}
