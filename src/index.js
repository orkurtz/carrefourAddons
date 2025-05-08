/**
 * index.js - מייצא את כל הרכיבים המרכזיים של האפליקציה לשימוש קל
 */

// ייצוא תצורה וכלי עזר
export { default as CONFIG } from './utils/config';
export * from './utils/helpers';

// ייצוא שירותי API
export * from './api/cartService';

// ייצוא שירותי נתונים
export * from './data/csvService';

// ייצוא רכיבי ממשק משתמש
export * from './ui/uiComponents';

// ייצוא פעולות עגלה
export * from './services/cartOperations'; 