import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import './index.css'

function Root() {
    // Persist view in sessionStorage — so refresh keeps user in studio, not landing page
    const [view, setView] = useState(() => sessionStorage.getItem('pp_view') || 'landing')
    const [theme, setTheme] = useState(localStorage.getItem('passport_theme') || 'dark')
    const [themeColor, setThemeColor] = useState(localStorage.getItem('passport_color') || 'indigo')

    // Navigate to studio and save view
    const goToApp = () => {
        sessionStorage.setItem('pp_view', 'app')
        setView('app')
    }

    // Navigate home — clear ALL studio session data so next session starts fresh
    const goHome = () => {
        const keysToRemove = [
            'pp_view', 'pp_step',
            'pp_originalImage', 'pp_croppedImage', 'pp_enhancedImage',
            'pp_bgRemovedImage', 'pp_sheetImage',
            'pp_secureSheetPreview', 'pp_securePhotoPreview',
            'pp_selectedSize', 'pp_brightness', 'pp_contrast', 'pp_saturation',
        ]
        keysToRemove.forEach(k => sessionStorage.removeItem(k))
        setView('landing')
    }

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
        return <LandingPage onStart={goToApp} theme={theme} toggleTheme={toggleTheme} themeColor={themeColor} setThemeColor={setThemeColor} />
    }

    return <App onHome={goHome} theme={theme} toggleTheme={toggleTheme} themeColor={themeColor} setThemeColor={setThemeColor} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
)
