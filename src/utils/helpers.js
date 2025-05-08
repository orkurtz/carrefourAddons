/**
 * helpers.js - פונקציות עזר וכלים לשימוש נפוץ בכל רחבי ההרחבה
 */

import CONFIG from './config';

/**
 * שליחת בקשה ל-API עם טיפול בשגיאות עקבי
 * @param {string} url - כתובת ה-API
 * @param {Object} options - אפשרויות לבקשה
 * @param {number} timeout - זמן מקסימלי לתשובה במילישניות
 * @returns {Promise<Object>} תשובת השרת
 */
export async function fetchWithTimeout(url, options = {}, timeout = CONFIG.TIMEOUTS.API_TIMEOUT) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // שליפת פרטי שגיאה, אם זמינים
      let errorDetails = '';
      try {
        errorDetails = await response.text();
      } catch (e) {
        errorDetails = 'לא ניתן לקרוא פרטי שגיאה';
      }
      
      throw new Error(`שגיאת API: ${response.status} ${response.statusText}. ${errorDetails}`);
    }
    
    return await response.json();
  } catch (error) {
    // בדיקה אם השגיאה היא timeout
    if (error.name === 'AbortError') {
      throw new Error(`פסק זמן בבקשה: ${url}`);
    }
    throw error;
  }
}

/**
 * קבלת נתוני עגלה ונתוני אימות מסקריפט הרקע
 * @returns {Promise<Object>} אובייקט עם נתוני עגלה וטוקן
 */
export function getCartData() {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('פסק זמן בבקשת נתוני עגלה'));
    }, CONFIG.TIMEOUTS.API_TIMEOUT);
    
    chrome.runtime.sendMessage({action: "getCartData"}, response => {
      clearTimeout(timeoutId);
      
      if (chrome.runtime.lastError) {
        reject(new Error('תקלה בתקשורת עם סקריפט הרקע: ' + chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('לא התקבלה תשובה מסקריפט הרקע'));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * יצירת כתובת API מתבנית עם הכנסת ערכים
 * @param {string} template - תבנית כתובת ה-API
 * @param {Object} params - ערכים להכנסה לתבנית
 * @returns {string} כתובת ה-API המלאה
 */
export function formatApiUrl(template, params) {
  let url = template;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, value);
  }
  return url;
}

/**
 * חילוץ מזהה מוצר מקישור
 * @param {string} link - קישור למוצר
 * @returns {string|null} מזהה המוצר או null אם לא נמצא
 */
export function extractProductIdFromLink(link) {
  try {
    // בדיקה אם הקישור מכיל מזהה מוצר
    const match = link.match(/\/product\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // ננסה למצוא מזהה בחלק האחרון של ה-URL
    const parts = link.split('/');
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      return lastPart;
    }
    
    return null;
  } catch (error) {
    console.error('שגיאה בחילוץ מזהה מוצר מקישור:', error);
    return null;
  }
}

/**
 * המתנה למשך זמן מוגדר
 * @param {number} ms - זמן המתנה במילישניות
 * @returns {Promise<void>} פרומיס שמסתיים לאחר ההמתנה
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * פיענוח שורת CSV תוך התחשבות במירכאות וערכים עם פסיקים
 * @param {string} line - שורת CSV
 * @returns {Array<string>} מערך של ערכים מהשורה
 */
export function parseCSVLine(line) {
  const result = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (i < line.length - 1 && line[i + 1] === '"') {
        // זוג מירכאות בתוך תא - נחשב כמירכאה אחת
        cell += '"';
        i++; // דלג על המירכאה השנייה
      } else {
        // החלף את מצב המירכאות
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // סוף תא
      result.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  
  // הוסף את התא האחרון
  result.push(cell);
  
  return result;
}

/**
 * יצירת הודעת דיבאג וכתיבתה לקונסול
 * @param {string} message - הודעת הדיבאג
 * @param {Object} [data] - נתונים נוספים להדפסה
 */
export function debug(message, data = null) {
  const debugElement = document.getElementById(CONFIG.ELEMENTS.DEBUG_ELEMENT_ID);
  
  console.log(`[Carrefour Extension] ${message}`, data || '');
  
  if (debugElement) {
    debugElement.textContent = message;
    debugElement.style.display = 'block';
    
    // הסתרה אוטומטית אחרי 5 שניות
    setTimeout(() => {
      debugElement.style.display = 'none';
    }, 5000);
  }
}

/**
 * יצירת אלמנט HTML עם מאפיינים ותכונות
 * @param {string} tag - תג ה-HTML
 * @param {Object} attributes - מאפייני האלמנט
 * @param {string|Node} [content] - תוכן האלמנט
 * @returns {HTMLElement} אלמנט ה-HTML שנוצר
 */
export function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag);
  
  // הוספת מאפיינים
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element[key] = value;
    }
  }
  
  // הוספת תוכן
  if (content) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else {
      element.appendChild(content);
    }
  }
  
  return element;
}

export default {
  fetchWithTimeout,
  getCartData,
  formatApiUrl,
  extractProductIdFromLink,
  sleep,
  parseCSVLine,
  debug,
  createElement
}; 