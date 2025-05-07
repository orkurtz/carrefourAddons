// האזנה ללחיצה על כפתור הייצוא
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
          document.getElementById('status').textContent = 'סטטוס: ייצוא החל בדף';
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