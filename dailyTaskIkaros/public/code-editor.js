(function () {
    const EDITOR_ID = 'answer';
    const HIGHLIGHT_ID = 'answer-highlight';
    const LANGUAGE = 'javascript';

    let editor = null;
    let highlight = null;

    function saveCaretOffset(container) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !container.contains(selection.anchorNode)) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(container);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }

    function restoreCaretOffset(container, offset) {
        if (offset === null) return;

        const selection = window.getSelection();
        const range = document.createRange();
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        let currentNode = walker.nextNode();

        while (currentNode) {
            const nextCount = charCount + currentNode.length;
            if (offset <= nextCount) {
                range.setStart(currentNode, offset - charCount);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            charCount = nextCount;
            currentNode = walker.nextNode();
        }

        range.selectNodeContents(container);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function updateHighlight() {
        const code = editor.textContent || '';
        const caretOffset = saveCaretOffset(editor);

        highlight.innerHTML = Prism.highlight(
            code,
            Prism.languages[LANGUAGE],
            LANGUAGE
        );

        restoreCaretOffset(editor, caretOffset);
    }

    function sanitizeEditorContent() {
        if (editor.childNodes.length === 1 && editor.firstChild.nodeType === Node.TEXT_NODE) {
            return;
        }
        const caretOffset = saveCaretOffset(editor);
        editor.textContent = editor.textContent;
        restoreCaretOffset(editor, caretOffset);
    }

    function handleInput() {
        sanitizeEditorContent();
        updateHighlight();
    }

    function handlePaste(event) {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    function initCodeEditor() {
        editor = document.getElementById(EDITOR_ID);
        highlight = document.getElementById(HIGHLIGHT_ID);

        if (!editor || !highlight || typeof Prism === 'undefined') return;

        editor.addEventListener('input', handleInput);
        editor.addEventListener('paste', handlePaste);

        updateHighlight();
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
