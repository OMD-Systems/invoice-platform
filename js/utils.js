// ============================================================
// OMD Finance Platform — Shared Utilities
// utils.js — Centralized security & formatting functions
// ============================================================

/* ── Global Toast ── */
var MAX_TOASTS = 5;
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fury-toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'status');
        document.body.appendChild(container);
    }
    // Limit toast stack — remove oldest if exceeding max
    while (container.children.length >= MAX_TOASTS) {
        container.removeChild(container.firstChild);
    }
    var toast = document.createElement('div');
    toast.className = 'fury-toast fury-toast-' + type;
    if (type === 'error' || type === 'danger') {
        toast.setAttribute('role', 'alert');
    }
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    var dismissMs = type === 'error' ? 6000 : 4000;
    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(function () {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, dismissMs);
}

const Utils = {

    /**
     * Escape HTML special characters to prevent XSS.
     * @param {string} str - Raw string
     * @returns {string} Escaped string safe for innerHTML
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Escape string for use inside HTML attribute values.
     * @param {string} str - Raw string
     * @returns {string} Escaped string safe for attribute values
     */
    escapeAttr(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Format a number as USD currency string.
     * @param {number} amount
     * @returns {string} Formatted currency string (e.g. "$1,234.56")
     */
    formatCurrency(amount) {
        if (amount == null || isNaN(amount)) return '$0.00';
        return '$' + Number(amount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    },

    /**
     * Sanitize a string for safe use in CSS selectors.
     * @param {string} str
     * @returns {string}
     */
    sanitizeForSelector(str) {
        if (!str) return '';
        return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
    },

    /**
     * Validate email format.
     * @param {string} email
     * @returns {boolean}
     */
    isValidEmail(email) {
        if (!email) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    },

    /**
     * Validate that a value is a positive number.
     * @param {*} value
     * @returns {boolean}
     */
    isPositiveNumber(value) {
        var num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },

    /**
     * Format a date string (ISO or Date object) to locale display.
     * @param {string|Date} date
     * @param {object} [opts] - Intl.DateTimeFormat options
     * @returns {string}
     */
    formatDate(date, opts) {
        if (!date) return '';
        try {
            var d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return '';
            var defaults = { year: 'numeric', month: 'short', day: 'numeric' };
            return d.toLocaleDateString('en-US', opts || defaults);
        } catch (e) {
            return '';
        }
    },

    /**
     * Truncate a string to maxLen, appending ellipsis if truncated.
     * @param {string} str
     * @param {number} maxLen
     * @returns {string}
     */
    truncate(str, maxLen) {
        if (!str) return '';
        var s = String(str);
        if (s.length <= maxLen) return s;
        return s.substring(0, maxLen) + '\u2026';
    },

    /**
     * Debounce a function call.
     * @param {function} fn
     * @param {number} ms - Delay in milliseconds
     * @returns {function}
     */
    debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments;
            var ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    },

    /**
     * Deep clone a plain object/array (JSON-safe only).
     * @param {*} obj
     * @returns {*}
     */
    deepClone(obj) {
        if (obj == null || typeof obj !== 'object') return obj;
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            return obj;
        }
    },
};
