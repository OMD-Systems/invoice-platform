/* ═══════════════════════════════════════════════════════
   PdfUtils — Shared PDF generation utilities
   HTML → html2canvas → jsPDF with watermark & encryption
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

var PdfUtils = {

  /**
   * Render an HTML string to a protected PDF blob.
   * @param {string} html - Full HTML content
   * @param {object} [opts]
   * @param {string} [opts.ownerPassword] - Owner password for encryption
   * @param {string} [opts.watermark] - Watermark text
   * @param {number} [opts.scale] - html2canvas scale (default 2)
   * @returns {Promise<Blob>}
   */
  renderToPdf: function (html, opts) {
    opts = opts || {};
    var scale = opts.scale || 2;
    var watermark = opts.watermark || 'WOODENSHARK LLC CONFIDENTIAL';

    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.style.cssText =
        'position: fixed; left: -9999px; top: 0; width: 794px; z-index: -1; ' +
        'background: #fff; padding: 0; margin: 0;';

      var wrapper = document.createElement('div');
      wrapper.style.cssText =
        'background: #fff; color: #000; font-family: Calibri, Cambria, Segoe UI, Arial, sans-serif; ' +
        'font-size: 10pt; line-height: 1.4; padding: 40px; margin: 0; ' +
        'width: 794px; min-height: auto; position: relative; overflow: hidden;';

      // Watermark layer
      if (watermark) {
        var wmDiv = document.createElement('div');
        wmDiv.style.cssText =
          'position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
          'display: flex; align-items: center; justify-content: center; ' +
          'pointer-events: none; z-index: 0;';
        wmDiv.innerHTML =
          '<div style="transform: rotate(-45deg); font-size: 64px; font-weight: 700; ' +
          'color: rgba(0,0,0,0.06); white-space: nowrap; letter-spacing: 8px; ' +
          'font-family: Calibri, Arial, sans-serif; user-select: none;">' +
          PdfUtils.esc(watermark) + '</div>';
        wrapper.appendChild(wmDiv);
      }

      // Content layer
      var content = document.createElement('div');
      content.style.cssText = 'position: relative; z-index: 1;';
      content.innerHTML = html;
      wrapper.appendChild(content);
      container.appendChild(wrapper);
      document.body.appendChild(container);

      setTimeout(function () {
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
          container.remove();
          reject(new Error('jsPDF or html2canvas not loaded'));
          return;
        }

        html2canvas(wrapper, {
          scale: scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794
        }).then(function (canvas) {
          container.remove();

          try {
            var jsPDF = jspdf.jsPDF;
            var pdfOpts = { orientation: 'p', unit: 'mm', format: 'a4' };

            if (opts.ownerPassword) {
              pdfOpts.encryption = {
                ownerPassword: opts.ownerPassword,
                userPassword: '',
                userPermissions: ['print', 'copy']
              };
            }

            var pdf = new jsPDF(pdfOpts);
            var pdfWidth = 210;
            var pdfHeight = 297;
            var imgWidth = pdfWidth;
            var imgHeight = (canvas.height * pdfWidth) / canvas.width;
            var imgData = canvas.toDataURL('image/jpeg', 0.95);
            var heightLeft = imgHeight;
            var position = 0;

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position = -(imgHeight - heightLeft);
              pdf.addPage();
              pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
              heightLeft -= pdfHeight;
            }

            resolve(pdf.output('blob'));
          } catch (err) {
            reject(err);
          }
        }).catch(function (err) {
          container.remove();
          reject(err);
        });
      }, 200);
    });
  },

  esc: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatDateLong: function (dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  nlToBr: function (str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br>');
  }
};
