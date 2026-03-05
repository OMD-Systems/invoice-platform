/* ═══════════════════════════════════════════════════════
   Numbering — Invoice Number Tracking Service
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

function _sanitizeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

const Numbering = {

  /* ── Format a raw number with optional prefix ── */
  formatNumber(prefix, num) {
    var padded = String(num).padStart(3, '0');
    return prefix ? prefix + '-' + padded : padded;
  },

  /* ── Get the next invoice number for an employee (raw int) ── */
  async getNextNumber(employeeId) {
    try {
      var result = await DB.client
        .from('employees')
        .select('next_invoice_number, invoice_prefix')
        .eq('id', employeeId)
        .single();

      if (result.error) {
        console.error('[Numbering] getNextNumber error:', result.error);
        return { number: 1, prefix: '' };
      }

      return {
        number: (result.data && result.data.next_invoice_number) || 1,
        prefix: (result.data && result.data.invoice_prefix) || ''
      };
    } catch (err) {
      console.error('[Numbering] getNextNumber exception:', err);
      return { number: 1, prefix: '' };
    }
  },

  /* ── Get the next formatted invoice number string (convenience) ── */
  async getNextFormattedNumber(employeeId) {
    var info = await this.getNextNumber(employeeId);
    return this.formatNumber(info.prefix, info.number);
  },

  /* ── Increment the invoice number in DB after generation ── */
  async incrementNumber(employeeId) {
    try {
      var info = await this.getNextNumber(employeeId);
      var current = info.number;

      // Optimistic concurrency: only update if the number hasn't changed
      var result = await DB.client
        .from('employees')
        .update({ next_invoice_number: current + 1 })
        .eq('id', employeeId)
        .eq('next_invoice_number', current);

      if (result.error) {
        console.error('[Numbering] incrementNumber error:', result.error);
        throw new Error('Failed to increment invoice number: ' + result.error.message);
      }

      return current;
    } catch (err) {
      console.error('[Numbering] incrementNumber exception:', err);
      throw err;
    }
  },

  /* ── Use the DB RPC function for atomic increment (preferred) ── */
  async incrementNumberAtomic(employeeId) {
    try {
      var result = await DB.client
        .rpc('increment_invoice_number', { emp_id: employeeId });

      if (result.error) {
        console.error('[Numbering] incrementNumberAtomic error:', result.error);
        // Fall back to non-atomic version
        return await this.incrementNumber(employeeId);
      }

      return result.data;
    } catch (err) {
      console.error('[Numbering] incrementNumberAtomic exception:', err);
      throw err;
    }
  },

  /* ── Generate filename based on employee format ── */
  getFileName(employee, number, date) {
    var nameParts = (employee.full_name_lat || 'Unknown').split(' ');
    var firstName = nameParts[0] || 'Unknown';
    var lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    var nameStr = lastName ? firstName + '-' + lastName : firstName;
    var monthStr = Numbering._toMonthYear(date);

    var rawName = 'Invoice_' + nameStr + '_' + number + (monthStr ? '_' + monthStr : '') + '.pdf';
    return _sanitizeFileName(rawName);
  },

  /* ── Validate invoice number is not already used ── */
  async isNumberUsed(employeeId, number, month, year) {
    try {
      var query = DB.client
        .from('invoices')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('invoice_number', number);

      // Scope to month/year if provided (allows reuse across periods)
      if (month != null && year != null) {
        query = query.eq('month', month).eq('year', year);
      }

      var result = await query.maybeSingle();

      if (result.error) {
        console.error('[Numbering] isNumberUsed error:', result.error);
        // Fail safe: assume used to prevent duplicates
        return true;
      }

      return !!result.data;
    } catch (err) {
      console.error('[Numbering] isNumberUsed exception:', err);
      return true;
    }
  },

  /* ── Get the next available number (skipping used ones) ── */
  async getNextAvailableNumber(employeeId) {
    try {
      var info = await this.getNextNumber(employeeId);
      var nextNum = info.number;
      var prefix = info.prefix;

      // Check if this number is already used (edge case: manual override)
      var formatted = this.formatNumber(prefix, nextNum);
      var used = await this.isNumberUsed(employeeId, formatted);
      var maxAttempts = 100;
      var attempts = 0;

      while (used && attempts < maxAttempts) {
        nextNum++;
        formatted = this.formatNumber(prefix, nextNum);
        used = await this.isNumberUsed(employeeId, formatted);
        attempts++;
      }

      return { number: nextNum, prefix: prefix, formatted: formatted };
    } catch (err) {
      console.error('[Numbering] getNextAvailableNumber exception:', err);
      return { number: 1, prefix: '', formatted: '001' };
    }
  },

  /* ── Internal: convert date to "Month-YYYY" for filename ── */
  _toMonthYear(dateStr) {
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    if (!dateStr) return '';
    var m, y;
    // DD.MM.YY or DD.MM.YYYY
    var dotMatch = String(dateStr).match(/^\d{2}\.(\d{2})\.(\d{2,4})$/);
    if (dotMatch) {
      m = parseInt(dotMatch[1], 10) - 1;
      if (m < 0 || m > 11) return '';
      y = dotMatch[2].length === 2 ? '20' + dotMatch[2] : dotMatch[2];
      return months[m] + '-' + y;
    }
    // ISO YYYY-MM-DD
    var isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      m = parseInt(isoMatch[2], 10) - 1;
      if (m < 0 || m > 11) return '';
      return months[m] + '-' + isoMatch[1];
    }
    return '';
  },

  /* ── Internal: convert date to DD.MM.YYYY ── */
  _toFullDate(dateStr) {
    if (!dateStr) return '';
    // DD.MM.YY -> DD.MM.20YY
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(dateStr)) {
      return dateStr.slice(0, 6) + '20' + dateStr.slice(6);
    }
    // Already DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    // ISO date (YYYY-MM-DD) — parse components directly to avoid timezone shift
    var isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return isoMatch[3] + '.' + isoMatch[2] + '.' + isoMatch[1];
    }
    return dateStr;
  },
};
