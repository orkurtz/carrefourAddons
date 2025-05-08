/**
 * cartOperations.js - מודול לטיפול בפעולות ייבוא וייצוא עגלה
 */

import CONFIG from '../utils/config';
import { debug, sleep, extractProductIdFromLink } from '../utils/helpers';
import * as cartService from '../api/cartService';
import * as csvService from '../data/csvService';
import * as uiComponents from '../ui/uiComponents';

/**
 * ייצוא העגלה הנוכחית לקובץ CSV
 * @returns {Promise<boolean>} האם הייצוא הצליח
 */
export async function exportCart() {
  try {
    // עדכון כפתור הייצוא אם קיים
    uiComponents.updateExportButton('טוען...', true, '#aaa');
    
    debug('מבקש נתוני עגלה מסקריפט הרקע...');
    
    // קבלת נתוני העגלה הנוכחית
    const cartItems = await cartService.getCurrentCart();
    
    if (!cartItems || cartItems.length === 0) {
      debug('העגלה ריקה או שלא התקבל מידע');
      alert('העגלה ריקה או שלא התקבל מידע');
      uiComponents.updateExportButton();
      return false;
    }
    
    debug(`נמצאו ${cartItems.length} מוצרים בעגלה, מכין קובץ CSV`);
    
    // ייצוא המידע ל-CSV
    await csvService.exportToCsv(cartItems);
    
    debug('קובץ CSV הורד בהצלחה');
    
    uiComponents.updateExportButton("ייצוא הושלם!", false, CONFIG.UI.STYLES.SUCCESS_COLOR);
    
    setTimeout(() => {
      uiComponents.updateExportButton();
    }, CONFIG.TIMEOUTS.CLEANUP_DELAY);
    
    return true;
  } catch (error) {
    console.error("שגיאה בייצוא העגלה:", error);
    debug(`שגיאה: ${error.message}`);
    alert(`שגיאה בייצוא העגלה: ${error.message}`);
    uiComponents.updateExportButton();
    return false;
  }
}

/**
 * ייבוא מוצרים מנתוני CSV לעגלה הנוכחית
 * @param {Array<Array<string>>} csvData - נתוני ה-CSV (מערך של שורות)
 * @param {string} mode - מצב הייבוא ('replace' או 'add')
 * @returns {Promise<boolean>} האם הייבוא הצליח
 */
export async function importCart(csvData, mode = CONFIG.IMPORT_MODES.REPLACE) {
  try {
    console.log('מתחיל בייבוא מוצרים מקובץ CSV', csvData.length, 'במצב:', mode);
    
    if (!csvData || !Array.isArray(csvData) || csvData.length < 2) {
      throw new Error('נתוני CSV לא תקינים');
    }
    
    // עיבוד נתוני ה-CSV
    const parsedCsv = csvService.parseCSV(csvData.join('\n'));
    
    // הכנת נתוני המוצרים לייבוא
    const products = csvService.prepareImportData(parsedCsv);
    
    if (!products || products.length === 0) {
      throw new Error('לא נמצאו מוצרים תקינים בקובץ');
    }
    
    // יצירת חלון התקדמות
    const progressDialog = uiComponents.createProgressDialog(products.length, mode);
    
    // שלב 1: טיפול בעגלה קיימת בהתאם למצב היבוא
    let existingCartItems = [];
    
    try {
      // קבלת הפריטים הקיימים בעגלה
      progressDialog.updateProgress(0, products.length, 'מקבל נתוני עגלה נוכחית...');
      existingCartItems = await cartService.getCurrentCart();
      
      // טיפול במצב החלפה - ריקון העגלה הקיימת
      if (mode === CONFIG.IMPORT_MODES.REPLACE && existingCartItems.length > 0) {
        progressDialog.updateProgress(0, products.length, `מרוקן את העגלה הקיימת (${existingCartItems.length} פריטים)...`);
        
        const clearSuccess = await cartService.clearCart(existingCartItems);
        if (clearSuccess) {
          progressDialog.updateProgress(0, products.length, 'העגלה הקיימת רוקנה בהצלחה');
          // איפוס רשימת הפריטים הקיימים
          existingCartItems = [];
          // המתנה קצרה אחרי ריקון העגלה
          await sleep(CONFIG.TIMEOUTS.RETRY_DELAY);
        } else {
          console.error('שגיאה בריקון העגלה');
          progressDialog.updateProgress(0, products.length, 'שגיאה בריקון העגלה - ממשיך ביבוא');
        }
      }
    } catch (error) {
      console.error('שגיאה בטיפול בעגלה הנוכחית:', error);
      progressDialog.updateProgress(0, products.length, 'שגיאה בטיפול בעגלה הנוכחית - ממשיך ביבוא');
    }
    
    // שלב 2: הוספת המוצרים החדשים
    let addedProducts = 0;
    let skippedProducts = 0;
    let zeroQuantityProducts = 0;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      let shouldSkip = false;
      let finalQuantity = product.quantity;
      
      // בדיקה במצב הוספה אם המוצר כבר קיים בעגלה
      if (mode === CONFIG.IMPORT_MODES.ADD && existingCartItems.length > 0) {
        const existingItem = findExistingCartItem(existingCartItems, product);
        
        if (existingItem) {
          // המוצר כבר קיים - נעדכן את הכמות
          finalQuantity = existingItem.quantity + product.quantity;
          progressDialog.updateProgress(
            i, 
            products.length, 
            `מעדכן כמות: ${product.name} (${existingItem.quantity} + ${product.quantity} = ${finalQuantity})`
          );
        }
      }
      
      // בדיקה אם הכמות היא 0
      if (finalQuantity <= 0) {
        zeroQuantityProducts++;
        progressDialog.updateProgress(
          i, 
          products.length, 
          `דילוג על ${product.name} - כמות אפס או שלילית אינה חוקית`
        );
        continue;
      }
      
      // בחירת שיטת ההוספה הטובה ביותר בהתאם לנתונים הזמינים
      let success = false;
      
      if (!shouldSkip) {
        if (product.retailerProductId) {
          // יש לנו מזהה ספק - השיטה המועדפת
          progressDialog.updateProgress(
            i, 
            products.length, 
            `מוסיף: ${product.name} (מזהה ספק: ${product.retailerProductId}, כמות: ${finalQuantity})`
          );
          success = await cartService.addProductToCart(product.retailerProductId, finalQuantity);
        } 
        else if (product.productId) {
          // יש לנו מזהה מוצר
          progressDialog.updateProgress(
            i, 
            products.length, 
            `מוסיף: ${product.name} (מזהה מוצר: ${product.productId}, כמות: ${finalQuantity})`
          );
          success = await cartService.addProductToCart(product.productId, finalQuantity);
        } 
        else if (product.link) {
          // יש לנו קישור - ננסה לחלץ ממנו מזהה מוצר
          const productId = extractProductIdFromLink(product.link);
          if (productId) {
            progressDialog.updateProgress(
              i, 
              products.length, 
              `מוסיף: ${product.name} (לפי קישור, כמות: ${finalQuantity})`
            );
            success = await cartService.addProductToCart(productId, finalQuantity);
          }
        } 
        else if (product.barcode) {
          // יש לנו ברקוד - נחפש את המוצר
          progressDialog.updateProgress(
            i, 
            products.length, 
            `מחפש ומוסיף לפי ברקוד: ${product.barcode} (${product.name}, כמות: ${finalQuantity})`
          );
          
          const searchResult = await cartService.searchProduct(product.barcode);
          if (searchResult && searchResult.length > 0) {
            success = await cartService.addProductToCart(searchResult[0].id, finalQuantity);
          }
        } 
        else if (product.name) {
          // יש לנו רק שם - נחפש את המוצר
          progressDialog.updateProgress(
            i, 
            products.length, 
            `מחפש ומוסיף לפי שם: ${product.name} (כמות: ${finalQuantity})`
          );
          
          const searchResult = await cartService.searchProduct(product.name);
          if (searchResult && searchResult.length > 0) {
            success = await cartService.addProductToCart(searchResult[0].id, finalQuantity);
          }
        }
      }
      
      // עדכון סטטיסטיקה
      if (success) {
        addedProducts++;
      } else if (shouldSkip) {
        skippedProducts++;
      }
      
      // המתנה קצרה בין הוספת מוצרים כדי לא להעמיס את השרת
      await sleep(CONFIG.TIMEOUTS.STANDARD_DELAY);
    }
    
    // סיכום תהליך הייבוא
    if (mode === CONFIG.IMPORT_MODES.ADD && skippedProducts > 0) {
      progressDialog.complete(
        `הוספו ${addedProducts} מוצרים לעגלה, דולגו ${skippedProducts} מוצרים שכבר קיימים${zeroQuantityProducts > 0 ? `, ${zeroQuantityProducts} מוצרים עם כמות 0` : ''}`
      );
    } else {
      let summaryMessage = `ייבוא הושלם בהצלחה (${addedProducts}/${products.length} מוצרים)`;
      if (zeroQuantityProducts > 0) {
        summaryMessage += `, דולגו ${zeroQuantityProducts} מוצרים עם כמות 0`;
      }
      progressDialog.complete(summaryMessage);
    }
    
    return true;
  } catch (error) {
    console.error('שגיאה בייבוא מוצרים:', error);
    
    const progressDialog = document.getElementById(CONFIG.ELEMENTS.IMPORT_PROGRESS_MODAL_ID);
    if (progressDialog) {
      const dialog = {
        complete: function(message, isError) {
          const title = progressDialog.querySelector('h3');
          const status = progressDialog.querySelector('div:nth-child(3)');
          const fill = progressDialog.querySelector('div > div');
          const button = progressDialog.querySelector('button');
          
          if (title) title.textContent = 'שגיאה בייבוא';
          if (status) status.textContent = message;
          if (fill) fill.style.backgroundColor = CONFIG.UI.STYLES.ERROR_COLOR;
          if (button) button.style.display = 'block';
        }
      };
      
      dialog.complete(`שגיאה בייבוא: ${error.message}`, true);
    } else {
      alert(`שגיאה בייבוא: ${error.message}`);
    }
    
    return false;
  }
}

/**
 * חיפוש מוצר בעגלה קיימת לפי קריטריונים שונים
 * @param {Array<Object>} existingItems - מוצרים קיימים בעגלה
 * @param {Object} product - המוצר לחיפוש
 * @returns {Object|null} המוצר שנמצא או null אם לא נמצא
 */
function findExistingCartItem(existingItems, product) {
  // חיפוש לפי מזהה ספק
  if (product.retailerProductId) {
    const byRetailerId = existingItems.find(item => 
      item.retailerProductId === product.retailerProductId || 
      item.retailerProductId === String(product.retailerProductId) || 
      String(item.retailerProductId) === product.retailerProductId
    );
    
    if (byRetailerId) return byRetailerId;
  }
  
  // חיפוש לפי מזהה מוצר
  if (product.productId) {
    const byProductId = existingItems.find(item => 
      item.productId === product.productId || 
      item.productId === String(product.productId) || 
      String(item.productId) === product.productId
    );
    
    if (byProductId) return byProductId;
  }
  
  // חיפוש לפי שם מוצר בדיוק
  if (product.name) {
    const byName = existingItems.find(item => item.name === product.name);
    if (byName) return byName;
  }
  
  return null;
}

export default {
  exportCart,
  importCart
}; 