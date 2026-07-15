import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, query, orderBy, runTransaction, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7in6rCrdL5aiDoY9w8i3k3o9yQXqEWo4",
  authDomain: "myfood-6487f.firebaseapp.com",
  projectId: "myfood-6487f",
  storageBucket: "myfood-6487f.firebasestorage.app",
  messagingSenderId: "133560849575",
  appId: "1:133560849575:web:2a7aa07ef8047928beb782",
  measurementId: "G-EX8HKRZQRJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ---- DATE HELPERS ----
export function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y,m,d] = dateStr.split('-');
  return new Date(y, m-1, d).toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
}

// ---- CONFIG ----
export async function getConfig() {
  const snap = await getDoc(doc(db, "config", "menu"));
  return snap.exists() ? snap.data() : {
    masterItems: [], deliveryCharge: 30,
    upiId: "", upiName: "", shopName: "Kicken Bites"
  };
}

export async function saveConfig(data) {
  await setDoc(doc(db, "config", "menu"), data);
}

// ---- DAILY MENU ----
export async function getTodayMenu() {
  const today = getTodayDate();
  const snap = await getDoc(doc(db, "dailyMenu", today));
  return snap.exists() ? snap.data() : null;
}

export async function saveDailyMenu(dateStr, menuData) {
  await setDoc(doc(db, "dailyMenu", dateStr), menuData);
}

export async function getDailyMenu(dateStr) {
  const snap = await getDoc(doc(db, "dailyMenu", dateStr));
  return snap.exists() ? snap.data() : null;
}

export function listenToTodayMenu(callback) {
  const today = getTodayDate();
  return onSnapshot(doc(db, "dailyMenu", today), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ---- ORDERS ----
export async function placeOrder(orderData) {
  const today = getTodayDate();
  const dailyRef = doc(db, "dailyMenu", today);
  const ordersRef = collection(db, "orders");
  let newOrderId = null;

  await runTransaction(db, async (tx) => {
    const menuSnap = await tx.get(dailyRef);
    const menuData = menuSnap.exists() ? menuSnap.data() : {};
    const items = menuData.items || [];
    const updatedItems = items.map(item => {
      const ordered = (orderData.items || []).find(i => i.id === item.id);
      if (ordered && item.availableQty > 0) {
        return { ...item, availableQty: Math.max(0, item.availableQty - ordered.qty) };
      }
      return item;
    });
    tx.update(dailyRef, { items: updatedItems });
    const newRef = doc(ordersRef);
    newOrderId = newRef.id;
    tx.set(newRef, {
      ...orderData,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      date: today
    });
  });
  return newOrderId;
}

export async function confirmPayment(orderId) {
  await updateDoc(doc(db, "orders", orderId), {
    status: "confirmed", confirmedAt: new Date().toISOString()
  });
}

export async function updateOrderStatus(orderId, status) {
  await updateDoc(doc(db, "orders", orderId), {
    status, updatedAt: new Date().toISOString()
  });
}

export function listenToOrders(dateStr, callback) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(all.filter(o => o.date === dateStr));
  });
}

// ---- DELIVERY ----
export async function setDeliveryStatus(data) {
  await setDoc(doc(db, 'delivery', 'status'), data);
}

export async function getDeliveryStatus() {
  const snap = await getDoc(doc(db, 'delivery', 'status'));
  return snap.exists() ? snap.data() : null;
}

export function listenToDelivery(callback) {
  return onSnapshot(doc(db, 'delivery', 'status'), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ---- LEGACY COMPAT ----
export async function getMenu() { return getConfig(); }
export async function saveMenu(data) { return saveConfig(data); }
export function listenToMenu(callback) {
  return onSnapshot(doc(db, "config", "menu"), snap => {
    if (snap.exists()) callback(snap.data());
  });
}

// ---- EXPORT FIRESTORE HELPERS ----
export { 
  collection, onSnapshot, query, orderBy, doc, 
  updateDoc, where, setDoc, getDocs, getDoc, deleteDoc,
  addDoc
};
