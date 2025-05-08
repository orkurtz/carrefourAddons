/**
 * csvService.js - מודול לטיפול בתהליכי ייבוא וייצוא CSV
 */

import CONFIG from '../utils/config';
import { parseCSVLine } from '../utils/helpers';

/**
 * ייצוא נתונים לקובץ CSV ושמירתו במכשיר המשתמש
 * @param {Array<Object>} data - מערך אובייקטים לייצוא
 * @param {string} filename - שם הקובץ לשמירה
 * @returns {Promise<boolean>} האם הייצוא הצליח
 */
export function exportToCsv(data, filename = CONFIG.CSV.DEFAULT_FILENAME) {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('אין נתונים לייצוא');
    }
    
    // הוספת עיבוד לפני יצירת ה-CSV - וידוא שיש את כל השדות הנכונים
    const processedData = data.map(item => {
      // וידוא שיש שדה productId
      if (!item.productId && item.retailerProductId) {
        item.productId = item.retailerProductId;
      }
      return item;
    });
    
    // יצירת קובץ CSV
    const headers = Object.keys(processedData[0]).join(',');
    const rows = processedData.map(obj => 
      Object.values(obj).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    
    // הורדת הקובץ
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('שגיאה בייצוא לקובץ CSV:', error);
    throw error;
  }
}

/**
 * ניתוח קובץ CSV והפיכתו למערך של נתונים
 * @param {string} csvText - תוכן ה-CSV כטקסט
 * @returns {Object} אובייקט עם כותרות הקובץ ונתוני השורות
 */
export function parseCSV(csvText) {
  try {
    // חלוקה לשורות
    const lines = csvText.split('\n');
    if (lines.length === 0) {
      throw new Error('הקובץ ריק');
    }
    
    // טיפול בשורת הכותרות
    const headerLine = lines[0].trim();
    const headers = parseCSVLine(headerLine);
    
    // איתור אינדקסים של עמודות חשובות
    const columnIndices = findColumnIndices(headers);
    
    // אם חסרה עמודת שם מוצר, ננסה להשתמש בעמודה הראשונה
    if (columnIndices.nameIndex === -1 && headers.length > 0) {
      columnIndices.nameIndex = 0;
    }
    
    // בדיקה שמצאנו את העמודות הדרושות
    if (columnIndices.nameIndex === -1) {
      throw new Error('לא נמצאה עמודת שם מוצר בקובץ');
    }
    
    // חלוקת שאר השורות לשדות
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const row = parseCSVLine(line);
        if (row.length > 0) {
          rows.push(row);
        }
      }
    }
    
    // טיפול במקרה שיש כותרות שמכילות פסיקים - פיצול כותרות ומיזוג עמודות
    const { fixedHeaders, fixedRows } = handleCommaInHeaders(headers, rows);
    
    return {
      headers: fixedHeaders,
      rows: fixedRows,
      columnIndices: findColumnIndices(fixedHeaders) // עדכון אינדקסים לאחר תיקון הכותרות
    };
  } catch (error) {
    console.error('שגיאה בניתוח קובץ CSV:', error);
    throw error;
  }
}

/**
 * מציאת האינדקסים של העמודות החשובות בקובץ CSV
 * @param {Array<string>} headers - כותרות הקובץ
 * @returns {Object} אובייקט עם האינדקסים של העמודות החשובות
 */
function findColumnIndices(headers) {
  const indices = {
    nameIndex: -1,
    barcodeIndex: -1,
    quantityIndex: -1,
    linkIndex: -1,
    productIdIndex: -1,
    retailerProductIdIndex: -1
  };
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    // בדיקת שם מוצר
    if (CONFIG.CSV.EXPECTED_HEADERS.NAME.some(h => normalizedHeader === h || normalizedHeader.includes(h))) {
      indices.nameIndex = index;
    } 
    // בדיקת ברקוד
    else if (CONFIG.CSV.EXPECTED_HEADERS.BARCODE.some(h => normalizedHeader === h || normalizedHeader.includes(h))) {
      indices.barcodeIndex = index;
    } 
    // בדיקת כמות
    else if (CONFIG.CSV.EXPECTED_HEADERS.QUANTITY.some(h => normalizedHeader === h || normalizedHeader.includes(h))) {
      indices.quantityIndex = index;
    } 
    // בדיקת קישור
    else if (CONFIG.CSV.EXPECTED_HEADERS.LINK.some(h => normalizedHeader === h || normalizedHeader.includes(h))) {
      indices.linkIndex = index;
    } 
    // בדיקת מזהה מוצר
    else if (CONFIG.CSV.EXPECTED_HEADERS.PRODUCT_ID.some(h => normalizedHeader === h || 
             (normalizedHeader.includes('product') && normalizedHeader.includes('id')))) {
      indices.productIdIndex = index;
    } 
    // בדיקת מזהה ספק
    else if (CONFIG.CSV.EXPECTED_HEADERS.RETAILER_PRODUCT_ID.some(h => normalizedHeader === h || 
             (normalizedHeader.includes('retailer') && normalizedHeader.includes('id')))) {
      indices.retailerProductIdIndex = index;
    }
  });
  
  // אם לא מצאנו עמודת כמות, ננסה להשתמש בכל עמודה מספרית
  if (indices.quantityIndex === -1) {
    for (let i = 0; i < headers.length; i++) {
      // נדלג על עמודות שכבר זוהו
      if (i !== indices.nameIndex && 
          i !== indices.barcodeIndex && 
          i !== indices.linkIndex && 
          i !== indices.productIdIndex && 
          i !== indices.retailerProductIdIndex) {
        // נשמור את האינדקס לשימוש מאוחר יותר
        indices.quantityIndex = i;
        break;
      }
    }
  }
  
  return indices;
}

/**
 * טיפול במקרה שיש כותרות שמכילות פסיקים
 * @param {Array<string>} headers - כותרות המקוריות
 * @param {Array<Array<string>>} rows - שורות הנתונים המקוריות
 * @returns {Object} אובייקט עם כותרות ושורות מתוקנות
 */
function handleCommaInHeaders(headers, rows) {
  let fixedHeaders = [...headers];
  let columnsToMerge = [];
  
  // חיפוש כותרות עם פסיקים
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].includes(',')) {
      // מצאנו כותרת עם פסיקים בתוכה
      console.log('נמצאה כותרת עם פסיקים:', headers[i]);
      
      // פיצול הכותרת לכותרות נפרדות
      const splitHeaders = headers[i].split(',');
      
      // מחליף את הכותרת הנוכחית עם הראשונה מהפיצול
      fixedHeaders[i] = splitHeaders[0];
      
      // מוסיף את שאר הכותרות כעמודות חדשות
      for (let j = 1; j < splitHeaders.length; j++) {
        fixedHeaders.push(splitHeaders[j]);
        
        // שומר את המיקום של העמודות ששייכות למיזוג
        columnsToMerge.push(fixedHeaders.length - 1);
      }
    }
  }
  
  // עדכון השורות אם היה צורך במיזוג עמודות
  let fixedRows = rows;
  if (columnsToMerge.length > 0) {
    fixedRows = rows.map(row => {
      const newRow = [...row];
      // מוסיף ערכים ריקים לעמודות החדשות
      for (let i = 0; i < columnsToMerge.length; i++) {
        newRow.push('');
      }
      return newRow;
    });
  }
  
  return { fixedHeaders, fixedRows };
}

/**
 * יצירת מבנה נתונים מוכן לייבוא מקובץ CSV
 * @param {Object} parsedCsv - תוצאת הניתוח של קובץ ה-CSV
 * @returns {Array<Object>} מערך של אובייקטי מוצר מוכנים לייבוא
 */
export function prepareImportData(parsedCsv) {
  const { headers, rows, columnIndices } = parsedCsv;
  const { nameIndex, barcodeIndex, quantityIndex, linkIndex, productIdIndex, retailerProductIdIndex } = columnIndices;
  
  return rows.map(row => {
    const productName = row[nameIndex] || '';
    const barcode = barcodeIndex !== -1 ? row[barcodeIndex] : '';
    
    // טיפול בכמות - אם לא נמצאה עמודת כמות, נשתמש בכמות 1
    let quantity = 1;
    if (quantityIndex !== -1) {
      // נסיון לחלץ מספר מהערך בעמודת הכמות
      const rawQuantity = row[quantityIndex];
      if (rawQuantity !== undefined && rawQuantity !== null) {
        // אם זה מחרוזת, ננסה להמיר למספר
        if (typeof rawQuantity === 'string') {
          // מחליף פסיק בנקודה (במקרה של מספרים עשרוניים בפורמט עברי)
          const normalizedQuantity = rawQuantity.replace(',', '.');
          quantity = parseFloat(normalizedQuantity) || 1;
        } else if (typeof rawQuantity === 'number') {
          quantity = rawQuantity;
        }
        
        // וידוא שהכמות היא מספר חיובי
        quantity = quantity > 0 ? quantity : 0;
      }
    }
    
    const productLink = linkIndex !== -1 ? row[linkIndex] : '';
    const productId = productIdIndex !== -1 ? row[productIdIndex] : '';
    const retailerProductId = retailerProductIdIndex !== -1 ? row[retailerProductIdIndex] : '';
    
    return {
      name: productName,
      barcode,
      quantity,
      productId,
      retailerProductId,
      link: productLink
    };
  }).filter(product => product.name || product.productId || product.retailerProductId);
}

export default {
  exportToCsv,
  parseCSV,
  prepareImportData
}; 