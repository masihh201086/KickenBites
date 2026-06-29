import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, getDoc, query, orderBy, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

export async function getMenu() {
  const snap = await getDoc(doc(db, "config", "menu"));
  return snap.exists() ? snap.data() : {
    items: [], masterItems: [], deliveryCharge: 30,
    upiId: "", upiName: "", shopName: "Kicken Bites", isOpen: false
  };
}

export async function saveMenu(menuData) {
  await setDoc(doc(db, "config", "menu"), menuData);
}

// Place order AND atomically decrement stock in one transaction
export async function placeOrder(orderData) {
  const menuRef = doc(db, "config", "menu");
  const ordersRef = collection(db, "orders");
  let newOrderId = null;

  await runTransaction(db, async (tx) => {
    const menuSnap = await tx.get(menuRef);
    const menuData = menuSnap.exists() ? menuSnap.data() : {};
    const masterItems = menuData.masterItems || menuData.items || [];

    // Check stock and decrement
    const updatedItems = masterItems.map(item => {
      const ordered = (orderData.items || []).find(i => i.id === item.id);
      if (ordered && item.availableQty > 0) {
        const newQty = Math.max(0, item.availableQty - ordered.qty);
        return { ...item, availableQty: newQty };
      }
      return item;
    });

    tx.update(menuRef, { masterItems: updatedItems, items: updatedItems });

    // Add order doc (we can't use addDoc in transaction, use doc with auto id)
    const newRef = doc(ordersRef);
    newOrderId = newRef.id;
    tx.set(newRef, {
      ...orderData,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      date: new Date().toLocaleDateString("en-IN")
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

export function listenToOrders(callback) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Live listener for menu changes (so customer page updates in real time)
export function listenToMenu(callback) {
  return onSnapshot(doc(db, "config", "menu"), snap => {
    if (snap.exists()) callback(snap.data());
  });
}

export { collection, onSnapshot, query, orderBy, doc, updateDoc };
