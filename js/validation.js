// ============================================================
// OMD Finance Platform — Input Validation
// validation.js — Shared validation & field error display
// ============================================================

const Validation = {

    /**
     * Validate email format (RFC 5322 simplified).
     * @param {string} str
     * @returns {boolean}
     */
    isValidEmail(str) {
        if (!str) return false;
        return /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(str.trim());
    },

    /**
     * Validate IBAN using length check + mod-97 algorithm.
     * @param {string} str
     * @returns {boolean}
     */
    isValidIBAN(str) {
        if (!str) return false;
        var iban = str.replace(/\s+/g, '').toUpperCase();
        if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
        if (iban.length < 15 || iban.length > 34) return false;

        // Move first 4 chars to end
        var rearranged = iban.substring(4) + iban.substring(0, 4);

        // Replace letters with numbers (A=10, B=11, ..., Z=35)
        var numStr = '';
        for (var i = 0; i < rearranged.length; i++) {
            var ch = rearranged.charCodeAt(i);
            if (ch >= 65 && ch <= 90) {
                numStr += (ch - 55).toString();
            } else {
                numStr += rearranged[i];
            }
        }

        // mod 97 on large number (process in chunks to avoid overflow)
        var remainder = 0;
        for (var j = 0; j < numStr.length; j++) {
            remainder = (remainder * 10 + parseInt(numStr[j], 10)) % 97;
        }

        return remainder === 1;
    },

    /**
     * Format IBAN with spaces every 4 characters.
     * @param {string} str
     * @returns {string}
     */
    formatIBAN(str) {
        if (!str) return '';
        var clean = str.replace(/\s+/g, '').toUpperCase();
        return clean.replace(/(.{4})/g, '$1 ').trim();
    },

    /**
     * Mask IBAN showing only last 4 characters.
     * @param {string} str
     * @returns {string} e.g. "****1234"
     */
    maskIBAN(str) {
        if (!str) return '';
        var clean = str.replace(/\s+/g, '');
        if (clean.length <= 4) return clean;
        return '****' + clean.slice(-4);
    },

    /**
     * Validate SWIFT/BIC code (8 or 11 alphanumeric characters).
     * @param {string} str
     * @returns {boolean}
     */
    isValidSWIFT(str) {
        if (!str) return false;
        var code = str.replace(/\s+/g, '').toUpperCase();
        return /^[A-Z0-9]{8}$|^[A-Z0-9]{11}$/.test(code);
    },

    /**
     * Check if number is within inclusive range.
     * @param {number} num
     * @param {number} min
     * @param {number} max
     * @returns {boolean}
     */
    isInRange(num, min, max) {
        var n = parseFloat(num);
        return !isNaN(n) && n >= min && n <= max;
    },

    /**
     * Check if number is non-negative (>= 0).
     * @param {number} num
     * @returns {boolean}
     */
    isNonNegative(num) {
        var n = parseFloat(num);
        return !isNaN(n) && n >= 0;
    },

    /**
     * Check if string length is within limit.
     * @param {string} str
     * @param {number} maxLen
     * @returns {boolean}
     */
    isWithinLength(str, maxLen) {
        if (str == null) return false;
        return String(str).length <= maxLen;
    },

    /**
     * Sanitize filename: remove path traversal and special characters.
     * @param {string} name
     * @returns {string}
     */
    sanitizeFileName(name) {
        if (!name) return '';
        return String(name)
            .replace(/\.\./g, '')
            .replace(/[\/\\:*?"<>|]/g, '')
            .replace(/^\s+|\s+$/g, '')
            .replace(/^\.+/, '');
    },

    /**
     * Validate invoice number: positive integer.
     * @param {*} num
     * @returns {boolean}
     */
    isValidInvoiceNumber(num) {
        var n = parseInt(num, 10);
        return !isNaN(n) && n > 0 && n === parseFloat(num);
    },

    /**
     * Check that string is not empty after trim.
     * @param {string} str
     * @returns {boolean}
     */
    isNotEmpty(str) {
        if (str == null) return false;
        return String(str).trim().length > 0;
    },

    /**
     * Show validation error on a field (red border + message below).
     * @param {HTMLElement} input - The input element
     * @param {string} message - Error message to display
     */
    showFieldError(input, message) {
        if (!input) return;
        input.style.borderColor = '#EF4444';
        var existing = input.parentNode.querySelector('.validation-error');
        if (existing) {
            existing.textContent = message;
            return;
        }
        var el = document.createElement('div');
        el.className = 'validation-error';
        el.style.cssText = 'color:#EF4444;font-size:12px;margin-top:4px;';
        el.textContent = message;
        input.parentNode.appendChild(el);
    },

    /**
     * Clear validation error from a field.
     * @param {HTMLElement} input
     */
    clearFieldError(input) {
        if (!input) return;
        input.style.borderColor = '';
        var err = input.parentNode.querySelector('.validation-error');
        if (err) err.parentNode.removeChild(err);
    },

    /**
     * Clear all validation errors within a container.
     * @param {HTMLElement} container
     */
    clearAllErrors(container) {
        if (!container) return;
        var errors = container.querySelectorAll('.validation-error');
        for (var i = 0; i < errors.length; i++) {
            errors[i].parentNode.removeChild(errors[i]);
        }
        var inputs = container.querySelectorAll('[style*="border-color"]');
        for (var j = 0; j < inputs.length; j++) {
            inputs[j].style.borderColor = '';
        }
    }
};
