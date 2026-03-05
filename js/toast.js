// ============================================================
// OMD Finance Platform — Toast Notification System
// toast.js — Rich toast notifications with icons and auto-dismiss
// ============================================================

var Toast = (function () {
    'use strict';

    var MAX_TOASTS = 5;
    var ICONS = {
        success: '\u2713',
        error:   '\u2717',
        danger:  '\u2717',
        warning: '\u26A0',
        info:    '\u2139'
    };
    var DURATIONS = {
        success: 3000,
        error:   5000,
        danger:  5000,
        warning: 4000,
        info:    4000
    };

    function getContainer() {
        var container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fury-toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('role', 'status');
            document.body.appendChild(container);
        }
        return container;
    }

    function dismissToast(el) {
        if (!el || el._dismissing) return;
        el._dismissing = true;
        el.classList.add('removing');
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 300);
    }

    function show(message, type, duration) {
        type = type || 'info';
        duration = duration || DURATIONS[type] || 4000;

        var container = getContainer();

        // Limit stack
        while (container.children.length >= MAX_TOASTS) {
            dismissToast(container.firstChild);
        }

        var toast = document.createElement('div');
        toast.className = 'fury-toast fury-toast-' + type;
        if (type === 'error' || type === 'danger') {
            toast.setAttribute('role', 'alert');
        }

        // Icon
        var iconEl = document.createElement('span');
        iconEl.className = 'fury-toast-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.textContent = ICONS[type] || ICONS.info;
        toast.appendChild(iconEl);

        // Content
        var contentEl = document.createElement('span');
        contentEl.className = 'fury-toast-content';
        contentEl.textContent = message;
        toast.appendChild(contentEl);

        // Close button
        var closeEl = document.createElement('button');
        closeEl.className = 'fury-toast-close';
        closeEl.setAttribute('aria-label', 'Dismiss');
        closeEl.textContent = '\u00D7';
        closeEl.onclick = function () { dismissToast(toast); };
        toast.appendChild(closeEl);

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        // Auto-dismiss
        var timer = setTimeout(function () {
            dismissToast(toast);
        }, duration);

        // Pause on hover
        toast.addEventListener('mouseenter', function () {
            clearTimeout(timer);
        });
        toast.addEventListener('mouseleave', function () {
            timer = setTimeout(function () {
                dismissToast(toast);
            }, 1500);
        });

        return toast;
    }

    return {
        show:    show,
        success: function (msg, dur) { return show(msg, 'success', dur); },
        error:   function (msg, dur) { return show(msg, 'error',   dur); },
        warning: function (msg, dur) { return show(msg, 'warning', dur); },
        info:    function (msg, dur) { return show(msg, 'info',    dur); }
    };
})();

// Backward-compatible global function
function showToast(message, type) {
    return Toast.show(message, type);
}
