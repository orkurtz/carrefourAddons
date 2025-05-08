/**
 * content.js - סקריפט תוכן ראשי של ההרחבה
 * 
 * הסקריפט הראשי מייצא ומייבא עגלת קניות של Carrefour לקובץ CSV
 * הסקריפט מוזרק לדפי Carrefour ומאזין להודעות מחלון ה-popup
 */

import CONFIG from './utils/config';
import { createDebugElement, registerKeyboardShortcuts } from './ui/uiComponents';
import { exportCart, importCart } from './services/cartOperations';
import { debug, sleep } from './utils/helpers';

// וידוא שאנחנו באתר Carrefour
if (window.location.href.includes('carrefour.co.il')) {
  // יצירת מזהה חד ערכי למופע הנוכחי של הסקריפט
  const scriptId = Math.random().toString(36).substring(2, 15);
  console.log('%c CARREFOUR EXTENSION LOADED ', 'background: #f39200; color: white; font-size: 16px;', window.location.href);
  console.log('content.js: מזהה מופע סקריפט:', scriptId);
  
  // הוספת סימון לעמוד שהסקריפט פעיל
  document.documentElement.dataset.carrefourExtensionActive = scriptId;
  
  // יצירת אלמנט דיבאג
  const debugElement = createDebugElement(scriptId);
  
  // הרשמה לקיצורי מקלדת
  registerKeyboardShortcuts(debugElement);
  
  // האזנה להודעות מחלון הקופץ
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(`content.js (${scriptId}): התקבלה הודעה:`, request);
    debug(`התקבלה הודעה: ${request.action} (${new Date().toLocaleTimeString()})`);
    
    try {
      // טיפול בבקשת ייצוא עגלה
      if (request.action === "exportCart") {
        console.log('content.js: התקבלה בקשה לייצוא עגלה מהחלון הקופץ');
        debug('מתחיל ייצוא');
        
        exportCart()
          .then(success => {
            sendResponse({status: success ? 'ok' : 'error'});
          })
          .catch(error => {
            console.error('שגיאה בייצוא העגלה:', error);
            sendResponse({error: error.message});
          });
        
        return true; // להמשך שליחת תשובה אסינכרונית
      }
      // טיפול בבקשת ייבוא עגלה
      else if (request.action === "importCart") {
        console.log('content.js: התקבלה בקשה לייבוא עגלה מהחלון הקופץ', 
          request.data ? `(${request.data.length} פריטים)` : '(ללא נתונים)',
          'מצב:', request.mode || CONFIG.IMPORT_MODES.REPLACE);
        debug('מתחיל ייבוא');
        
        if (request.data && Array.isArray(request.data) && request.data.length > 1) {
          importCart(request.data, request.mode || CONFIG.IMPORT_MODES.REPLACE)
            .then(success => {
              sendResponse({status: success ? 'completed' : 'error'});
            })
            .catch(error => {
              console.error('שגיאה בייבוא העגלה:', error);
              sendResponse({error: error.message});
            });
        } else {
          console.error('content.js: נתוני CSV לא תקינים:', request.data);
          sendResponse({error: 'נתונים לא תקינים'});
        }
        
        return true; // להמשך שליחת תשובה אסינכרונית
      }
      // טיפול בהודעות לא מוכרות
      else {
        console.log('content.js: התקבלה פעולה לא מוכרת:', request.action);
        sendResponse({error: 'פעולה לא מוכרת'});
        return true;
      }
    } catch (error) {
      console.error('content.js: שגיאה בעת טיפול בהודעה:', error);
      debug(`שגיאה: ${error.message}`);
      sendResponse({error: error.message});
      return true;
    }
  });
  
  // בדיקה האם יש פעולה ממתינה לביצוע (אחרי מעבר דף)
  chrome.storage.local.get([
    CONFIG.STORAGE_KEYS.PENDING_ACTION, 
    CONFIG.STORAGE_KEYS.IMPORT_DATA, 
    CONFIG.STORAGE_KEYS.IMPORT_MODE
  ], function(data) {
    // בדיקה אם יש פעולת ייצוא ממתינה
    if (data[CONFIG.STORAGE_KEYS.PENDING_ACTION] === 'export' && window.location.href.includes('/cart')) {
      console.log('נמצאה פעולת ייצוא ממתינה, מבצע');
      // נקה את הפעולה הממתינה
      chrome.storage.local.remove([CONFIG.STORAGE_KEYS.PENDING_ACTION]);
      // מתחיל בייצוא
      setTimeout(() => exportCart(), CONFIG.TIMEOUTS.STANDARD_DELAY);
    }
    // בדיקה אם יש נתוני ייבוא מאוחסנים
    else if (data[CONFIG.STORAGE_KEYS.IMPORT_DATA]) {
      console.log('content.js: נמצאו נתוני ייבוא מאוחסנים:', data[CONFIG.STORAGE_KEYS.IMPORT_DATA].length);
      
      // הצגת הודעה למשתמש
      if (confirm('נמצאו נתוני ייבוא CSV שטרם יובאו. האם להתחיל בייבוא כעת?')) {
        importCart(
          data[CONFIG.STORAGE_KEYS.IMPORT_DATA], 
          data[CONFIG.STORAGE_KEYS.IMPORT_MODE] || CONFIG.IMPORT_MODES.REPLACE
        ).finally(() => {
          // נקה את הנתונים המאוחסנים
          chrome.storage.local.remove([
            CONFIG.STORAGE_KEYS.IMPORT_DATA, 
            CONFIG.STORAGE_KEYS.IMPORT_MODE
          ]);
        });
      } else {
        // נקה את הנתונים המאוחסנים
        chrome.storage.local.remove([
          CONFIG.STORAGE_KEYS.IMPORT_DATA, 
          CONFIG.STORAGE_KEYS.IMPORT_MODE
        ]);
      }
    }
  });
  
  console.log('content.js: אתחול הושלם');
} 