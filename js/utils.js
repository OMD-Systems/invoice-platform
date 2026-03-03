// ============================================================
// OMD Finance Platform — Shared Utilities
// utils.js — Centralized security & formatting functions
// ============================================================

/* ── Global Toast ── */
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fury-toast-container';
        document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'fury-toast fury-toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(function () {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 4000);
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
};
