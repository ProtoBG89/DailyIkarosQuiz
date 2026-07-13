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

    window.QuizLogic = {
        getLevenshteinDistance,
        calculateScore,
        updateProgressBar,
        init,
        reset
    };
})();
