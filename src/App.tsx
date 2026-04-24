import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { CaveDetailPage } from './pages/CaveDetailPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cave/:id" element={<CaveDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
