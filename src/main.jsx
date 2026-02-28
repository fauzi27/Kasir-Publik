import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './css/style.css' // Memanggil Tailwind dan CSS kustom kita
// Cek cache Dark Mode
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark');
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
