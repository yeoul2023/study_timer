import { bindEvents } from './eventBinder.js';

// ������ �ε� �� �̺�Ʈ ���ε�
window.addEventListener('DOMContentLoaded', bindEvents);

// ���� ��Ŀ ��� (�������� ����)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.debug('Service Worker registered'))
            .catch(err => console.debug('Service Worker registration failed:', err));
    });
}
