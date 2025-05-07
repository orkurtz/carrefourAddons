# מבנה הרחבת הדפדפן ל-Carrefour CSV Exporter

הרחבת הדפדפן תכלול את הקבצים הבאים:

## 1. manifest.json
הקובץ הראשי שמגדיר את ההרחבה עבור הדפדפן.

```json
{
  "manifest_version": 3,
  "name": "Carrefour Cart CSV Exporter",
  "version": "1.0",
  "description": "ייצוא עגלת הקניות של Carrefour לקובץ CSV בלחיצה אחת",
  "permissions": [
    "webRequest",
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://www.carrefour.co.il/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.carrefour.co.il/cart/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    }
  },
  "icons": {
    "16": "images/icon16.png",
    "48": "images/icon48.png",
    "128": "images/icon128.png"
  }
}
```

## 2. background.js
סקריפט רקע שרץ מאחורי הקלעים ומאזין לבקשות רשת.

```javascript
// מעקב אחר בקשות HTTP לשרת Carrefour כדי לחלץ טוקן וכותרות
chrome.webRequest.onSendHeaders.addListener(
  function(details) {
    // בודק אם זו בקשה רלוונטית ל-API של העגלה
    if (details.url.includes('/v2/retailers/') && details.url.includes('/carts/')) {
      // חילוץ הנתיבים מה-URL
      const url = new URL(details.url);
      const pathSegments = url.pathname.split('/');
      
      // מציאת פרמטרי API ושמירתם
      if (pathSegments.length >= 8) {
        const cartDetails = {
          retailerId: pathSegments[3],
          branchId: pathSegments[5],
          cartId: pathSegments[7].split('?')[0],
          appId: url.searchParams.get('appId') || '4'
        };
        
        // חיפוש כותרת Authorization
        let authToken = '';
        for (let i = 0; i < details.requestHeaders.length; i++) {
          if (details.requestHeaders[i].name.toLowerCase() === 'authorization') {
            authToken = details.requestHeaders[i].value.replace('Bearer ', '');
            break;
          }
        }
        
        // שמירת הנתונים לשימוש עתידי
        if (authToken) {
          chrome.storage.local.set({
            'carrefour_auth_token': authToken,
            'carrefour_cart_details': cartDetails
          });
        }
      }
    }
  },
  { urls: ["https://www.carrefour.co.il/*"] },
  ["requestHeaders"]
);

// האזנה להודעות מסקריפט התוכן
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getCartData") {
    // שליפת נתונים שנשמרו
    chrome.storage.local.get(['carrefour_auth_token', 'carrefour_cart_details'], function(data) {
      sendResponse(data);
    });
    return true; // לאפשר שליחת תשובה אסינכרונית
  }
});
```

## 3. content.js
סקריפט שרץ בדף העגלה של Carrefour ומוסיף כפתור ייצוא.

```javascript
// בדיקה אם אנחנו בדף העגלה של Carrefour
if (window.location.href.includes('/cart')) {
  // הוספת כפתור הייצוא לדף
  function addExportButton() {
    if (document.getElementById('carrefour-export-csv')) {
      return;
    }
    
    const button = document.createElement('button');
    button.id = 'carrefour-export-csv';
    button.textContent = 'ייצא לקובץ CSV';
    button.style.position = 'fixed';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#f39200'; // צבע קרפור
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = 'bold';
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    
    document.body.appendChild(button);
    
    button.addEventListener('click', exportCartToCsv);
  }

  // פונקציית הייצוא לCSV
  async function exportCartToCsv() {
    try {
      // עדכון הכפתור למצב טעינה
      const button = document.getElementById('carrefour-export-csv');
      if (button) {
        button.disabled = true;
        button.textContent = 'טוען...';
        button.style.backgroundColor = '#aaa';
      }
      
      // בקשת מידע מסקריפט הרקע
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({action: "getCartData"}, response => {
          resolve(response);
        });
      });
      
      if (!data || !data.carrefour_auth_token || !data.carrefour_cart_details) {
        alert('לא נמצאו נתוני עגלה או טוקן אימות. נסה לרענן את הדף ולנסות שוב.');
        resetButton();
        return;
      }
      
      const authToken = data.carrefour_auth_token;
      const cartDetails = data.carrefour_cart_details;
      
      // בניית URL לבקשה
      const apiUrl = `https://www.carrefour.co.il/v2/retailers/${cartDetails.retailerId}/branches/${cartDetails.branchId}/carts/${cartDetails.cartId}?appId=${cartDetails.appId}`;
      
      // ביצוע הבקשה
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Authorization": `Bearer ${authToken}`,
          "Accept": "application/json, text/plain, */*",
          "X-HTTP-Method-Override": "PATCH"
        },
        credentials: "include",
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`שגיאת API: ${response.status} ${response.statusText}`);
      }
      
      const raw = await response.json();
      
      // עיבוד התשובה
      const lines = raw.cart.lines;
      
      if (!lines || lines.length === 0) {
        alert('העגלה ריקה או שלא התקבל מידע');
        resetButton();
        return;
      }

      const result = lines
        .filter(item => !item.text.includes("איסוף עצמי")) // דילוג על מוצרים לא רלוונטיים
        .map(item => ({
          שם: item.text,
          ברקוד: item.barcode,
          כמות: item.quantity,
          מחיר: item.unitPrice,
          'סה"כ': item.totalPrice,
          קישור: `https://www.carrefour.co.il/?catalogProduct=${item.product?.productId ?? ''}`
        }));

      // יצירת קובץ CSV
      const headers = Object.keys(result[0]).join(',');
      const rows = result.map(obj => Object.values(obj).map(val =>
        `"${String(val).replace(/"/g, '""')}"`
      ).join(','));
      const csvContent = [headers, ...rows].join('\n');

      // הורדת הקובץ
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "carrefour_products.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      resetButton("ייצוא הושלם!");
      
      setTimeout(() => {
        resetButton();
      }, 2000);
      
    } catch (error) {
      console.error("שגיאה:", error);
      alert(`שגיאה: ${error.message}`);
      resetButton();
    }
  }
  
  function resetButton(text = 'ייצא לקובץ CSV') {
    const button = document.getElementById('carrefour-export-csv');
    if (button) {
      button.disabled = false;
      button.textContent = text;
      button.style.backgroundColor = '#f39200';
    }
  }
  
  // הוספת הכפתור כשהדף נטען
  addExportButton();
}
```

## 4. popup.html
חלון קופץ שמופיע בלחיצה על אייקון ההרחבה.

```html
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Carrefour Cart Exporter</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      width: 280px;
      padding: 10px;
      text-align: right;
    }
    .header {
      font-weight: bold;
      margin-bottom: 10px;
      color: #f39200;
    }
    button {
      background-color: #f39200;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      margin-top: 10px;
    }
    button:hover {
      background-color: #e58a00;
    }
    .status {
      margin-top: 10px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">Carrefour Cart CSV Exporter</div>
  <div>כלי לייצוא עגלת הקניות של Carrefour לקובץ CSV</div>
  
  <div class="status" id="status">
    סטטוס: מוכן לייצוא
  </div>
  
  <button id="exportBtn">ייצא עגלה ל-CSV</button>
  
  <script src="popup.js"></script>
</body>
</html>
```

## 5. popup.js
הסקריפט שמטפל באינטראקציה עם החלון הקופץ.

```javascript
document.getElementById('exportBtn').addEventListener('click', function() {
  // עדכון סטטוס
  document.getElementById('status').textContent = 'סטטוס: שולח פקודה לדף...';
  
  // מציאת הלשונית הפעילה שנמצאת בדף של Carrefour
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const activeTab = tabs[0];
    if (activeTab.url.includes('carrefour.co.il')) {
      // שליחת הודעה לסקריפט התוכן
      chrome.tabs.sendMessage(activeTab.id, {action: "exportCart"}, function(response) {
        if (response && response.status === 'ok') {
          document.getElementById('status').textContent = 'סטטוס: ייצוא בוצע בהצלחה';
        } else {
          document.getElementById('status').textContent = 'סטטוס: נא לעבור לדף העגלה של Carrefour';
        }
      });
    } else {
      document.getElementById('status').textContent = 'סטטוס: נא לבקר באתר Carrefour';
    }
  });
});

// בדיקת סטטוס בטעינה
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['carrefour_auth_token'], function(data) {
    if (data.carrefour_auth_token) {
      document.getElementById('status').textContent = 'סטטוס: טוקן נמצא, מוכן לייצוא';
    } else {
      document.getElementById('status').textContent = 'סטטוס: טרם זוהה טוקן, נא לבקר באתר Carrefour';
    }
  });
});
``` 