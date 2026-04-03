import React, { useState } from 'react';
import { Aperture, Upload, Scissors, Wand2, Grid, ChevronRight, ShieldCheck, Printer, Sun, Moon, Palette } from 'lucide-react';

const THEME_HUES = { indigo: 0, emerald: -120, rose: 90, amber: 155 };

export default function LandingPage({ onStart, theme, toggleTheme, themeColor, setThemeColor }) {
    const [showThemeMenu, setShowThemeMenu] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            {/* Background Glow Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen opacity-50 animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen opacity-50"></div>
                <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-blue-600/10 blur-[100px] rounded-full mix-blend-screen opacity-30"></div>
            </div>

            {/* Navbar */}
            <nav className="relative z-50 flex p-6 md:px-12 items-center justify-between border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/50">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 group-hover:border-indigo-500/60 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                        <Aperture className="text-indigo-400 group-hover:rotate-180 transition-transform duration-700" size={24} />
                    </div>
                    <div className="flex flex-col leading-none">
                        <div className="flex items-center gap-1">
                            <span className="text-xl font-black tracking-tight text-white italic">photo</span>
                            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">passport.in</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    <button title="Toggle Theme" onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-800/80 text-slate-300 transition-colors border border-slate-700/50 bg-slate-900/50">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    
                    {/* Color Picker Dropdown */}
                    <div className="relative">
                        <button onClick={() => setShowThemeMenu(!showThemeMenu)} className="p-2 rounded-full hover:bg-slate-800/80 text-slate-300 transition-colors border border-slate-700/50 bg-slate-900/50">
                            <Palette size={18} />
                        </button>
                        {showThemeMenu && (
                            <div className="absolute right-0 top-full mt-2 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                                {[{ id: 'indigo', color: 'bg-[#6366f1]' },{ id: 'emerald', color: 'bg-[#10b981]' },{ id: 'rose', color: 'bg-[#f43f5e]' },{ id: 'amber', color: 'bg-[#f59e0b]' }].map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => { setThemeColor(t.id); setShowThemeMenu(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 capitalize transition-colors ${themeColor === t.id ? 'bg-slate-700 text-white font-medium' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                                    >
                                        <div 
                                            className={`w-3.5 h-3.5 rounded-full ${t.color} ${themeColor === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-700' : ''}`} 
                                            style={{ filter: theme === 'light' ? `invert(1) hue-rotate(${180 - THEME_HUES[themeColor]}deg)` : `hue-rotate(${-THEME_HUES[themeColor]}deg)` }}
                                        />
                                        {t.id}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={onStart}
                        className="hidden md:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 text-sm"
                    >
                        Open Studio
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 flex flex-col items-center">
                <div className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 md:pt-32 md:pb-24 max-w-5xl mx-auto">
                    
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span>Now with Native Mobile Gestures</span>
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] z-10 relative">
                        Perfect Passport Photos <br className="hidden md:block" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-400">
                            Powered by AI
                        </span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 font-medium z-10">
                        Create studio-quality passport, visa, and ID photos from your phone or computer. Instant AI background removal, smart cropping, and secure ready-to-print sheets in 4 simple steps.
                    </p>

                    <button 
                        onClick={onStart}
                        className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 font-bold text-white rounded-2xl overflow-hidden transition-all hover:bg-indigo-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] active:scale-95 z-20"
                    >
                        <span className="text-lg">Start Creating Now</span>
                        <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    
                    <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500 font-medium z-10">
                        <div className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-400"/> Privacy Secure</div>
                        <div className="flex items-center gap-1.5"><Printer size={16} className="text-blue-400"/> Print-ready format</div>
                    </div>

                    {/* Premium Preview Graphics */}
                    <div className="relative mt-20 md:mt-24 w-full max-w-5xl mx-auto z-20">
                        <div className="relative flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
                            
                            {/* Single Photo Card */}
                            <div className="relative group w-56 md:w-64 flex-shrink-0">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-700 group-hover:duration-200"></div>
                                <div className="relative bg-white p-3 rounded-2xl shadow-2xl transform transition-all duration-500 group-hover:-translate-y-4 group-hover:scale-[1.02] border border-slate-200">
                                    <div className="relative overflow-hidden rounded-xl">
                                        <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400&h=500" alt="Passport style portrait" className="w-full h-72 md:h-80 object-cover transform transition-transform duration-700 group-hover:scale-105" />
                                    </div>
                                    <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
                                        <span className="bg-slate-900 border border-indigo-500/50 text-white px-5 py-2 rounded-full text-sm font-bold shadow-xl">
                                            Digital File
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Plus */}
                            <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 text-slate-400 z-10 shadow-xl shrink-0 opacity-50">
                                <span className="text-2xl font-black">+</span>
                            </div>

                            {/* Sheet Card */}
                            <div className="relative group w-72 md:w-96 flex-shrink-0 mt-8 md:mt-0">
                                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-700 group-hover:duration-200"></div>
                                <div className="relative bg-white p-4 rounded-2xl shadow-2xl transform transition-all duration-500 group-hover:-translate-y-4 group-hover:scale-[1.02] border border-slate-200 h-48 md:h-64 flex flex-col items-center justify-center">
                                    <div className="grid grid-cols-4 grid-rows-2 gap-[2px] md:gap-1 w-full h-full p-1.5 md:p-2 bg-slate-50 border border-slate-200 rounded">
                                        {[...Array(8)].map((_, i) => (
                                            <div key={i} className="relative w-full h-full overflow-hidden rounded-[2px] border border-slate-300 bg-slate-200">
                                                <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100&h=125" alt="passport sheet item" className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" style={{ transitionDelay: `${i * 50}ms` }} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
                                        <span className="bg-slate-900 border border-purple-500/50 text-white px-5 py-2 rounded-full text-sm font-bold shadow-xl">
                                            4x6 Print Sheet
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>

                {/* Video Tutorial Section */}
                <section className="w-full max-w-5xl mx-auto px-6 mt-16 md:mt-24 z-20">
                    <div className="flex flex-col items-center mb-10">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Watch How It Works</h2>
                        <p className="text-slate-400 text-lg text-center max-w-2xl">See how easily you can create a perfect passport photo and print sheet in less than a minute.</p>
                    </div>
                    
                    {/* Video Player Container */}
                    <div className="relative w-full aspect-video rounded-3xl bg-slate-900 border border-slate-700/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden group flex items-center justify-center">
                        <iframe 
                            className="w-full h-full absolute inset-0 rounded-3xl" 
                            src="https://www.youtube.com/embed/osckfHXCzVg?rel=0" 
                            title="How to create passport photo on photopassport.in" 
                            frameBorder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                            allowFullScreen>
                        </iframe>
                    </div>
                </section>

                {/* How it Works Walkthrough Section */}
                <section className="w-full bg-slate-900/50 border-y border-slate-800/50 backdrop-blur-md py-24 relative z-10 mt-16 md:mt-32">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">How to Use the Studio</h2>
                            <p className="text-slate-400 text-lg">Follow these 4 simple steps to get your perfect photo in seconds.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-4 gap-6 relative">
                            {/* Connecting Line (Desktop) */}
                            <div className="hidden md:block absolute top-[45px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-purple-500/0 z-0"></div>

                            {[
                                { 
                                    icon: Upload, 
                                    title: '1. Upload Photo', 
                                    desc: 'Take a fresh selfie or upload an existing portrait photo from your device.',
                                    color: 'text-blue-400',
                                    bg: 'bg-blue-500/10 border-blue-500/20'
                                },
                                { 
                                    icon: Scissors, 
                                    title: '2. Auto-Crop', 
                                    desc: 'Select your country size and let our tool crop, rotate and scale perfectly.',
                                    color: 'text-indigo-400',
                                    bg: 'bg-indigo-500/10 border-indigo-500/20'
                                },
                                { 
                                    icon: Wand2, 
                                    title: '3. Enhance & Clear BG', 
                                    desc: 'Enhance brightness and instantly remove noisy background using smart AI.',
                                    color: 'text-purple-400',
                                    bg: 'bg-purple-500/10 border-purple-500/20'
                                },
                                { 
                                    icon: Grid, 
                                    title: '4. Download Print', 
                                    desc: 'Generate a 4x6 print-ready sheet instantly or download a single digital copy.',
                                    color: 'text-emerald-400',
                                    bg: 'bg-emerald-500/10 border-emerald-500/20'
                                }
                            ].map((step, idx) => (
                                <div key={idx} className="relative z-10 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-6 rounded-2xl hover:border-slate-600 transition-all hover:-translate-y-2 hover:shadow-2xl duration-300">
                                    <div className={`w-14 h-14 ${step.bg} border rounded-xl flex items-center justify-center mb-6`}>
                                        <step.icon size={28} className={step.color} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="py-20 w-full flex justify-center relative z-10 backdrop-blur-sm">
                    <button 
                        onClick={onStart}
                        className="bg-transparent border border-slate-600 hover:border-indigo-400 hover:text-indigo-300 text-slate-300 px-8 py-3 rounded-full font-bold transition-all"
                    >
                        Try It Yourself →
                    </button>
                </div>

                {/* Footer */}
                <footer className="w-full py-8 text-center text-slate-500 text-sm border-t border-slate-800/50 bg-slate-950/80 relative z-10">
                    <p>© {new Date().getFullYear()} PhotoPassport.in — Premium Photo Tools</p>
                </footer>
            </main>
        </div>
    );
}
