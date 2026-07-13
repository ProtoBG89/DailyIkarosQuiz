(function () {
    let savedPassword = localStorage.getItem('team_quiz_pw') || '';
    let fadeObserver = null;

    function initThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('quiz_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (toggle) toggle.checked = savedTheme === 'dark';

        toggle?.addEventListener('change', () => {
            const theme = toggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('quiz_theme', theme);
        });
    }

    function initFadeInObserver() {
        if (fadeObserver) fadeObserver.disconnect();

        fadeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.fade-in:not(.is-visible)').forEach(el => {
            fadeObserver.observe(el);
        });
    }

    function refreshFadeIn() {
        document.querySelectorAll('#quiz-section .fade-in').forEach(el => {
            el.classList.remove('is-visible');
        });
        requestAnimationFrame(initFadeInObserver);
    }

    async function loadCurrentQuestion() {
        if (!savedPassword) {
            document.getElementById('login-section').classList.remove('hidden');
            document.getElementById('quiz-section').classList.add('hidden');
            return;
        }

        try {
            const response = await fetch('/api/submit', {
                headers: { 'x-quiz-password': savedPassword }
            });
            const data = await response.json();

            if (response.ok) {
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('quiz-section').classList.remove('hidden');
                document.getElementById('quiz-title').innerText = data.title;
                document.getElementById('quiz-question').innerHTML = data.question;

                QuizLogic.updateHighscores(data.scores || {});

                if (data.solution) {
                    QuizLogic.init(data.solution);
                } else {
                    QuizLogic.reset();
                }

                refreshFadeIn();
            } else {
                if (response.status === 400 || response.status === 500) {
                    QuizLogic.triggerHackingAlarm();
                }
                localStorage.removeItem('team_quiz_pw');
                savedPassword = '';
                document.getElementById('login-error').innerText = data.message;
                document.getElementById('login-section').classList.remove('hidden');
                document.getElementById('quiz-section').classList.add('hidden');
            }
        } catch (error) {
            document.getElementById('quiz-title').innerText = '🛑 Verbindungsfehler';
            document.getElementById('quiz-question').innerText = 'Es konnte keine sichere Verbindung zur IKAROS-API hergestellt werden.';
        }
    }

    function savePassword() {
        const inputPw = document.getElementById('team-password').value;
        if (!inputPw.trim()) return;
        savedPassword = inputPw;
        localStorage.setItem('team_quiz_pw', inputPw);
        loadCurrentQuestion();
    }

    async function submitAnswer() {
        const selectedRadio = document.querySelector('input[name="colleague"]:checked');
        const name = selectedRadio ? selectedRadio.value : '';
        const answer = CodeEditor.getValue();
        const resultMsg = document.getElementById('result-message');
        const submitBtn = document.getElementById('submit-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.spinner');

        if (!name) {
            resultMsg.innerText = 'Bitte wähle zuerst aus, wer das Quiz bearbeitet.';
            resultMsg.className = 'status-msg error';
            return;
        }

        if (!answer) {
            resultMsg.innerText = 'Bitte trage zuerst deine Lösung ein.';
            resultMsg.className = 'status-msg error';
            return;
        }

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        resultMsg.innerText = 'Prüfe Antwort...';
        resultMsg.className = 'status-msg processing';

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-quiz-password': savedPassword
                },
                body: JSON.stringify({ name, answer })
            });

            const data = await response.json();

            if (response.ok) {
                if (/hacking/i.test(data.message || '')) {
                    QuizLogic.triggerHackingAlarm();
                }
                resultMsg.innerText = data.message;
                resultMsg.className = 'status-msg success';
                CodeEditor.clear();
                setTimeout(loadCurrentQuestion, 1500);
            } else {
                resultMsg.innerText = data.message;
                resultMsg.className = 'status-msg error';
                if (response.status === 400 || response.status === 500) {
                    QuizLogic.triggerHackingAlarm();
                }
            }
        } catch (error) {
            resultMsg.innerText = 'Fehler bei der Übertragung der Antwort.';
            resultMsg.className = 'status-msg error';
        } finally {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    window.savePassword = savePassword;
    window.submitAnswer = submitAnswer;

    window.MainApp = {
        initFadeInObserver,
        refreshFadeIn,
        loadCurrentQuestion
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initThemeToggle();
            initFadeInObserver();
            loadCurrentQuestion();
        });
    } else {
        initThemeToggle();
        initFadeInObserver();
        loadCurrentQuestion();
    }
})();
