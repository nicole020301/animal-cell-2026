import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from "firebase/database";

// const admin = require('firebase-admin');

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCoethfk2MllUQtw1nqd9X6IyJ3tCpMtkk",
    authDomain: "parallaxed-haptic-gloves.firebaseapp.com",
    databaseURL: "https://parallaxed-haptic-gloves-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "parallaxed-haptic-gloves",
    storageBucket: "parallaxed-haptic-gloves.appspot.com",
    messagingSenderId: "1018293784366",
    appId: "1:1018293784366:web:7e67d63b253ef1f421f4bf"
  };

const app = initializeApp(firebaseConfig);

// Reference to your Firebase Realtime Database
const database = getDatabase(app);

// const database = admin.database();



export function sendToFirebase(finger, value) {

    // set(ref(database, 'board1/outputs/digital/'), {
    //     12: value
    //   });

    // database.ref('board1/outputs/digital/12').set(value);
    // console.log(value)

    const databaseRef = ref(database, 'board1/outputs/Left/' + finger);

    set(databaseRef, value);
    // console.log(value);

}









// Get references to the HTML elements
// const wheelInput = document.getElementById('wheel');
// const valueDisplay = document.getElementById('value');

// // Listen for changes to the wheel input
// wheelInput.addEventListener('input', () => {
//     const value = parseInt(wheelInput.value, 10); // Parse value to an integer
//     valueDisplay.innerText = value;

//     // Send the value to Firebase
//     database.ref('board1/outputs/digital/12').set(value);
// });

// // Optionally, you can listen for changes from Firebase and update the UI
// database.ref('controlwheel').on('value', (snapshot) => {
//     const value = snapshot.val();
//     wheelInput.value = value;
//     valueDisplay.innerText = value;
// });