export const ChartManager = {
    drawWeekly(data) {
        const container = document.getElementById('chartContainer');
        container.innerHTML = '';

        // Y�� ���̺� �߰�
        const yAxis = document.createElement('div');
        yAxis.className = 'y-axis';
        container.appendChild(yAxis);

        // �ֱ� 7�� ������ ��������
        const today = new Date();
        const dates = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().slice(0, 10));
        }

        // �ִ밪 ��� (����� ���� �Ǵ� ������ ���)
        let maxHours = localStorage.getItem('chartMaxHours') ?
            parseFloat(localStorage.getItem('chartMaxHours')) : 0;

        dates.forEach(date => {
            const hours = data[date]?.summary?.actualHours || 0;
            if (hours > maxHours) maxHours = hours;
        });

        // �ִ밪�� 0�̸� �⺻�� ����
        maxHours = maxHours || 4;

        // Y�� ���� ���� (5�� ����)
        for (let i = 5; i >= 0; i--) {
            const label = document.createElement('div');
            label.textContent = (maxHours * i / 5).toFixed(1);
            yAxis.appendChild(label);
        }

        // ��Ʈ ����
        const chart = document.createElement('div');
        chart.style.display = 'flex';
        chart.style.height = '100%';
        chart.style.width = 'calc(100% - 40px)';
        chart.style.marginLeft = '40px';
        chart.style.justifyContent = 'space-between';
        chart.style.alignItems = 'flex-end';
        container.appendChild(chart);

        // �� ��¥�� ���� ����
        dates.forEach(date => {
            const hours = data[date]?.summary?.actualHours || 0;
            const percent = maxHours ? (hours / maxHours * 100) : 0;

            const barContainer = document.createElement('div');
            barContainer.style.flex = '1';
            barContainer.style.height = '100%';
            barContainer.style.display = 'flex';
            barContainer.style.flexDirection = 'column';
            barContainer.style.alignItems = 'center';
            barContainer.style.justifyContent = 'flex-end';

            const bar = document.createElement('div');
            bar.style.width = '60%';
            bar.style.height = `${percent}%`;
            bar.style.backgroundColor = date === dates[dates.length - 1] ? '#6a9ae2' : '#aac8f0';
            bar.style.borderRadius = '4px 4px 0 0';
            bar.style.minHeight = '1px';

            const label = document.createElement('div');
            label.textContent = date.slice(5);
            label.style.fontSize = '0.7rem';
            label.style.marginTop = '0.3rem';
            label.style.color = '#888';

            // ���� �߰�
            bar.title = `${date}: ${hours.toFixed(1)}�ð�`;

            barContainer.appendChild(bar);
            barContainer.appendChild(label);
            chart.appendChild(barContainer);
        });
    }
};
