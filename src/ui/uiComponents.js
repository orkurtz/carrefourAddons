/**
 * uiComponents.js - מודול לניהול רכיבי ממשק המשתמש של ההרחבה
 */

import CONFIG from '../utils/config';
import { createElement } from '../utils/helpers';

/**
 * יצירת אלמנט דיבאג להצגת סטטוס ההרחבה
 * @param {string} scriptId - מזהה ייחודי למופע הנוכחי של הסקריפט
 * @returns {HTMLElement} אלמנט הדיבאג שנוצר
 */
export function createDebugElement(scriptId) {
  const debugElement = createElement('div', {
    id: CONFIG.ELEMENTS.DEBUG_ELEMENT_ID,
    style: {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      zIndex: '10000',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '5px',
      fontSize: '10px',
      borderRadius: '3px',
      display: 'none'
    },
    textContent: `סקריפט פעיל (${scriptId})`
  });
  
  document.body.appendChild(debugElement);
  return debugElement;
}

/**
 * יצירת כפתור ייצוא בדף העגלה
 * @param {Function} exportCallback - פונקציית קולבק להפעלה בלחיצה על הכפתור
 * @returns {HTMLElement} כפתור הייצוא שנוצר
 */
export function createExportButton(exportCallback) {
  // בדיקה אם הכפתור כבר קיים
  if (document.getElementById(CONFIG.ELEMENTS.EXPORT_BUTTON_ID)) {
    return null;
  }
  
  const button = createElement('button', {
    id: CONFIG.ELEMENTS.EXPORT_BUTTON_ID,
    textContent: 'ייצא לקובץ CSV',
    style: {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '9999',
      padding: '10px 15px',
      backgroundColor: CONFIG.UI.STYLES.PRIMARY_COLOR,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: 'bold',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }
  });
  
  // הוספת אפקטים בריחוף עכבר
  button.addEventListener('mouseenter', function() {
    this.style.backgroundColor = '#e58a00';
  });
  
  button.addEventListener('mouseleave', function() {
    this.style.backgroundColor = CONFIG.UI.STYLES.PRIMARY_COLOR;
  });
  
  // הוספת אירוע לחיצה
  button.addEventListener('click', exportCallback);
  
  document.body.appendChild(button);
  return button;
}

/**
 * עדכון מצב כפתור הייצוא
 * @param {string} text - טקסט להצגה על הכפתור
 * @param {boolean} disabled - האם הכפתור מושבת
 * @param {string} backgroundColor - צבע רקע לכפתור
 */
export function updateExportButton(text = 'ייצא לקובץ CSV', disabled = false, backgroundColor = CONFIG.UI.STYLES.PRIMARY_COLOR) {
  const button = document.getElementById(CONFIG.ELEMENTS.EXPORT_BUTTON_ID);
  if (button) {
    button.disabled = disabled;
    button.textContent = text;
    button.style.backgroundColor = backgroundColor;
  }
}

/**
 * יצירת חלון התקדמות הייבוא
 * @param {number} totalItems - מספר הפריטים הכולל לייבוא
 * @param {string} mode - מצב הייבוא (החלפה/הוספה)
 * @returns {Object} אובייקט עם הממשק לחלון ההתקדמות
 */
export function createProgressDialog(totalItems, mode = CONFIG.IMPORT_MODES.REPLACE) {
  // מחיקת דיאלוג קיים אם יש
  const existingDialog = document.getElementById(CONFIG.ELEMENTS.IMPORT_PROGRESS_MODAL_ID);
  if (existingDialog) {
    existingDialog.remove();
  }
  
  // יצירת הדיאלוג
  const progressModal = createElement('div', {
    id: CONFIG.ELEMENTS.IMPORT_PROGRESS_MODAL_ID,
    style: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      zIndex: '10000',
      minWidth: '300px',
      direction: 'rtl'
    }
  });
  
  // יצירת כותרת הדיאלוג
  const progressTitle = createElement('h3', {
    textContent: mode === CONFIG.IMPORT_MODES.REPLACE ? 
      'מייבא מוצרים לעגלה (החלפה)...' : 
      'מוסיף מוצרים לעגלה...',
    style: {
      margin: '0 0 15px 0',
      color: '#333'
    }
  });
  
  // יצירת מיכל מד ההתקדמות
  const progressBar = createElement('div', {
    style: {
      width: '100%',
      height: '20px',
      backgroundColor: CONFIG.UI.STYLES.SECONDARY_COLOR,
      borderRadius: '10px',
      overflow: 'hidden'
    }
  });
  
  // יצירת המילוי של מד ההתקדמות
  const progressFill = createElement('div', {
    style: {
      width: '0%',
      height: '100%',
      backgroundColor: CONFIG.UI.STYLES.PRIMARY_COLOR,
      transition: 'width 0.3s'
    }
  });
  
  // יצירת טקסט סטטוס ההתקדמות
  const progressStatus = createElement('div', {
    textContent: `מתחיל בייבוא... (0/${totalItems})`,
    style: {
      marginTop: '10px',
      fontSize: '14px'
    }
  });
  
  // יצירת כפתור סגירה
  const closeButton = createElement('button', {
    textContent: 'סגור',
    style: {
      marginTop: '15px',
      padding: '5px 10px',
      backgroundColor: CONFIG.UI.STYLES.SECONDARY_COLOR,
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'none' // יוצג רק בסיום
    }
  });
  
  // הוספת פונקציית סגירה לכפתור
  closeButton.addEventListener('click', function() {
    document.body.removeChild(progressModal);
  });
  
  // הרכבת הדיאלוג
  progressBar.appendChild(progressFill);
  progressModal.appendChild(progressTitle);
  progressModal.appendChild(progressBar);
  progressModal.appendChild(progressStatus);
  progressModal.appendChild(closeButton);
  
  document.body.appendChild(progressModal);
  
  // החזרת ממשק לשליטה בדיאלוג
  return {
    updateProgress: function(current, total, statusText) {
      const progress = Math.round((current / total) * 100);
      progressFill.style.width = `${progress}%`;
      progressStatus.textContent = statusText || `מייבא... (${current}/${total})`;
    },
    complete: function(statusText, isError = false) {
      progressTitle.textContent = isError ? 'שגיאה בייבוא' : 'הייבוא הושלם בהצלחה';
      progressStatus.textContent = statusText || 'הייבוא הושלם';
      progressFill.style.backgroundColor = isError ? 
        CONFIG.UI.STYLES.ERROR_COLOR : 
        CONFIG.UI.STYLES.SUCCESS_COLOR;
      closeButton.style.display = 'block';
    },
    close: function() {
      if (progressModal.parentNode) {
        progressModal.parentNode.removeChild(progressModal);
      }
    }
  };
}

/**
 * הרשמה לאירועי מקלדת להצגת חלון הדיבאג
 * @param {HTMLElement} debugElement - אלמנט הדיבאג לשליטה
 */
export function registerKeyboardShortcuts(debugElement) {
  document.addEventListener('keydown', function(e) {
    // Alt+D להצגת/הסתרת חלון הדיבאג
    if (e.altKey && e.key === 'd') {
      if (debugElement) {
        debugElement.style.display = debugElement.style.display === 'none' ? 'block' : 'none';
      }
    }
  });
}

export default {
  createDebugElement,
  createExportButton,
  updateExportButton,
  createProgressDialog,
  registerKeyboardShortcuts
}; 