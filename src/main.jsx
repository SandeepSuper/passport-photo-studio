import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import './index.css'

function Root() {
    const [view, setView] = useState('landing')
    const [theme, setTheme] = useState(localStorage.getItem('passport_theme') || 'dark')

    const [themeColor, setThemeColor] = useState(localStorage.getItem('passport_color') || 'indigo')

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme')
        } else {
            document.documentElement.classList.remove('light-theme')
        }
        localStorage.setItem('passport_theme', theme)
    }, [theme])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeColor)
        localStorage.setItem('passport_color', themeColor)
    }, [themeColor])

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

    if (view === 'landing') {
        return <LandingPage onStart={() => setView('app')} theme={theme} toggleTheme={toggleTheme} themeColor={themeColor} setThemeColor={setThemeColor} />
    }

    return <App onHome={() => setView('landing')} theme={theme} toggleTheme={toggleTheme} themeColor={themeColor} setThemeColor={setThemeColor} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
)
