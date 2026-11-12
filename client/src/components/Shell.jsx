import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Shell() {
  const { user, signOut } = useAuth();
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { api('/exams').then((d) => setExams(d.exams)).catch(() => {}); }, []);

  return (
    <div className="app-shell">
      <header className="app-nav">
        <NavLink to="/" end className="app-brand"><b>B</b><span>BankExams<strong>Pro</strong></span></NavLink>
        <nav className="app-links">
          <NavLink to="/" end>Dashboard</NavLink>
          {exams.map((e) => (
            <NavLink key={e.id} to={`/exam/${e.id}`}>
              <span>{e.name}</span>
            </NavLink>
          ))}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="app-user"><span><b>{user?.name}</b><small>{user?.role === 'admin' ? 'Administrator' : user?.email}</small></span><button onClick={() => { signOut(); navigate('/sign-in'); }}>Sign out</button></div>
      </header>
      <main className="app-main"><Outlet /></main>
      <footer className="app-footer"><span>© {new Date().getFullYear()} BankExamsPro. All rights reserved.</span><span>Banking exam preparation</span></footer>
    </div>
  );
}
