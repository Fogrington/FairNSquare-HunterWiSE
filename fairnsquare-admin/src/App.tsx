import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminProvider, useAdmin } from './context/AdminContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Judges from './pages/Judges'
import Categories from './pages/Categories'
import Results from './pages/Results'
import './App.css'

function AppShell() {
  const { admin } = useAdmin()

  if (!admin) return <Login />

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/judges" element={<Judges />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/results" element={<Results />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AdminProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AdminProvider>
  )
}
