import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, query, orderBy, runTransaction, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7in6rCrdL5aiDoY9w8i3k3o9yQXqEWo4",
  authDomain: "myfood-6487f.firebaseapp.com",
  projectId: "myfood-6487f",
  storageBucket: "myfood-6487f.firebasestorage.app",
  messagingSenderId: "133560849575",
  appId: "1:133560849575:web:2a7aa07ef8047928beb782"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y,m,d] = dateStr.split('-');
  return new Date(y,m-1,d).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

export async function getConfig() {
  const snap = await getDoc(doc(db,"config","menu"));
  return snap.exists() ? snap.data() : { masterItems:[], deliveryCharge:30, upiId:"", upiName:"", shopName:"Kicken Bites" };
}
export async function saveConfig(data) { await setDoc(doc(db,"config","menu"),data); }

export async function getTodayMenu() {
  const snap = await getDoc(doc(db,"dailyMenu",getTodayDate()));
  return snap.exists() ? snap.data() : null;
}
export async function saveDailyMenu(dateStr,data) { await setDoc(doc(db,"dailyMenu",dateStr),data); }
export async function getDailyMenu(dateStr) {
  const snap = await getDoc(doc(db,"dailyMenu",dateStr));
  return snap.exists() ? snap.data() : null;
}
export function listenToTodayMenu(callback) {
  return onSnapshot(doc(db,"dailyMenu",getTodayDate()),snap=>callback(snap.exists()?snap.data():null));
}

export async function placeOrder(orderData) {
  const today = getTodayDate();
  const dailyRef = doc(db,"dailyMenu",today);
  const ordersRef = collection(db,"orders");
  let newOrderId = null;
  await runTransaction(db, async tx => {
    const menuSnap = await tx.get(dailyRef);
    const md = menuSnap.exists() ? menuSnap.data() : {};
    const updatedItems = (md.items||[]).map(item => {
      const ord = (orderData.items||[]).find(i=>i.id===item.id);
      if (ord && item.availableQty > 0) return {...item, availableQty: Math.max(0, item.availableQty - ord.qty)};
      return item;
    });
    tx.update(dailyRef, {items: updatedItems});
    const newRef = doc(ordersRef);
    newOrderId = newRef.id;
    tx.set(newRef, {...orderData, status:"pending_payment", createdAt:new Date().toISOString(), date:today});
  });
  return newOrderId;
}

export async function confirmPayment(orderId) {
  await updateDoc(doc(db,"orders",orderId),{status:"confirmed",confirmedAt:new Date().toISOString()});
}
export async function updateOrderStatus(orderId,status,extra={}) {
  await updateDoc(doc(db,"orders",orderId),{status,...extra,updatedAt:new Date().toISOString()});
}
export function listenToOrders(dateStr,callback) {
  const q = query(collection(db,"orders"),orderBy("createdAt","desc"));
  return onSnapshot(q,snap=>{
    callback(snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>o.date===dateStr));
  });
}

// Ratings
export async function submitRating(orderId, itemId, rating, review) {
  await setDoc(doc(db,"ratings",`${orderId}_${itemId}`),{
    orderId, itemId, rating, review, createdAt:new Date().toISOString(), hidden:false
  });
}
export function listenToItemRatings(itemId, callback) {
  const q = query(collection(db,"ratings"),where("itemId","==",itemId),where("hidden","==",false));
  return onSnapshot(q,snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()}))));
}

// Delivery
export async function setDeliveryStatus(data) { await setDoc(doc(db,"delivery","status"),data); }
export function listenToDelivery(callback) {
  return onSnapshot(doc(db,"delivery","status"),snap=>callback(snap.exists()?snap.data():null));
}

// Legacy
export async function getMenu() { return getConfig(); }
export async function saveMenu(data) { return saveConfig(data); }
export function listenToMenu(cb) {
  return onSnapshot(doc(db,"config","menu"),snap=>{if(snap.exists())cb(snap.data());});
}

export { collection, onSnapshot, query, orderBy, doc, updateDoc, where, setDoc, getDocs, getDoc, deleteDoc, addDoc };
