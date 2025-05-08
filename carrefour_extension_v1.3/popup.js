// ניהול הלשוניות
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() {
    // הסרת המחלקה 'active' מכל הלשוניות
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    // הוספת המחלקה 'active' ללשונית הנוכחית
    this.classList.add('active');
    
    // הסרת המחלקה 'active' מכל התוכן
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // הצגת התוכן הרלוונטי
    const tabName = this.getAttribute('data-tab');
    document.getElementById(tabName + '-tab').classList.add('active');
  });
});

// ===== פונקציונליות ייצוא =====
const exportStatusElement = document.getElementById('export-status');

// האזנה ללחיצה על כפתור הייצוא
document.getElementById('exportBtn').addEventListener('click', function() {
  // עדכון סטטוס
  exportStatusElement.textContent = 'סטטוס: שולח פקודה לדף...';
  
  // מציאת הלשונית הפעילה שנמצאת בדף של Carrefour
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const activeTab = tabs[0];
    console.log('Active tab URL for export:', activeTab.url);
    
    if (activeTab.url.includes('carrefour.co.il')) {
      // שליחת הודעה לסקריפט התוכן
      chrome.tabs.sendMessage(activeTab.id, {action: "exportCart"}, function(response) {
        console.log('Export response:', response);
        
        // בדיקה אם קיבלנו שגיאת תקשורת
        if (chrome.runtime.lastError) {
          console.error('Communication error:', chrome.runtime.lastError);
          exportStatusElement.textContent = 'סטטוס: שגיאה בתקשורת - מרענן דף';
          
          // אולי צריך רענון כי הסקריפט לא נטען כראוי
          setTimeout(() => {
            chrome.tabs.reload(activeTab.id);
            exportStatusElement.textContent = 'סטטוס: רענן את הדף ונסה שוב';
          }, 1000);
          return;
        }
        
        if (response && response.status === 'ok') {
          exportStatusElement.textContent = 'סטטוס: ייצוא החל בדף';
        } else {
          exportStatusElement.textContent = 'סטטוס: לא נתקבל אישור מהדף, נסה לרענן';
        }
      });
    } else {
      exportStatusElement.textContent = 'סטטוס: נא לבקר באתר Carrefour';
    }
  });
});

// ===== פונקציונליות ייבוא =====
const importZone = document.getElementById('importZone');
const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const importStatusElement = document.getElementById('import-status');
let csvData = null;

// טיפול בבחירת קבצים
importZone.addEventListener('click', () => fileInput.click());

// מניעת ברירת מחדל של גרירה כדי לאפשר drop
importZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  importZone.style.borderColor = '#f39200';
});

importZone.addEventListener('dragleave', () => {
  importZone.style.borderColor = '#ccc';
});

// קליטת קובץ בגרירה
importZone.addEventListener('drop', (e) => {
  e.preventDefault();
  importZone.style.borderColor = '#ccc';
  
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

// קליטת קובץ מבחירה רגילה
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
});

// פונקציה לטיפול בקובץ CSV שנבחר
function handleFile(file) {
  console.log('נבחר קובץ:', file.name, 'סוג:', file.type, 'גודל:', file.size);
  
  if (file.size === 0) {
    importStatusElement.textContent = 'סטטוס: שגיאה - הקובץ ריק';
    return;
  }
  
  // בדיקת סוג הקובץ
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    console.warn('סוג קובץ לא תקין:', file.type);
    importStatusElement.textContent = 'סטטוס: שגיאה - יש לבחור קובץ CSV בלבד';
    return;
  }
  
  importStatusElement.textContent = 'סטטוס: קורא את הקובץ...';
  
  const reader = new FileReader();
  reader.readAsText(file, 'UTF-8');
  
  reader.onload = (event) => {
    try {
      const csv = event.target.result;
      console.log('תוכן הקובץ (50 תווים ראשונים):', csv.substring(0, 50));
      
      if (!csv || csv.trim() === '') {
        importStatusElement.textContent = 'סטטוס: הקובץ ריק';
        importBtn.disabled = true;
        return;
      }
      
      // בדיקה בסיסית שיש פסיקים וערכים
      if (!csv.includes(',')) {
        console.error('הקובץ אינו נראה כמו CSV תקין (אין פסיקים)');
        importStatusElement.textContent = 'סטטוס: פורמט קובץ לא תקין - אין פסיקים';
        importBtn.disabled = true;
        return;
      }
      
      const results = parseCSV(csv);
      
      if (!results || results.length === 0) {
        importStatusElement.textContent = 'סטטוס: לא נמצאו נתונים בקובץ';
        importBtn.disabled = true;
        return;
      }
      
      if (results.length <= 1) { // רק כותרות, אין נתונים
        importStatusElement.textContent = 'סטטוס: הקובץ ריק או לא תקין';
        importBtn.disabled = true;
        return;
      }
      
      // בדיקת מבנה הקובץ והאם יש עמודות דרושות
      const headers = results[0];
      if (!Array.isArray(headers)) {
        console.error('הכותרות אינן מערך:', headers);
        importStatusElement.textContent = 'סטטוס: מבנה הקובץ שגוי';
        importBtn.disabled = true;
        return;
      }
      
      // בדיקה אם יש עמודות שם מוצר/קישור/ברקוד
      const hasName = headers.some(h => h.includes('שם') || h.includes('name'));
      const hasBarcode = headers.some(h => h.includes('ברקוד') || h.includes('barcode'));
      const hasLink = headers.some(h => h.includes('קישור') || h.includes('link'));
      
      if (!hasName && !hasBarcode && !hasLink) {
        console.error('חסרות עמודות חובה בקובץ:', headers);
        importStatusElement.textContent = 'סטטוס: חסרות עמודות חובה בקובץ';
        importBtn.disabled = true;
        return;
      }
      
      csvData = results;
      importStatusElement.textContent = `סטטוס: נמצאו ${results.length - 1} מוצרים, מוכן לייבוא`;
      importBtn.disabled = false;
    } catch (error) {
      console.error('שגיאה בקריאת קובץ CSV:', error);
      importStatusElement.textContent = 'סטטוס: שגיאה בקריאת הקובץ - ' + error.message;
      importBtn.disabled = true;
    }
  };
  
  reader.onerror = (error) => {
    console.error('שגיאה בקריאת הקובץ:', error);
    importStatusElement.textContent = 'סטטוס: שגיאה בקריאת הקובץ';
    importBtn.disabled = true;
  };
}

// פונקציה לפירוק קובץ CSV
function parseCSV(text) {
  // פיצול לשורות
  const lines = text.split(/\r?\n/);
  const results = [];
  
  if (lines.length === 0) return results;
  
  // פירוק הכותרות (שורה ראשונה)
  const headers = parseCSVLine(lines[0]);
  results.push(headers);
  
  console.log('CSV Headers:', headers);
  
  // פירוק שאר השורות
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const row = parseCSVLine(lines[i]);
    results.push(row);
  }
  
  console.log('Parsed CSV data:', results);
  return results;
}

// פונקציה לפירוק שורת CSV בודדת
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // אם אנחנו בתוך מרכאות וזה מרכאות כפולות, הוסף מרכאה אחת
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++;
      } else {
        // אחרת, הפוך את סטטוס המרכאות
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // אם זה פסיק מחוץ למרכאות, סיים את הערך הנוכחי
      result.push(current);
      current = '';
    } else {
      // אחרת, הוסף את התו לערך הנוכחי
      current += char;
    }
  }
  
  // הוסף את הערך האחרון
  result.push(current);
  
  return result;
}

// האזנה ללחיצה על כפתור הייבוא
importBtn.addEventListener('click', function() {
  if (!csvData || csvData.length <= 1) {
    importStatusElement.textContent = 'סטטוס: אין נתונים לייבוא';
    return;
  }
  
  importStatusElement.textContent = 'סטטוס: שולח נתונים לייבוא...';
  
  // שליחת הנתונים לתוכן הדף להוספה לעגלה
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const activeTab = tabs[0];
    console.log('Active tab URL:', activeTab.url);
    
    if (activeTab.url.includes('carrefour.co.il')) {
      // שליחת הודעה לסקריפט התוכן עם נתוני ה-CSV
      chrome.tabs.sendMessage(activeTab.id, {
        action: "importCart",
        data: csvData
      }, function(response) {
        // בדיקה האם יש chrome.runtime.lastError
        if (chrome.runtime.lastError) {
          console.error('שגיאת תקשורת:', chrome.runtime.lastError);
          importStatusElement.textContent = `סטטוס: שגיאת תקשורת - ${chrome.runtime.lastError.message}`;
          
          // נסיון מחדש - אולי צריך לרענן את הדף
          if (confirm('התוסף לא הצליח לתקשר עם הדף. האם לרענן את הדף ולנסות שוב?')) {
            chrome.storage.local.set({ 'carrefour_csv_import_data': csvData }, function() {
              chrome.tabs.reload(activeTab.id);
            });
          }
          return;
        }
        
        if (response && response.status === 'started') {
          importStatusElement.textContent = 'סטטוס: ייבוא החל, עקוב אחר ההתקדמות בדף';
        } else if (response && response.error) {
          importStatusElement.textContent = `סטטוס: שגיאה - ${response.error}`;
        } else {
          importStatusElement.textContent = 'סטטוס: לא התקבלה תשובה תקינה מהדף';
        }
      });
    } else {
      importStatusElement.textContent = 'סטטוס: נא לבקר באתר Carrefour';
      
      // אם המשתמש לא באתר, נציע לפתוח את האתר ולשמור את הנתונים
      if (confirm('יש לפתוח את אתר Carrefour כדי לייבא. האם לפתוח את האתר כעת?')) {
        // שמירת נתוני ה-CSV באחסון המקומי
        chrome.storage.local.set({ 'carrefour_csv_import_data': csvData }, function() {
          // פתיחת דף הבית של קרפור בלשונית חדשה
          chrome.tabs.create({ url: "https://www.carrefour.co.il" });
        });
      }
    }
  });
});

// בדיקת סטטוס בטעינה
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['carrefour_auth_token'], function(data) {
    if (data.carrefour_auth_token) {
      exportStatusElement.textContent = 'סטטוס: טוקן נמצא, מוכן לייצוא';
    } else {
      exportStatusElement.textContent = 'סטטוס: טרם זוהה טוקן, נא לבקר באתר Carrefour';
    }
  });
}); 