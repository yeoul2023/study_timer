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

            // 실제 경과 시간으로 보정
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
            // 타이머 실행 중일 때
            return Date.now() - this._start + this._acc;
        } else {
            // 타이머 일시정지 상태일 때
            return this._acc;
        }
    }
}
