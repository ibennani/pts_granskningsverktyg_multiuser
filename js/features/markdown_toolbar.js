import { marked } from '../utils/markdown.js';
import "../../css/features/markdown_toolbar.css";

const instanceMap = new Map();
let observer = null;
let initialized = false;

export const MarkdownToolbar = {
    init() {
        if (initialized) {
            if (window.ConsoleManager) {
                window.ConsoleManager.warn("MarkdownToolbar is already initialized.");
            }
            return;
        }

        document.querySelectorAll('textarea').forEach(node => this.processTextarea(node));

        observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('textarea')) {
                                this.processTextarea(node);
                            }
                            node.querySelectorAll('textarea').forEach(n => this.processTextarea(n));
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
    },

    processTextarea(textarea) {
        if (textarea.closest('.markdown-editor-wrapper')) {
            return;
        }
        
        // Check if focus protection is active - if so, delay processing
        if (window.focusProtectionActive || window.customFocusApplied) {
            if (window.ConsoleManager) {
                window.ConsoleManager.log('%c[FOCUS DEBUG] Markdown toolbar delaying processing due to focus protection', 'color: #FF6600; font-weight: bold;');
            }
            setTimeout(() => this.processTextarea(textarea), 500);
            return;
        }
        
        if (!textarea.id) {
            textarea.id = `md-editor-${window.Helpers?.generate_uuid_v4() || Math.random().toString(36).substr(2, 9)}`;
        }

        const existingInstance = instanceMap.get(textarea.id);
        const wasPreviewVisible = existingInstance ? existingInstance.previewVisible : false;

        const wrapper = document.createElement('div');
        wrapper.className = 'markdown-editor-wrapper';

        const toolbar = this.createToolbar(textarea, wasPreviewVisible);
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
            toolbar: toolbar,
            debouncedUpdate: this.debounce(() => this.updatePreview(textarea, previewDiv), 250)
        });

        // Hantera Shift+Tab från textarean för att gå tillbaka till verktygsfältet
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && e.shiftKey) {
                // Hitta första knappen i verktygsfältet och fokusera den
                const firstButton = toolbar.querySelector('.md-toolbar-btn');
                if (firstButton) {
                    e.preventDefault();
                    firstButton.focus();
                }
            }
        });

        textarea.addEventListener('input', () => {
            const instance = instanceMap.get(textarea.id);
            if (instance && instance.previewVisible) {
                instance.debouncedUpdate();
            }
        });

        if (wasPreviewVisible) {
            this.updatePreview(textarea, previewDiv);
        }
    },

    createToolbar(textarea, isPreviewInitiallyVisible) {
        // Using window.Translation as per existing pattern for now, or ensure it's available
        const t = window.Translation?.t || ((k) => k);
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

        const toolbarButtons = [];
        let buttonIndex = 0; // Räkna endast faktiska knappar

        buttons.forEach((btnConfig) => {
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
            
            // Sätt tabindex: första knappen är tabbable, resten är -1
            button.setAttribute('tabindex', buttonIndex === 0 ? '0' : '-1');
            
            // Lägg till aria-label från översättningar
            if (btnConfig.ariaLabelKey) {
                button.setAttribute('aria-label', t(btnConfig.ariaLabelKey));
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
                            this.updatePreview(textarea, instance.previewDiv);
                        }
                    }
                });
            } else {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyFormat(textarea, btnConfig.format);
                });
            }

            // Keyboard navigation för verktygsfältet
            button.addEventListener('keydown', (e) => {
                this.handleToolbarKeydown(e, toolbarButtons, textarea);
            });

            toolbarButtons.push(button);
            toolbar.appendChild(button);
            buttonIndex++; // Öka räknaren efter att knappen lagts till
        });

        // När fokus lämnar verktygsfältet helt, återställ tabindex så första knappen är tabbable nästa gång
        toolbar.addEventListener('focusout', (e) => {
            // Vänta lite för att se om fokus går till en annan knapp i verktygsfältet
            setTimeout(() => {
                if (!toolbar.contains(document.activeElement)) {
                    // Fokus har lämnat verktygsfältet helt, återställ till första knappen
                    if (toolbarButtons.length > 0) {
                        toolbarButtons.forEach((btn, idx) => {
                            btn.setAttribute('tabindex', idx === 0 ? '0' : '-1');
                        });
                    }
                }
            }, 0);
        });

        return toolbar;
    },

    handleToolbarKeydown(e, buttons, textarea) {
        const currentIndex = buttons.indexOf(e.target);
        if (currentIndex === -1) return;

        let handled = false;

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                const nextIndex = this.findNextButtonIndex(buttons, currentIndex, 1);
                if (nextIndex !== -1) {
                    this.focusButton(buttons, nextIndex);
                    handled = true;
                }
                break;

            case 'ArrowLeft':
                e.preventDefault();
                const prevIndex = this.findNextButtonIndex(buttons, currentIndex, -1);
                if (prevIndex !== -1) {
                    this.focusButton(buttons, prevIndex);
                    handled = true;
                }
                break;

            case 'Tab':
                // Om Tab utan Shift, gå till textarean
                if (!e.shiftKey) {
                    e.preventDefault();
                    textarea.focus();
                    handled = true;
                }
                // Om Shift+Tab, låt standardbeteendet hända (gå tillbaka)
                break;

            case 'Home':
                e.preventDefault();
                this.focusButton(buttons, 0);
                handled = true;
                break;

            case 'End':
                e.preventDefault();
                this.focusButton(buttons, buttons.length - 1);
                handled = true;
                break;
        }

        if (handled) {
            e.stopPropagation();
        }
    },

    findNextButtonIndex(buttons, currentIndex, direction) {
        let nextIndex = currentIndex + direction;
        const maxIndex = buttons.length - 1;

        // Wrap-around: om vi går förbi början, gå till slutet
        if (nextIndex < 0) {
            nextIndex = maxIndex;
        }
        // Wrap-around: om vi går förbi slutet, gå till början
        else if (nextIndex > maxIndex) {
            nextIndex = 0;
        }

        // Eftersom vi redan filtrerat bort separatorer och spacer när vi skapade buttons-arrayen,
        // behöver vi inte hoppa över något här. Men vi kontrollerar att knappen finns.
        if (nextIndex >= 0 && nextIndex < buttons.length && buttons[nextIndex]) {
            return nextIndex;
        }

        return -1;
    },

    focusButton(buttons, index) {
        if (index < 0 || index >= buttons.length) return;

        // Ta bort tabindex från alla knappar
        buttons.forEach(btn => btn.setAttribute('tabindex', '-1'));

        // Sätt tabindex="0" på den knapp som ska fokuseras
        buttons[index].setAttribute('tabindex', '0');
        buttons[index].focus();
    },

    applyFormat(textarea, format) {
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

            // FALL 1: Texten är redan omsluten
            if (textBefore === wrapper && textAfter === wrapper) {
                textarea.setRangeText(selectedText, start - wrapper.length, end + wrapper.length, 'select');
            } 
            // FALL 2: Markeringen INNEHÅLLER omslutningen
            else if (selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper)) {
                const unwrappedText = selectedText.substring(wrapper.length, selectedText.length - wrapper.length);
                textarea.setRangeText(unwrappedText, start, end, 'select');
            }
            // FALL 2c: Markeringen innehåller dubbel-omslutning
            else if (selectedText.startsWith(wrapper + wrapper) && selectedText.endsWith(wrapper + wrapper)) {
                const unwrappedText = selectedText.substring(wrapper.length * 2, selectedText.length - wrapper.length * 2);
                textarea.setRangeText(unwrappedText, start, end, 'select');
            } 
            // FALL 2b: Kontrollera om texten redan är omsluten i en bredare kontext
            else {
                const contextStart = Math.max(0, start - wrapper.length);
                const contextEnd = Math.min(textarea.value.length, end + wrapper.length);
                const contextText = textarea.value.substring(contextStart, contextEnd);
                const contextBefore = textarea.value.substring(contextStart, start);
                const contextAfter = textarea.value.substring(end, contextEnd);
                
                if (contextBefore.endsWith(wrapper) && contextAfter.startsWith(wrapper)) {
                    const unwrappedContext = contextText.substring(wrapper.length, contextText.length - wrapper.length);
                    textarea.setRangeText(unwrappedContext, contextStart, contextEnd, 'select');
                    return;
                }
                
                const doubleContextStart = Math.max(0, start - wrapper.length * 2);
                const doubleContextEnd = Math.min(textarea.value.length, end + wrapper.length * 2);
                const doubleContextText = textarea.value.substring(doubleContextStart, doubleContextEnd);
                const doubleContextBefore = textarea.value.substring(doubleContextStart, start);
                const doubleContextAfter = textarea.value.substring(end, doubleContextEnd);
                
                if (doubleContextBefore.endsWith(wrapper + wrapper) && doubleContextAfter.startsWith(wrapper + wrapper)) {
                    const unwrappedContext = doubleContextText.substring(wrapper.length * 2, doubleContextText.length - wrapper.length * 2);
                    textarea.setRangeText(unwrappedContext, doubleContextStart, doubleContextEnd, 'select');
                    return;
                }
                
                // FALL 3: Texten är omarkerad och ska formateras
                const leadingSpace = selectedText.match(/^\s*/)?.[0] || '';
                const trailingSpace = selectedText.match(/\s*$/)?.[0] || '';
                const trimmedText = selectedText.trim();
                
                if (trimmedText === '' && format !== 'link') {
                    textarea.setRangeText(`${wrapper}${wrapper}`, start, end, 'end');
                    textarea.setSelectionRange(start + wrapper.length, start + wrapper.length);
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    return;
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
    },

    updatePreview(textarea, previewDiv) {
        if (typeof marked === 'undefined') {
            const t = window.Translation?.t || ((key) => key);
            const errorMessage = t('markdown_error_library_not_loaded');
            previewDiv.innerHTML = `<p style="color: red;">${window.Helpers?.escape_html(errorMessage) || errorMessage}</p>`;
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
            if (window.Helpers && window.Helpers.sanitize_html) {
                previewDiv.innerHTML = window.Helpers.sanitize_html(parsed_markdown);
            } else {
                previewDiv.textContent = markdownText;
            }
        } catch (error) {
            if (window.ConsoleManager) {
                window.ConsoleManager.error("Error parsing Markdown:", error);
            }
            const t = window.Translation?.t || ((key) => key);
            previewDiv.textContent = t('markdown_error_rendering_preview');
        }
    },

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
};
