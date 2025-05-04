import { bindEvents } from './eventBinder.js';

// 페이지 로드 시 이벤트 바인딩
window.addEventListener('DOMContentLoaded', bindEvents);

// 서비스 워커 등록 (오프라인 지원)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.debug('Service Worker registered'))
            .catch(err => console.debug('Service Worker registration failed:', err));
    });
}
