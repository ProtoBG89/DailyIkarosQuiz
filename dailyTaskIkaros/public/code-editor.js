(function () {
    const EDITOR_ID = 'answer';
    const HIGHLIGHT_ID = 'answer-highlight';
    const INNER_ID = 'code-editor-inner';
    const LANGUAGE = 'javascript';

    let editor = null;
    let highlight = null;
    let editorInner = null;

    function updateEmptyState() {
        if (!editorInner) return;
        editorInner.classList.toggle('is-empty', !editor.textContent.length);
    }

    function normalizeEditorContent() {
        const text = editor.textContent.replace(/\u200B/g, '');

        if (editor.childNodes.length !== 1 || editor.firstChild.nodeType !== Node.TEXT_NODE) {
            editor.textContent = text;
        }

        updateEmptyState();
    }

    function updateHighlight() {
        highlight.innerHTML = Prism.highlight(
            editor.textContent || '',
            Prism.languages[LANGUAGE],
            LANGUAGE
        );
        updateEmptyState();
    }

    function handleInput() {
        normalizeEditorContent();
        updateHighlight();
    }

    function handlePaste(event) {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    function handleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.execCommand('insertText', false, '\n');
        }
    }

    function handleFocus() {
        if (!editor.textContent.length) {
            editor.textContent = '';
        }
    }

    function initCodeEditor() {
        editor = document.getElementById(EDITOR_ID);
        highlight = document.getElementById(HIGHLIGHT_ID);
        editorInner = document.getElementById(INNER_ID);

        if (!editor || !highlight || typeof Prism === 'undefined') return;

        editor.addEventListener('input', handleInput);
        editor.addEventListener('paste', handlePaste);
        editor.addEventListener('keydown', handleKeydown);
        editor.addEventListener('focus', handleFocus);

        updateHighlight();
        updateEmptyState();
    }

    window.CodeEditor = {
        getValue() {
            return editor ? editor.textContent.trim() : '';
        },
        clear() {
            if (!editor) return;
            editor.textContent = '';
            updateHighlight();
        },
        init: initCodeEditor
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCodeEditor);
    } else {
        initCodeEditor();
    }
})();
