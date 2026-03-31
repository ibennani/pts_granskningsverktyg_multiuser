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
        if (textarea.closest('.manage-users-plate') || textarea.id === 'manage-users-textarea') {
            return;
        }
        if (!textarea.parentNode) {
            return;
        }
        
        if (!textarea.id) {
            textarea.id = `md-editor-${window.Helpers?.generate_uuid_v4() || Math.random().toString(36).substr(2, 9)}`;
        }

        const existingInstance = instanceMap.get(textarea.id);
        const wasPreviewVisible = existingInstance ? existingInstance.previewVisible : false;
        const wasToolbarVisible = existingInstance ? existingInstance.toolbarVisible : false;

        const wrapper = document.createElement('div');
        wrapper.className = 'markdown-editor-wrapper';

        const toolbar = this.createToolbar(textarea, wasPreviewVisible);
        const previewDiv = document.createElement('div');
        previewDiv.className = 'md-preview markdown-content';

        const label_before = textarea.previousElementSibling;
        const parent = textarea.parentNode;

        parent.insertBefore(wrapper, textarea);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(textarea);
        wrapper.appendChild(previewDiv);

        const toggle_btn = this.createFormatToggleButton(textarea, wrapper, wasToolbarVisible);
        const label_row = document.createElement('div');
        label_row.className = 'markdown-editor-label-row';
        if (label_before && label_before.tagName === 'LABEL') {
            label_row.appendChild(label_before);
        }
        label_row.appendChild(toggle_btn);
        wrapper.insertBefore(label_row, wrapper.firstChild);

        this.applyToolbarVisibility(toolbar, wrapper, toggle_btn, label_row, previewDiv, wasToolbarVisible, wasPreviewVisible);

        instanceMap.set(textarea.id, {
            previewVisible: wasPreviewVisible,
            toolbarVisible: wasToolbarVisible,
            previewDiv: previewDiv,
            toolbar: toolbar,
            toggleBtn: toggle_btn,
            labelRow: label_row,
            debouncedUpdate: this.debounce(() => this.updatePreview(textarea, previewDiv), 250)
        });

        // Hantera Shift+Tab från textarean – fokusera toggle-knapp eller verktygsfält beroende på state
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                const instance = instanceMap.get(textarea.id);
                if (instance) {
                    if (instance.toolbarVisible) {
                        const firstButton = toolbar.querySelector('.md-toolbar-btn');
                        if (firstButton) firstButton.focus();
                    } else {
                        instance.toggleBtn.focus();
                    }
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
                        button.setAttribute('aria-pressed', instance.previewVisible);
                        this.applyPreviewVisibility(instance.previewDiv, instance.toolbarVisible, instance.previewVisible);
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
        toolbar.addEventListener('focusout', (_e) => {
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

    createFormatToggleButton(textarea, wrapper, is_toolbar_visible) {
        const t = window.Translation?.t || ((k) => k);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'md-format-toggle-btn';
        btn.setAttribute('aria-expanded', String(is_toolbar_visible));
        const label_el = wrapper.previousElementSibling;
        const label_text = (label_el && label_el.tagName === 'LABEL') ? (label_el.textContent?.trim() || t('markdown_toolbar_format_button')) : t('markdown_toolbar_format_button');
        const state_text = is_toolbar_visible ? t('markdown_toolbar_toolbar_visible') : t('markdown_toolbar_toolbar_hidden');
        btn.setAttribute('aria-label', `${label_text}. ${state_text}`);
        btn.appendChild(document.createTextNode(t('markdown_toolbar_format_button')));
        const icon = document.createElement('span');
        icon.className = 'md-format-toggle-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/></svg>';
        btn.appendChild(icon);
        btn.addEventListener('click', () => {
            const instance = instanceMap.get(textarea.id);
            if (!instance) return;
            instance.toolbarVisible = !instance.toolbarVisible;
            this.applyToolbarVisibility(instance.toolbar, wrapper, instance.toggleBtn, instance.labelRow, instance.previewDiv, instance.toolbarVisible, instance.previewVisible);
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                const instance = instanceMap.get(textarea.id);
                if (instance) {
                    e.preventDefault();
                    if (instance.toolbarVisible) {
                        const firstButton = instance.toolbar.querySelector('.md-toolbar-btn');
                        if (firstButton) firstButton.focus();
                    } else {
                        textarea.focus();
                    }
                }
            }
        });
        return btn;
    },

    applyToolbarVisibility(toolbar, wrapper, toggle_btn, label_row, preview_div, toolbar_visible, preview_visible) {
        const t = window.Translation?.t || ((k) => k);
        const label_el = label_row?.querySelector?.('label');
        const label_text = label_el?.textContent?.trim() || t('markdown_toolbar_format_button');
        const state_text = toolbar_visible ? t('markdown_toolbar_toolbar_visible') : t('markdown_toolbar_toolbar_hidden');
        toggle_btn.setAttribute('aria-expanded', String(toolbar_visible));
        toggle_btn.setAttribute('aria-label', `${label_text}. ${state_text}`);
        if (toolbar_visible) {
            toolbar.classList.remove('md-toolbar-collapsed');
            toolbar.removeAttribute('aria-hidden');
            toolbar.querySelectorAll('.md-toolbar-btn').forEach((b, idx) => {
                b.setAttribute('tabindex', idx === 0 ? '0' : '-1');
            });
            wrapper.classList.remove('md-toolbar-collapsed');
        } else {
            toolbar.classList.add('md-toolbar-collapsed');
            toolbar.setAttribute('aria-hidden', 'true');
            toolbar.querySelectorAll('.md-toolbar-btn').forEach((b) => {
                b.setAttribute('tabindex', '-1');
            });
            wrapper.classList.add('md-toolbar-collapsed');
        }
        this.applyPreviewVisibility(preview_div, toolbar_visible, preview_visible);
    },

    applyPreviewVisibility(preview_div, toolbar_visible, preview_visible) {
        const should_collapse = !toolbar_visible || !preview_visible;
        if (should_collapse) {
            preview_div.classList.add('md-preview-collapsed');
            preview_div.setAttribute('aria-hidden', 'true');
        } else {
            preview_div.classList.remove('md-preview-collapsed');
            preview_div.removeAttribute('aria-hidden');
        }
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
                const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
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
        
        // Automatiskt detektera och konvertera kod-liknande text till kodblock för att bevara radbrytningar
        // Detekterar text som innehåller HTML-taggar på separata rader men inte redan är i ett kodblock
        // Matchar HTML-taggar som börjar med < följt av bokstäver (t.ex. <Table>, <caption>, <TR>, etc.)
        const htmlTagPattern = /^<[A-Za-z][A-Za-z0-9]*[^>]*>/;
        
        // Dela upp texten i delar baserat på befintliga kodblock
        const codeBlockRegex = /```[\s\S]*?```/g;
        const parts = [];
        let lastIndex = 0;
        let match;
        
        // Hitta alla befintliga kodblock och spara dem
        while ((match = codeBlockRegex.exec(markdownText)) !== null) {
            // Lägg till texten före kodblocket
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: markdownText.substring(lastIndex, match.index) });
            }
            // Lägg till kodblocket
            parts.push({ type: 'codeblock', content: match[0] });
            lastIndex = match.index + match[0].length;
        }
        
        // Lägg till eventuell återstående text efter sista kodblocket
        if (lastIndex < markdownText.length) {
            parts.push({ type: 'text', content: markdownText.substring(lastIndex) });
        }
        
        // Om inga kodblock hittades, behandla hela texten som text
        if (parts.length === 0) {
            parts.push({ type: 'text', content: markdownText });
        }
        
        // Bearbeta varje textdel för att detektera kod-liknande innehåll
        const processedParts = [];
        for (const part of parts) {
            if (part.type === 'codeblock') {
                // Behåll kodblock som de är
                processedParts.push(part.content);
            } else {
                // Bearbeta textdelen för att hitta kod-liknande innehåll
                const lines = part.content.split('\n');
                let codeLikeBuffer = [];
                const processedLines = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmedLine = line.trim();
                    
                    // Kontrollera om raden innehåller HTML-taggar (börjar med < och följs av bokstäver)
                    // Matchar både <Table> och <caption> etc.
                    if (trimmedLine && htmlTagPattern.test(trimmedLine)) {
                        codeLikeBuffer.push(line);
                    } else if (trimmedLine === '' && codeLikeBuffer.length > 0) {
                        // Om raden är tom men vi har en buffer, behåll bufferten (tomma rader kan vara del av kodstrukturen)
                        codeLikeBuffer.push(line);
                    } else {
                        // Om vi har en buffer med kod-liknande text, konvertera den till kodblock
                        if (codeLikeBuffer.length >= 2) {
                            processedLines.push('```');
                            processedLines.push(...codeLikeBuffer);
                            processedLines.push('```');
                            codeLikeBuffer = [];
                        } else if (codeLikeBuffer.length > 0) {
                            // Lägg till bufferten som vanlig text om den inte är tillräckligt lång
                            processedLines.push(...codeLikeBuffer);
                            codeLikeBuffer = [];
                        }
                        processedLines.push(line);
                    }
                }
                
                // Hantera eventuell kvarvarande buffer
                if (codeLikeBuffer.length >= 2) {
                    processedLines.push('```');
                    processedLines.push(...codeLikeBuffer);
                    processedLines.push('```');
                } else if (codeLikeBuffer.length > 0) {
                    processedLines.push(...codeLikeBuffer);
                }
                
                processedParts.push(processedLines.join('\n'));
            }
        }
        
        markdownText = processedParts.join('');
        
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
