// ============================================================
// OMD Finance Platform — Shared Utilities
// utils.js — Centralized security & formatting functions
// ============================================================

// showToast() and Toast.* are now in toast.js

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

/* ── Skeleton Loading ── */
var Skeleton = {
    /**
     * Render skeleton placeholder HTML.
     * @param {'table-row'|'card'|'list-item'} type
     * @param {number} count
     * @param {object} [opts] - { cols: number (for table-row) }
     * @returns {string} HTML string
     */
    render: function (type, count, opts) {
        count = count || 3;
        opts = opts || {};
        var html = '';
        var i, j;

        if (type === 'table-row') {
            var cols = opts.cols || 6;
            var widths = ['35%', '20%', '15%', '12%', '10%', '8%', '18%', '14%'];
            for (i = 0; i < count; i++) {
                html += '<tr class="skeleton-table-row">';
                for (j = 0; j < cols; j++) {
                    var w = widths[j % widths.length];
                    html += '<td><div class="skeleton skeleton-cell" style="width:' + w + '"></div></td>';
                }
                html += '</tr>';
            }
        } else if (type === 'card') {
            for (i = 0; i < count; i++) {
                html +=
                    '<div class="skeleton-card">' +
                    '<div class="skeleton skeleton-title"></div>' +
                    '<div class="skeleton skeleton-text"></div>' +
                    '<div class="skeleton skeleton-text-sm"></div>' +
                    '</div>';
            }
        } else if (type === 'list-item') {
            for (i = 0; i < count; i++) {
                html +=
                    '<div class="skeleton-list-item">' +
                    '<div class="skeleton skeleton-avatar"></div>' +
                    '<div style="flex:1">' +
                    '<div class="skeleton skeleton-text" style="width:' + (50 + (i * 7) % 30) + '%"></div>' +
                    '<div class="skeleton skeleton-text-sm" style="width:' + (30 + (i * 11) % 25) + '%"></div>' +
                    '</div>' +
                    '</div>';
            }
        }

        return html;
    }
};
