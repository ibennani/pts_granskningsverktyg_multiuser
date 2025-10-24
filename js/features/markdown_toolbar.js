// js/features/markdown_toolbar.js

import { marked } from '../utils/markdown.js';

(function () { // IIFE för att undvika globala konflikter
    'use-strict';

    window.MarkdownToolbar = window.MarkdownToolbar || {};

    const CSS_PATH = './css/features/markdown_toolbar.css';
    const DEBOUNCE_DELAY_MS = 250;
    let initialized = false;
    let observer = null;
    
    const instanceMap = new Map();

    /**
     * Huvudfunktion för att initiera modulen.
     */
    function init() {
        if (initialized) {
            if (window.ConsoleManager) {
            window.ConsoleManager.warn("MarkdownToolbar is already initialized.");
        }
            return;
        }

        if (window.Helpers && window.Helpers.load_css) {
            window.Helpers.load_css(CSS_PATH).catch(err => {
                if (window.ConsoleManager) {
                    window.ConsoleManager.error(err);
                }
            });
        }

        document.querySelectorAll('textarea').forEach(processTextarea);

        observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('textarea')) {
                                processTextarea(node);
                            }
                            node.querySelectorAll('textarea').forEach(processTextarea);
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        initialized = true;
        if (window.ConsoleManager) {
            window.ConsoleManager.log("MarkdownToolbar initialized and observing for new textareas.");
        }
    }

    /**
     * Bearbetar en enskild textarea.
     */
    function processTextarea(textarea) {
        if (textarea.closest('.markdown-editor-wrapper')) {
            return;
        }
        
        // Check if focus protection is active - if so, delay processing
        if (window.focusProtectionActive || window.customFocusApplied) {
            if (window.ConsoleManager) {
                window.ConsoleManager.log('%c[FOCUS DEBUG] Markdown toolbar delaying processing due to focus protection', 'color: #FF6600; font-weight: bold;');
            }
            setTimeout(() => processTextarea(textarea), 500);
            return;
        }
        
        if (!textarea.id) {
            textarea.id = `md-editor-${window.Helpers.generate_uuid_v4()}`;
        }

        const existingInstance = instanceMap.get(textarea.id);
        const wasPreviewVisible = existingInstance ? existingInstance.previewVisible : false;

        const wrapper = document.createElement('div');
        wrapper.className = 'markdown-editor-wrapper';

        const toolbar = createToolbar(textarea, wasPreviewVisible);
        const previewDiv = document.createElement('div');
        previewDiv.className = 'md-preview markdown-content';
        previewDiv.style.display = wasPreviewVisible ? 'block' : 'none';

        textarea.parentNode.insertBefore(wrapper, textarea);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(textarea);
        wrapper.appendChild(previewDiv);

        instanceMap.set(textarea.id, {
            previewVisible: wasPreviewVisible,
            previewDiv: previewDiv,
            debouncedUpdate: debounce(() => updatePreview(textarea, previewDiv), DEBOUNCE_DELAY_MS)
        });

        textarea.addEventListener('input', () => {
            const instance = instanceMap.get(textarea.id);
            if (instance && instance.previewVisible) {
                instance.debouncedUpdate();
            }
        });

        if (wasPreviewVisible) {
            updatePreview(textarea, previewDiv);
        }
    }

    /**
     * Skapar verktygsraden.
     */
    function createToolbar(textarea, isPreviewInitiallyVisible) {
        const t = window.Translation.t;
        const toolbar = document.createElement('div');
        toolbar.className = 'md-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-controls', textarea.id);

        const buttons = [
            { format: 'bold', icon: 'B', symbol: '**', ariaLabelKey: 'markdown_toolbar_bold' },
            { format: 'italic', icon: 'I', symbol: '*', ariaLabelKey: 'markdown_toolbar_italic' },
            { format: 'code', icon: '</>', symbol: '`', ariaLabelKey: 'markdown_toolbar_code' },
            { type: 'separator' },
            { format: 'heading', icon: 'H', symbol: '##', ariaLabelKey: 'markdown_toolbar_heading' },
            { format: 'ul', icon: '•', symbol: '- ', ariaLabelKey: 'markdown_toolbar_bullet_list' },
            { format: 'ol', icon: '1.', symbol: '1. ', ariaLabelKey: 'markdown_toolbar_numbered_list' },
            { format: 'link', icon: '🔗', symbol: '[]()', ariaLabelKey: 'markdown_toolbar_link' },
            { type: 'spacer' },
            { format: 'preview', icon: '👁', symbol: 'preview', ariaLabelKey: 'markdown_toolbar_preview' }
        ];

        buttons.forEach(btnConfig => {
            if (btnConfig.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'md-toolbar-separator';
                separator.setAttribute('aria-hidden', 'true');
                separator.textContent = '|';
                toolbar.appendChild(separator);
                return;
            }
            if (btnConfig.type === 'spacer') {
                const spacer = document.createElement('div');
                spacer.style.flexGrow = '1';
                toolbar.appendChild(spacer);
                return;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'md-toolbar-btn';
            
            // Lägg till aria-label från översättningar
            if (btnConfig.ariaLabelKey && window.Translation && window.Translation.t) {
                button.setAttribute('aria-label', window.Translation.t(btnConfig.ariaLabelKey));
            }
            
            const icon_element = document.createElement('span');
            icon_element.className = 'md-toolbar-icon';
            icon_element.textContent = btnConfig.icon;
            icon_element.setAttribute('aria-hidden', 'true');
            button.appendChild(icon_element);

            if (btnConfig.format === 'preview') {
                button.setAttribute('aria-pressed', String(isPreviewInitiallyVisible));
                button.addEventListener('click', () => {
                    const instance = instanceMap.get(textarea.id);
                    if (instance) {
                        instance.previewVisible = !instance.previewVisible;
                        instance.previewDiv.style.display = instance.previewVisible ? 'block' : 'none';
                        button.setAttribute('aria-pressed', instance.previewVisible);
                        if (instance.previewVisible) {
                            updatePreview(textarea, instance.previewDiv);
                        }
                    }
                });
            } else {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    applyFormat(textarea, btnConfig.format);
                });
            }
            toolbar.appendChild(button);
        });
        return toolbar;
    }

    /**
     * Applicerar eller tar bort Markdown-formatering på den markerade texten.
     * @param {HTMLTextAreaElement} textarea - Mål-textrutan.
     * @param {string} format - Vilken formatering som ska appliceras.
     */
    function applyFormat(textarea, format) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        const linePrefixFormats = {
            'heading': { prefix: '## ', regex: /^\s*##\s+/ },
            'ul': { prefix: '- ', regex: /^\s*([*+-])\s+/ },
            'ol': { prefix: '1. ', regex: /^\s*([0-9]+)\.\s+/ }
        };

        const wrapperFormats = {
            'bold': { wrapper: '**' },
            'italic': { wrapper: '*' },
            'code': { wrapper: '`' },
            'link': { wrapper: '[', suffix: '](url)' }
        };

        if (linePrefixFormats[format]) {
            // Logik för format som appliceras i början av varje rad (listor, rubriker)
            const lines = selectedText.split('\n');
            const nonEmptyLines = lines.filter(line => line.trim() !== '');
            if (nonEmptyLines.length === 0 && start === end) {
                // Om ingen text är markerad, applicera på hela raden
                let lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
                let lineEnd = textarea.value.indexOf('\n', end);
                if (lineEnd === -1) lineEnd = textarea.value.length;
                
                const lineText = textarea.value.substring(lineStart, lineEnd);
                const formatInfo = linePrefixFormats[format];
                
                if (formatInfo.regex.test(lineText)) {
                    // Ta bort formatering
                    const replacement = lineText.replace(formatInfo.regex, '');
                    textarea.setRangeText(replacement, lineStart, lineEnd, 'end');
                } else {
                    // Lägg till formatering
                    let strippedLine = lineText;
                     Object.values(linePrefixFormats).forEach(info => {
                        strippedLine = strippedLine.replace(info.regex, '');
                    });
                    const replacement = `${formatInfo.prefix}${strippedLine}`;
                    textarea.setRangeText(replacement, lineStart, lineEnd, 'end');
                }
            } else {
                 // Samma logik som tidigare för markerad text
                const formatInfo = linePrefixFormats[format];
                const isAlreadyFormatted = nonEmptyLines.every(line => formatInfo.regex.test(line));
                let replacement;

                if (isAlreadyFormatted) {
                    replacement = lines.map(line => line.replace(formatInfo.regex, '')).join('\n');
                } else {
                    let counter = 1;
                    replacement = lines.map(line => {
                        if (line.trim() === '') return line;
                        let strippedLine = line;
                        Object.values(linePrefixFormats).forEach(info => {
                            strippedLine = strippedLine.replace(info.regex, '');
                        });
                        
                        if (format === 'ol') return `${counter++}. ${strippedLine}`;
                        return `${formatInfo.prefix}${strippedLine}`;
                    }).join('\n');
                }
                textarea.setRangeText(replacement, start, end, 'select');
            }

        } else if (wrapperFormats[format]) {
            // Logik för format som omsluter text (fet, kursiv, etc.)
            const formatInfo = wrapperFormats[format];
            const wrapper = formatInfo.wrapper;
            
            const textBefore = textarea.value.substring(start - wrapper.length, start);
            const textAfter = textarea.value.substring(end, end + wrapper.length);

            // FALL 1: Texten är redan omsluten (t.ex. användaren markerade 'ord' i '**ord**')
            if (textBefore === wrapper && textAfter === wrapper) {
                textarea.setRangeText(selectedText, start - wrapper.length, end + wrapper.length, 'select');
            } 
            // FALL 2: Markeringen INNEHÅLLER omslutningen (t.ex. användaren markerade '**ord**')
            else if (selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper)) {
                const unwrappedText = selectedText.substring(wrapper.length, selectedText.length - wrapper.length);
                textarea.setRangeText(unwrappedText, start, end, 'select');
            }
            // FALL 2c: Markeringen innehåller dubbel-omslutning (t.ex. användaren markerade '****ord****')
            else if (selectedText.startsWith(wrapper + wrapper) && selectedText.endsWith(wrapper + wrapper)) {
                const unwrappedText = selectedText.substring(wrapper.length * 2, selectedText.length - wrapper.length * 2);
                textarea.setRangeText(unwrappedText, start, end, 'select');
            } 
            // FALL 2b: Kontrollera om texten redan är omsluten i en bredare kontext
            else {
                // Kontrollera om texten redan är formaterad genom att titta på en bredare kontext
                const contextStart = Math.max(0, start - wrapper.length);
                const contextEnd = Math.min(textarea.value.length, end + wrapper.length);
                const contextText = textarea.value.substring(contextStart, contextEnd);
                const contextBefore = textarea.value.substring(contextStart, start);
                const contextAfter = textarea.value.substring(end, contextEnd);
                
                // Om kontexten visar att texten redan är omsluten, ta bort formateringen
                if (contextBefore.endsWith(wrapper) && contextAfter.startsWith(wrapper)) {
                    // Ta bort wrappers från kontexten
                    const unwrappedContext = contextText.substring(wrapper.length, contextText.length - wrapper.length);
                    textarea.setRangeText(unwrappedContext, contextStart, contextEnd, 'select');
                    return; // Avsluta här för detta specialfall
                }
                
                // Kontrollera om texten redan är dubbel-omsluten i kontexten
                const doubleContextStart = Math.max(0, start - wrapper.length * 2);
                const doubleContextEnd = Math.min(textarea.value.length, end + wrapper.length * 2);
                const doubleContextText = textarea.value.substring(doubleContextStart, doubleContextEnd);
                const doubleContextBefore = textarea.value.substring(doubleContextStart, start);
                const doubleContextAfter = textarea.value.substring(end, doubleContextEnd);
                
                if (doubleContextBefore.endsWith(wrapper + wrapper) && doubleContextAfter.startsWith(wrapper + wrapper)) {
                    // Ta bort dubbel-wrappers från kontexten
                    const unwrappedContext = doubleContextText.substring(wrapper.length * 2, doubleContextText.length - wrapper.length * 2);
                    textarea.setRangeText(unwrappedContext, doubleContextStart, doubleContextEnd, 'select');
                    return; // Avsluta här för detta specialfall
                }
                
                // FALL 3: Texten är omarkerad och ska formateras
                const leadingSpace = selectedText.match(/^\s*/)?.[0] || '';
                const trailingSpace = selectedText.match(/\s*$/)?.[0] || '';
                const trimmedText = selectedText.trim();
                
                if (trimmedText === '' && format !== 'link') {
                    // Om ingen text är markerad, infoga bara tecknen och placera markören i mitten
                    textarea.setRangeText(`${wrapper}${wrapper}`, start, end, 'end');
                    textarea.setSelectionRange(start + wrapper.length, start + wrapper.length);
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    return; // Avsluta här för detta specialfall
                }
                
                const formattedText = `${wrapper}${trimmedText}${formatInfo.suffix || wrapper}`;
                const replacement = `${leadingSpace}${formattedText}${trailingSpace}`;
                textarea.setRangeText(replacement, start, end, 'select');
            }
        }
        
        // Only focus if not in focus protection mode
        if (!window.focusProtectionActive && !window.customFocusApplied) {
            textarea.focus();
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }


    /**
     * Uppdaterar förhandsgranskningens innehåll.
     */
    function updatePreview(textarea, previewDiv) {
        if (typeof marked === 'undefined') {
            previewDiv.innerHTML = '<p style="color: red;">Error: marked.js library not loaded.</p>';
            return;
        }
        let markdownText = textarea.value;
        const listEndRegex = /(^(\s*(\*|\-|\+)\s|[0-9]+\.\s).*\n)(?!\s*(\*|\-|\+)\s|[0-9]+\.\s|\s*$)/gm;
        markdownText = markdownText.replace(listEndRegex, '$1\n');
        
        const renderer = new marked.Renderer();
        const originalLinkRenderer = renderer.link.bind(renderer);
        renderer.link = (href, title, text) => {
            const link = originalLinkRenderer(href, title, text);
            return link.replace('<a', '<a target="_blank" rel="noopener noreferrer"');
        };

        // MODIFIED: This is the final, correct fix for escaping HTML.
        if (window.Helpers && window.Helpers.escape_html) {
            renderer.html = (html_token) => {
                const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                    ? html_token.text
                    : String(html_token || '');
                
                return window.Helpers.escape_html(text_to_escape);
            };
        }

        try {
            const parsed_markdown = marked.parse(markdownText, { breaks: true, gfm: true, renderer: renderer });
            // Use safe HTML sanitization for markdown preview
            if (window.Helpers && window.Helpers.sanitize_html) {
                previewDiv.innerHTML = window.Helpers.sanitize_html(parsed_markdown);
            } else {
                previewDiv.textContent = markdownText;
            }
        } catch (error) {
            if (window.ConsoleManager) {
                window.ConsoleManager.error("Error parsing Markdown:", error);
            }
            previewDiv.textContent = "Error rendering preview. Check console for details.";
        }
    }
    
    /**
     * Debounce-funktion.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    // Exponera init-funktionen globalt
    window.MarkdownToolbar.init = init;

})();
