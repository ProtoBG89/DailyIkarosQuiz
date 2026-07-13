(function () {
    let expectedSolution = '';

    function getLevenshteinDistance(a, b) {
        const m = a.length;
        const n = b.length;
        const matrix = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) matrix[i][0] = i;
        for (let j = 0; j <= n; j++) matrix[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[m][n];
    }

    function calculateScore(input, expected) {
        if (!expected) return 0;
        if (!input) return 0;
        if (input === expected) return 100;

        const distance = getLevenshteinDistance(input, expected);
        const maxLen = Math.max(input.length, expected.length);
        return Math.round((1 - distance / maxLen) * 100);
    }

    function getProgressColor(score) {
        if (score >= 100) return '#34c759';
        if (score >= 70) return '#ff9500';
        if (score >= 40) return '#ffcc00';
        return '#ff3b30';
    }

    function updateProgressBar(score) {
        const bar = document.querySelector('.progress-bar');
        const label = document.querySelector('.progress-label');
        if (!bar) return;

        const clamped = Math.max(0, Math.min(100, score));
        bar.style.width = clamped + '%';
        bar.style.backgroundColor = getProgressColor(clamped);
        if (label) label.textContent = clamped + '%';
    }

    function handleInput() {
        const input = window.CodeEditor ? CodeEditor.getValue() : '';
        updateProgressBar(calculateScore(input, expectedSolution));
    }

    function init(solution) {
        expectedSolution = (solution || '').trim();
        updateProgressBar(0);

        const editor = document.getElementById('answer');
        if (editor) {
            editor.removeEventListener('input', handleInput);
            editor.addEventListener('input', handleInput);
        }
    }

    function reset() {
        expectedSolution = '';
        updateProgressBar(0);
    }

    const activeCounters = new Map();

    function animateCounter(element, targetValue, duration = 600) {
        if (!element) return;

        const target = Number(targetValue) || 0;
        const existingFrame = activeCounters.get(element);
        if (existingFrame) cancelAnimationFrame(existingFrame);

        const startValue = Number(element.textContent) || 0;
        if (startValue === target) {
            element.textContent = target;
            return;
        }

        const startTime = performance.now();

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (target - startValue) * eased);
            element.textContent = current;

            if (progress < 1) {
                activeCounters.set(element, requestAnimationFrame(step));
            } else {
                element.textContent = target;
                activeCounters.delete(element);
            }
        }

        activeCounters.set(element, requestAnimationFrame(step));
    }

    function updateHighscores(scores) {
        ['Farhat', 'Silviu', 'Jannik'].forEach(name => {
            const el = document.getElementById('score-' + name);
            const value = scores && scores[name] !== undefined ? scores[name] : 0;
            animateCounter(el, value);
        });
    }

    function handleAvatarClick(event) {
        const avatar = event.currentTarget.querySelector('.avatar-img');
        if (!avatar) return;

        avatar.classList.remove('greet-bounce');
        void avatar.offsetWidth;
        avatar.classList.add('greet-bounce');
    }

    function handleAvatarAnimationEnd(event) {
        if (event.animationName === 'greet-bounce') {
            event.target.classList.remove('greet-bounce');
        }
    }

    function initAvatarInteraction() {
        document.querySelectorAll('.apple-card').forEach(card => {
            card.removeEventListener('click', handleAvatarClick);
            card.addEventListener('click', handleAvatarClick);

            const avatar = card.querySelector('.avatar-img');
            if (avatar) {
                avatar.removeEventListener('animationend', handleAvatarAnimationEnd);
                avatar.addEventListener('animationend', handleAvatarAnimationEnd);
            }
        });
    }

    window.QuizLogic = {
        getLevenshteinDistance,
        calculateScore,
        updateProgressBar,
        animateCounter,
        updateHighscores,
        initAvatarInteraction,
        init,
        reset
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAvatarInteraction);
    } else {
        initAvatarInteraction();
    }
})();
