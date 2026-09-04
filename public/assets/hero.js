(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = document.getElementById('hero-title');
    if (!el) return;

    const word = 'Byte';
    const chars = word.split('');
    const duration = 1200;
    const lockInterval = duration / chars.length;

    el.textContent = '';
    el.style.visibility = 'visible';

    const spans = chars.map((ch, i) => {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = Math.random() > 0.5 ? '1' : '0';
        span.dataset.final = ch;
        span.dataset.index = i;
        el.appendChild(span);
        return span;
    });

    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;

        spans.forEach((span, i) => {
            const lockTime = lockInterval * (i + 1);
            if (elapsed >= lockTime) {
                span.textContent = span.dataset.final;
                span.style.opacity = '1';
            } else {
                span.textContent = Math.random() > 0.5 ? '1' : '0';
                span.style.opacity = '0.6';
            }
        });

        if (elapsed < duration) {
            requestAnimationFrame(tick);
        } else {
            spans.forEach(span => {
                span.textContent = span.dataset.final;
                span.style.opacity = '1';
            });
        }
    }

    requestAnimationFrame(tick);
})();
