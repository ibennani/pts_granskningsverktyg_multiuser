export function create_element(tag_name, options = {}) {
    const element = document.createElement(tag_name);
    if (options.class_name) {
        const classes = Array.isArray(options.class_name) ? options.class_name : options.class_name.split(' ');
        classes.filter(Boolean).forEach(c => element.classList.add(c));
    }
    if (options.id) element.id = options.id;
    if (options.hasOwnProperty('value')) element.value = options.value;
    if (options.text_content) element.textContent = options.text_content;
    if (options.html_content) element.innerHTML = options.html_content;
    if (options.attributes) {
        for (const attr in options.attributes) {
            element.setAttribute(attr, options.attributes[attr]);
        }
    }
    if (options.event_listeners) {
        for (const type in options.event_listeners) {
            element.addEventListener(type, options.event_listeners[type]);
        }
    }
    if (options.children) {
        options.children.forEach(child => { if (child) element.appendChild(child); });
    }
    if (options.style) {
        if (typeof options.style === 'object' && options.style !== null) {
            Object.assign(element.style, options.style);
        } else if (typeof options.style === 'string') {
            element.style.cssText = options.style;
        }
    }
    return element;
}

