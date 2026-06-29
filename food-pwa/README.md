# 🍽️ Daily Food Order PWA — Setup Guide

## Files in this package
- `index.html` — Home page (share this link)
- `customer.html` — Customer ordering page (share THIS on WhatsApp)
- `admin.html` — Owner dashboard (only you and your wife use this)
- `src/utils/firebase.js` — Database connection (needs your Firebase details)
- `manifest.json` + `sw.js` — PWA support (installable on phone)

---

## STEP 1 — Create Firebase Project (FREE, 5 minutes)

1. Go to **https://console.firebase.google.com**
2. Click **"Create a project"** → Give any name → Continue
3. Click **"Web"** icon (`</>`) to add a web app
4. Register the app → **Copy the firebaseConfig object**
5. Open `src/utils/firebase.js` and **replace** the config at the top:

```javascript
const firebaseConfig = {
  apiKey: "PASTE_YOUR_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  ...
};
```

6. In Firebase Console → **Build → Firestore Database → Create database**
   - Choose "Start in test mode" (fine for now)
   - Pick any location (e.g., asia-south1 for India)

---

## STEP 2 — Deploy to Internet (FREE, 5 minutes)

### Option A: Netlify (Easiest)
1. Go to **https://netlify.com** → Sign up free
2. Drag and drop the entire `food-pwa` folder onto Netlify
3. You get a URL like: `https://your-shop.netlify.app`
4. Share `https://your-shop.netlify.app/customer.html` on WhatsApp!

### Option B: Vercel
1. Go to **https://vercel.com** → Sign up with GitHub
2. Upload project → Deploy
3. Same result — free URL

---

## STEP 3 — First Time Setup (Admin Dashboard)

1. Open `your-url.netlify.app/admin.html`
2. Login with password: **1234**
3. Go to **⚙️ Settings tab**:
   - Enter your **Shop Name** (e.g., "Maa Ki Rasoi")
   - Enter your **UPI ID** (e.g., 9876543210@paytm)
   - Enter your **UPI Name** (your name as it appears in UPI)
   - Change the **password** to something only you know
4. Go to **🍛 Menu tab**:
   - Add today's 2-3 items with name, emoji, price, description
   - Set delivery charge
   - Toggle "Accept orders today" = ON
   - Click **Save & Publish**

---

## STEP 4 — Daily Routine

**Every morning:**
1. Open admin.html → Menu tab
2. Delete old items, add today's items
3. Toggle "Open" = ON → Save
4. Copy `customer.html` link → Post on WhatsApp group with menu

**During the day:**
- Admin dashboard auto-refreshes with new orders
- Confirm each order after payment comes
- Print kitchen list → give to kitchen
- Print delivery list → give to delivery boy
- Mark delivered when done

**Evening:**
- Toggle "Open" = OFF (no more orders)

---

## How Payment Works (UPI QR)

1. Customer selects items → clicks "Proceed to Pay"
2. A **QR code** is shown with your UPI ID pre-filled with exact amount
3. Customer scans in any UPI app (GPay, PhonePe, Paytm)
4. Customer clicks **"I have paid"** → order is confirmed in dashboard
5. **You must verify** the payment in your UPI app before delivering

> ⚠️ Since this uses manual confirmation, always check your UPI app
> before dispatching orders.

---

## Firestore Security Rules (Important!)
After testing, update your Firestore rules to protect your data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      allow create: if true;
      allow read, update: if true; // Tighten this later
    }
    match /config/{doc} {
      allow read: if true;
      allow write: if true; // Use Firebase Auth later for production
    }
  }
}
```

---

## Cost
- Firebase: **FREE** (up to 20,000 writes/day — more than enough)
- Netlify/Vercel hosting: **FREE**
- UPI payments: **FREE** (no transaction fee for UPI)
- **Total monthly cost: ₹0**

---

## Support
Built as a custom PWA. If you need help with setup, 
ask Claude at claude.ai with your specific error.
