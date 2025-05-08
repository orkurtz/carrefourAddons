// מעקב אחר בקשות HTTP לשרת Carrefour כדי לחלץ טוקן וכותרות
chrome.webRequest.onSendHeaders.addListener(
  function(details) {
    console.log('API request detected:', details.url);
    
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
        
        console.log('Found cart details:', cartDetails);
        
        // חיפוש כותרת Authorization
        let authToken = '';
        let xAuthToken = '';
        
        for (let i = 0; i < details.requestHeaders.length; i++) {
          const headerName = details.requestHeaders[i].name.toLowerCase();
          if (headerName === 'authorization') {
            authToken = details.requestHeaders[i].value.replace('Bearer ', '');
          } 
          else if (headerName === 'x-auth-token') {
            xAuthToken = details.requestHeaders[i].value;
          }
        }
        
        // שמירת הנתונים לשימוש עתידי
        if (authToken) {
          console.log('Found auth token:', authToken.substring(0, 10) + '...');
          chrome.storage.local.set({
            'carrefour_auth_token': authToken,
            'carrefour_cart_details': cartDetails
          });
        }
        
        if (xAuthToken) {
          console.log('Found X-Auth-Token:', xAuthToken.substring(0, 10) + '...');
          chrome.storage.local.set({
            'carrefour_token': xAuthToken
          });
        }
      }
    } 
    else if (details.url.includes('/api/v1/cart/')) {
      // בדיקת בקשות ל-API האחר של העגלה שמשתמש ב-X-Auth-Token
      console.log('Cart API call detected');
      
      // חיפוש כותרת X-Auth-Token
      for (let i = 0; i < details.requestHeaders.length; i++) {
        if (details.requestHeaders[i].name.toLowerCase() === 'x-auth-token') {
          const token = details.requestHeaders[i].value;
          console.log('Found X-Auth-Token in cart API:', token.substring(0, 10) + '...');
          
          // שמירת הטוקן לשימוש עתידי
          chrome.storage.local.set({
            'carrefour_token': token
          });
          break;
        }
      }
    }
  },
  { urls: ["https://www.carrefour.co.il/*"] },
  ["requestHeaders"]
);

// האזנה להודעות מסקריפט התוכן
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background script received message:', request.action);
  
  if (request.action === "getCartData") {
    // שליפת נתונים שנשמרו
    chrome.storage.local.get(['carrefour_auth_token', 'carrefour_cart_details', 'carrefour_token'], function(data) {
      console.log('Sending cart data to content script', {
        hasAuthToken: !!data.carrefour_auth_token,
        hasCartDetails: !!data.carrefour_cart_details,
        hasXAuthToken: !!data.carrefour_token
      });
      
      // בדיקה אם יש לנו את כל הנתונים הדרושים
      if (!data.carrefour_auth_token) {
        console.warn('Missing auth token');
      }
      if (!data.carrefour_cart_details) {
        console.warn('Missing cart details');
      }
      if (!data.carrefour_token) {
        console.warn('Missing X-Auth-Token');
      }
      
      sendResponse(data);
    });
    return true; // לאפשר שליחת תשובה אסינכרונית
  }
}); 