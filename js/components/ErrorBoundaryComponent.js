export const ErrorBoundaryComponent = {
    root: null,
    deps: {},
    retry_callback: null,
    error_info: null,
    css_loaded: false,
    
    async init({ root, deps = {}, options = {} }) {
        if (!root) throw new Error('[ErrorBoundaryComponent] Root element is required');
        this.root = root;
        this.deps = deps;
        if (options.retry_callback) {
            this.retry_callback = options.retry_callback;
        }
        
        this.load_css();
        this.clear_error();
    },

    load_css() {
        if (this.css_loaded) return;
        const css_path = 'css/components/error_boundary_component.css';
        
        // Try to use helper if available
        if (this.deps.Helpers && typeof this.deps.Helpers.load_css === 'function') {
            this.deps.Helpers.load_css(css_path).catch(err => console.warn('Failed to load CSS via Helpers:', err));
            this.css_loaded = true;
            return;
        }

        // Fallback
        if (document.querySelector(`link[href="${css_path}"]`)) {
            this.css_loaded = true;
            return;
        }
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = css_path;
        link.type = 'text/css';
        document.head.appendChild(link);
        this.css_loaded = true;
    },

    get_t() {
        if (this.deps.Translation && typeof this.deps.Translation.t === 'function') {
            return this.deps.Translation.t;
        }
        return (key) => `**${key}**`;
    },

    create_error_display(error_data) {
        const t = this.get_t();
        const Helpers = this.deps.Helpers || window.Helpers; // Fallback to window for safety during transition

        const error_container = document.createElement('div');
        error_container.className = 'error-boundary-container';
        error_container.setAttribute('role', 'alert');
        error_container.setAttribute('aria-live', 'polite');

        const error_title = document.createElement('h1');
        error_title.className = 'error-boundary-title';
        error_title.textContent = t('error_boundary_title');
        error_container.appendChild(error_title);

        const user_message = document.createElement('div');
        user_message.className = 'error-boundary-user-message';
        user_message.innerHTML = `
            <p>${t('error_boundary_user_message')}</p>
            <p>${t('error_boundary_suggestions')}</p>
        `;
        error_container.appendChild(user_message);

        const technical_section = document.createElement('details');
        technical_section.className = 'error-boundary-technical';
        
        const technical_summary = document.createElement('summary');
        technical_summary.textContent = t('error_boundary_technical_details');
        technical_section.appendChild(technical_summary);

        const technical_content = document.createElement('div');
        technical_content.className = 'error-boundary-technical-content';
        
        const error_message = document.createElement('p');
        const escape_html = (Helpers && typeof Helpers.escape_html === 'function')
            ? Helpers.escape_html
            : (str) => str;
        error_message.innerHTML = `<strong>${t('error_boundary_error_message')}:</strong> ${escape_html(error_data.message || t('error_boundary_unknown_error'))}`;
        technical_content.appendChild(error_message);

        if (error_data.stack) {
            const stack_trace = document.createElement('details');
            const stack_summary = document.createElement('summary');
            stack_summary.textContent = t('error_boundary_stack_trace');
            stack_trace.appendChild(stack_summary);
            
            const stack_pre = document.createElement('pre');
            stack_pre.className = 'error-boundary-stack';
            stack_pre.textContent = error_data.stack;
            stack_trace.appendChild(stack_pre);
            
            technical_content.appendChild(stack_trace);
        }

        if (error_data.component) {
            const component_info = document.createElement('p');
            component_info.innerHTML = `<strong>${t('error_boundary_component')}:</strong> ${escape_html(error_data.component)}`;
            technical_content.appendChild(component_info);
        }

        const timestamp = document.createElement('p');
        timestamp.innerHTML = `<strong>${t('error_boundary_timestamp')}:</strong> ${new Date().toLocaleString()}`;
        technical_content.appendChild(timestamp);

        technical_section.appendChild(technical_content);
        error_container.appendChild(technical_section);

        const actions_container = document.createElement('div');
        actions_container.className = 'error-boundary-actions';

        if (this.retry_callback && typeof this.retry_callback === 'function') {
            const retry_button = document.createElement('button');
            retry_button.className = 'error-boundary-retry-button';
            retry_button.textContent = t('error_boundary_retry');
            retry_button.addEventListener('click', () => {
                try {
                    this.retry_callback();
                } catch (retry_error) {
                    console.error('[ErrorBoundaryComponent] Retry failed:', retry_error);
                    this.show_error({
                        message: t('error_boundary_retry_failed'),
                        stack: retry_error.stack,
                        component: error_data.component
                    });
                }
            });
            actions_container.appendChild(retry_button);
        }

        const reload_button = document.createElement('button');
        reload_button.className = 'error-boundary-reload-button';
        reload_button.textContent = t('error_boundary_reload_page');
        reload_button.addEventListener('click', () => {
            window.location.reload();
        });
        actions_container.appendChild(reload_button);

        const back_button = document.createElement('button');
        back_button.className = 'error-boundary-back-button';
        back_button.textContent = t('error_boundary_go_back');
        back_button.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.hash = '#upload';
            }
        });
        actions_container.appendChild(back_button);

        error_container.appendChild(actions_container);

        return error_container;
    },

    log_error(error_data) {
        console.group('[ErrorBoundaryComponent] Component Error');
        console.error('Error:', error_data.message);
        console.error('Component:', error_data.component);
        console.error('Stack:', error_data.stack);
        console.error('Timestamp:', new Date().toISOString());
        console.groupEnd();

        if (this.deps.NotificationComponent && this.deps.NotificationComponent.show_global_message) {
            const t = this.get_t();
            this.deps.NotificationComponent.show_global_message(
                t('error_boundary_notification_message'),
                'error'
            );
        }
    },

    show_error(error_data, retry_callback = null) {
        if (!this.root) {
            console.error('[ErrorBoundaryComponent] Container not initialized');
            return;
        }

        if (retry_callback) {
            this.retry_callback = retry_callback;
        }

        this.load_css();
        this.log_error(error_data);

        this.error_info = error_data;
        this.root.innerHTML = '';
        this.root.appendChild(this.create_error_display(error_data));
    },

    clear_error() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.error_info = null;
    },

    is_error_displayed() {
        return this.error_info !== null;
    },

    get_error_info() {
        return this.error_info;
    },

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.error_info = null;
        this.retry_callback = null;
        this.deps = {};
    }
};
