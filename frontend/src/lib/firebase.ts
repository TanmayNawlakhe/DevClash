import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAyVyvKTqHa3ncnrk9yCLgy6K851xLAUTA',
  authDomain: 'devclash-eff29.firebaseapp.com',
  projectId: 'devclash-eff29',
  storageBucket: 'devclash-eff29.firebasestorage.app',
  messagingSenderId: '281399126786',
  appId: '1:281399126786:web:1465707b7efbaf39ed701b',
  measurementId: 'G-109B21L5DF',
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)

if (typeof window !== 'undefined') {
  void isSupported().then((supported) => {
    if (supported) {
      getAnalytics(firebaseApp)
    }
  })
}
