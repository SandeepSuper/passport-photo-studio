import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { removeBackground, preload } from '@imgly/background-removal';
import { Upload, Scissors, Wand2, Image as ImageIcon, Printer, Grid, RefreshCw, Check, CreditCard, User, LogOut, Camera, Loader2, Share2, Download } from 'lucide-react';
import getCroppedImg from './canvasUtils';
import './index.css';

// AWS API Gateway URL for Razorpay handling
const API_URL = 'https://ihdzz1fxmg.execute-api.ap-south-1.amazonaws.com';

// ====== PRICING CONFIGURATION ======
// Note: Razorpay accepts amounts in paise (Multiply Rupees by 100)
// Example: ₹49 = 4900, ₹99 = 9900
const PRICE_SINGLE_DOWNLOAD = 1000; // Rs. 10
const PRICE_PRO_SUBSCRIPTION = 19900; // Rs. 199
// ===================================

// Country-wise passport photo sizes (width x height in mm)
const PHOTO_SIZES = [
    { id: 'india', flag: '🇮🇳', country: 'India', w: 35, h: 45, label: '35×45mm' },
    { id: 'usa', flag: '🇺🇸', country: 'USA', w: 50.8, h: 50.8, label: '2×2 inch' },
    { id: 'uk', flag: '🇬🇧', country: 'UK', w: 35, h: 45, label: '35×45mm' },
    { id: 'eu', flag: '🇪🇺', country: 'EU / Schengen', w: 35, h: 45, label: '35×45mm' },
    { id: 'china', flag: '🇨🇳', country: 'China', w: 33, h: 48, label: '33×48mm' },
    { id: 'canada', flag: '🇨🇦', country: 'Canada', w: 50, h: 70, label: '50×70mm' },
    { id: 'australia', flag: '🇦🇺', country: 'Australia', w: 35, h: 45, label: '35×45mm' },
    { id: 'uae', flag: '🇦🇪', country: 'UAE', w: 40, h: 60, label: '40×60mm' },
    { id: 'ksa', flag: '🇸🇦', country: 'Saudi Arabia', w: 40, h: 60, label: '40×60mm' },
    { id: 'japan', flag: '🇯🇵', country: 'Japan', w: 35, h: 45, label: '35×45mm' },
];

const STEPS = [
    { id: 1, name: 'Upload', icon: Upload },
    { id: 2, name: 'Crop', icon: Scissors },
    { id: 3, name: 'Enhance', icon: Wand2 },
    { id: 4, name: 'Background', icon: ImageIcon },
    { id: 5, name: 'Generate', icon: Grid },
    { id: 6, name: 'Download', icon: Printer },
];

function App() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [bgProgress, setBgProgress] = useState(0); // 0-100 for background removal

    // Data
    const [originalImage, setOriginalImage] = useState(null);
    const [croppedImage, setCroppedImage] = useState(null);
    const [enhancedImage, setEnhancedImage] = useState(null);
    const [bgRemovedImage, setBgRemovedImage] = useState(null);
    const [sheetImage, setSheetImage] = useState(null);

    // Crop State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [selectedSize, setSelectedSize] = useState('india');
    const [aspect, setAspect] = useState(35 / 45);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Update aspect ratio when size changes
    useEffect(() => {
        const size = PHOTO_SIZES.find(s => s.id === selectedSize);
        if (size) setAspect(size.w / size.h);
    }, [selectedSize]);

    // Enhance State
    const [brightness, setBrightness] = useState(100); // 100% is default
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);

    // Background State
    const [bgColor, setBgColor] = useState('#ffffff');
    const [isPaid, setIsPaid] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState('single');

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);

    // Auth State
    const [user, setUser] = useState(null); // { email, role, expiry }
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
    const [authEmail, setAuthEmail] = useState('');
    const [authPass, setAuthPass] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);

    // --- Handlers ---

    // Init Check
    useEffect(() => {
        // Check session
        const sessionEmail = localStorage.getItem('passport_session');
        if (sessionEmail) {
            const usersDB = JSON.parse(localStorage.getItem('passport_users_db') || '{}');
            const userData = usersDB[sessionEmail];
            if (userData) {
                setUser(userData);
                checkSubscription(userData);
            }
        }
    }, []);

    const checkSubscription = (userData) => {
        if (userData && userData.role === 'pro') {
            if (new Date().getTime() < userData.expiry) {
                setIsPaid(true); // Auto-grant access
            } else {
                // Expired
                alert("Your Pro Subscription has expired.");
                const updated = { ...userData, role: 'free' };
                setUser(updated);
                updateUserInDB(updated);
            }
        }
    };

    const updateUserInDB = (userData) => {
        const usersDB = JSON.parse(localStorage.getItem('passport_users_db') || '{}');
        usersDB[userData.email] = userData;
        localStorage.setItem('passport_users_db', JSON.stringify(usersDB));
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (authEmail && authPass) {
            const usersDB = JSON.parse(localStorage.getItem('passport_users_db') || '{}');
            let targetUser = usersDB[authEmail];

            if (!targetUser) {
                // Create new if signup, or auto-create for demo login if not found
                targetUser = { email: authEmail, role: 'free' };
                if (authMode === 'signup') {
                    // fresh user
                } else {
                    // allow login even if distinct (mock behavior)
                }
                usersDB[authEmail] = targetUser;
                localStorage.setItem('passport_users_db', JSON.stringify(usersDB));
            }

            // Set Session
            setUser(targetUser);
            checkSubscription(targetUser);
            localStorage.setItem('passport_session', authEmail);
            setShowAuthModal(false);
        }
    };

    const handleLogout = () => {
        setUser(null);
        setIsPaid(false); // Revoke access
        localStorage.removeItem('passport_session');
        // Do NOT clear users_db
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setShowCamera(true);
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Unable to access camera. Please allow permission.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0);
            const url = canvas.toDataURL('image/jpeg');

            setOriginalImage(url);
            setIsPaid(false);
            if (user) {
                checkSubscription(user);
            }
            stopCamera();
            setStep(2);
        }
    };

    // Preload BG removal model as soon as user reaches Enhance step
    useEffect(() => {
        if (step === 3) {
            // Silently preload ONNX model in background — makes next step instant
            preload({
                model: 'isnet_quint8',
                device: 'gpu',
            }).catch(() => {
                // Fallback silently — preload failure is non-critical
            });
        }
    }, [step]);

    // Attach stream to video element when available
    useEffect(() => {
        if (showCamera && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
    }, [showCamera, stream]);

    const onFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                const url = URL.createObjectURL(file);
                setOriginalImage(url);
                setIsPaid(false);
                if (user) {
                    checkSubscription(user);
                }
                setStep(2);
            } catch (err) {
                console.error("Error creating object URL", err);
                alert("Error processing file");
            }
        }
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
        try {
            setLoading(true);
            const cropped = await getCroppedImg(originalImage, croppedAreaPixels, rotation);
            setCroppedImage(cropped);
            setEnhancedImage(cropped); // Default enhanced is just cropped
            setStep(3);
        } catch (e) {
            console.error(e);
            alert('Failed to crop image');
        } finally {
            setLoading(false);
        }
    };

    const applyEnhancements = async () => {
        // Apply CSS filters to a canvas to burn them in
        if (!croppedImage) return;
        setLoading(true);

        try {
            const img = new Image();
            img.src = croppedImage;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Apply filters
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
            ctx.drawImage(img, 0, 0);

            const enhancedUrl = canvas.toDataURL('image/jpeg', 0.95);
            setEnhancedImage(enhancedUrl);
            setStep(4);
        } catch (e) {
            console.error(e);
            alert('Enhancement failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveBackground = async () => {
        if (!enhancedImage) return;
        setLoading(true);
        setBgProgress(5);
        setLoadingMsg('Removing Background...');

        // Simulate smooth progress since library only reports download progress (not inference)
        // Increments every 300ms, slows down as it nears 90%
        let currentProgress = 5;
        const progressInterval = setInterval(() => {
            setBgProgress(prev => {
                const remaining = 90 - prev;
                const increment = Math.max(1, Math.floor(remaining * 0.08)); // slows near 90
                currentProgress = Math.min(prev + increment, 90);
                return currentProgress;
            });
        }, 300);

        try {
            // Detect mobile/tablet: these don't support WebAssembly multi-threading
            // Using gpu+isnet_quint8 on mobile causes INVERTED mask (removes person not bg)
            const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // 1. Remove BG -> Returns Blob (PNG with transparency)
            const blob = await removeBackground(enhancedImage, {
                // On mobile: use isnet_fp16 with cpu to avoid WebAssembly threading issues
                // On desktop: use fast quantized model with GPU acceleration
                model: isMobile ? 'isnet_fp16' : 'isnet_quint8',
                device: isMobile ? 'cpu' : 'gpu',
                progress: (key, current, total) => {
                    // If library does report real download progress, use it (overrides simulation)
                    if (total > 0) {
                        const percent = 5 + Math.round((current / total) * 85);
                        setBgProgress(Math.min(percent, 90));
                        currentProgress = Math.min(percent, 90);
                    }
                }
            });
            clearInterval(progressInterval);
            setBgProgress(100); // Done!
            const transparentUrl = URL.createObjectURL(blob);

            // 2. Composite over bgColor
            const img = new Image();
            img.src = transparentUrl;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Fill BG
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw Person
            ctx.drawImage(img, 0, 0);

            setBgRemovedImage(canvas.toDataURL('image/jpeg', 0.95));
            setStep(5);
        } catch (e) {
            clearInterval(progressInterval);
            console.error(e);
            alert('Background removal failed: ' + e.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
            setBgProgress(0);
        }
    };

    const generateSheet = async () => {
        const sourceImage = bgRemovedImage || enhancedImage || croppedImage;
        if (!sourceImage) return;
        setLoading(true);

        try {
            // A4 or 4x6 inch canvas at 300 DPI
            // 4x6" = 1200x1800 px
            const dpi = 300;
            const sheetW = 6 * dpi;  // 6 inch width
            const sheetH = 4 * dpi;  // 4 inch height

            const canvas = document.createElement('canvas');
            canvas.width = sheetW;
            canvas.height = sheetH;
            const ctx = canvas.getContext('2d');

            // White Sheet
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, sheetW, sheetH);

            const img = new Image();
            img.src = sourceImage;
            await new Promise(r => img.onload = r);

            // Use selected size dimensions at 300 DPI (1mm = 11.811px at 300dpi)
            const mmToPx = 300 / 25.4;
            const activeSize = PHOTO_SIZES.find(s => s.id === selectedSize) || PHOTO_SIZES[0];
            const photoWidth = Math.round(activeSize.w * mmToPx);
            const photoHeight = Math.round(activeSize.h * mmToPx);
            const gap = 30;

            // Auto-calculate how many cols/rows fit on the sheet
            const cols = Math.floor((sheetW + gap) / (photoWidth + gap));
            const rows = Math.floor((sheetH + gap) / (photoHeight + gap));

            const startX = (sheetW - (cols * photoWidth + (cols - 1) * gap)) / 2;
            const startY = (sheetH - (rows * photoHeight + (rows - 1) * gap)) / 2;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = startX + c * (photoWidth + gap);
                    const y = startY + r * (photoHeight + gap);
                    ctx.drawImage(img, x, y, photoWidth, photoHeight);
                    ctx.strokeStyle = '#ccc';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, photoWidth, photoHeight);
                }
            }

            setSheetImage(canvas.toDataURL('image/jpeg', 1.0));
            setStep(6);
        } catch (e) {
            console.error(e);
            alert("Sheet generation failed");
        } finally {
            setLoading(false);
        }
    };

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const triggerPayment = (action) => {
        setPendingAction(action);
        setShowPaymentModal(true);
    };

    const completePayment = async () => {
        if (!window.Razorpay) {
            setLoading(true);
            setLoadingMsg("Loading Payment SDK...");
            const success = await loadRazorpay();
            if (!success) {
                setLoading(false);
                alert("Failed to load Razorpay SDK. Please check your internet connection.");
                return;
            }
        }

        setLoading(true);
        setLoadingMsg("Initializing Payment...");
        const isPro = selectedPlan === 'pro';
        const amount = isPro ? PRICE_PRO_SUBSCRIPTION : PRICE_SINGLE_DOWNLOAD;

        try {
            // 1. Fetch Order ID from AWS Lambda Backend
            const getOrderRes = await fetch(`${API_URL}/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, plan: selectedPlan })
            });

            if (!getOrderRes.ok) throw new Error("Could not create order");
            const orderData = await getOrderRes.json();

            if (!orderData.order_id || !orderData.key_id) {
                throw new Error("Invalid response from server");
            }

            setLoading(false);

            // 2. Open Razorpay Popup
            const options = {
                "key": orderData.key_id, // Key ID comes from our secure backend environment
                "amount": amount,
                "currency": "INR",
                "name": "Passport Studio",
                "description": isPro ? "Pro Subscription (Monthly)" : "Single Sheet Download",
                "image": "https://example.com/your_logo",
                "order_id": orderData.order_id, // Mandatory for secure payments!
                "handler": async function (response) {
                    try {
                        setLoading(true);
                        setLoadingMsg('Verifying Payment...');

                        // 3. Verify Payment Signature via AWS Lambda
                        const verifyRes = await fetch(`${API_URL}/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });

                        const verifyData = await verifyRes.json();

                        if (verifyRes.ok && verifyData.success) {
                            // Payment Verified Successfully!
                            if (selectedPlan === 'pro') {
                                const expiry = new Date().getTime() + (30 * 24 * 60 * 60 * 1000);
                                const updatedUser = user ? { ...user, role: 'pro', expiry } : { email: 'guest', role: 'pro', expiry };
                                setUser(updatedUser);
                                updateUserInDB(updatedUser);
                            }

                            setIsPaid(true);
                            setShowPaymentModal(false);

                            if (pendingAction === 'print') {
                                setTimeout(() => doPrint(), 500);
                            } else if (pendingAction === 'download' || pendingAction === 'download-single') {
                                if (pendingAction === 'download') downloadSheet();
                                else downloadSingle();
                            }
                            setPendingAction(null);
                        } else {
                            alert("Payment verification failed! " + verifyData.message);
                        }
                    } catch (verifyError) {
                        console.error("Verification Error:", verifyError);
                        alert("An error occurred during payment verification.");
                    } finally {
                        setLoading(false);
                        setLoadingMsg('');
                    }
                },
                "prefill": {
                    "name": "User Name",
                    "email": "user@example.com",
                    "contact": "9999999999"
                },
                "theme": { "color": "#4f46e5" },
                "modal": {
                    "ondismiss": function () {
                        setLoading(false);
                        console.log('Checkout form closed');
                    }
                }
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.code);
                console.error(response.error);
                setLoading(false);
            });
            rzp1.open();

        } catch (err) {
            console.error("Razorpay Error:", err);
            alert("Payment Gateway Initialization Error. Check if API Gateway URL is correct.");
            setLoading(false);
        }
    };

    const doPrint = () => {
        const win = window.open('');
        win.document.write(`<img src="${sheetImage}" style="width:100%; height:auto;" onload="window.print();window.close()" />`);
        win.document.close();
    }

    const downloadSheet = () => {
        if (!sheetImage) return;
        const link = document.createElement("a");
        link.href = sheetImage;
        link.download = "passport-photo-sheet.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadSingle = () => {
        const sourceImage = bgRemovedImage || enhancedImage || croppedImage;
        if (!sourceImage) return;
        const link = document.createElement("a");
        link.href = sourceImage;
        link.download = "passport-photo-single.jpg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        if (!navigator.share) {
            alert("Sharing not supported on this device/browser.");
            return;
        }

        try {
            await navigator.share({
                title: 'Passport Photo Studio',
                text: 'Create and download professional passport photos online for free!',
                url: window.location.href // Share the website URL
            });
        } catch (error) {
            console.error("Error sharing:", error);
            // Ignore abort errors (user cancelled)
            if (error.name !== 'AbortError') {
                alert("Failed to share link.");
            }
        }
    };

    const handlePrintClick = () => {
        if (isPaid) {
            doPrint();
        } else {
            triggerPayment('print');
        }
    };

    const handleDownloadClick = (e, type = 'sheet') => {
        if (!isPaid) {
            e.preventDefault();
            triggerPayment(type === 'sheet' ? 'download' : 'download-single');
        } else {
            if (type === 'sheet') downloadSheet();
            else downloadSingle();
        }
    };

    const isStepAvailable = (stepId) => {
        if (stepId === 1) return true; // Upload always avail
        if (stepId === 2) return !!originalImage; // Crop needs original
        // For 3,4,5 we just need a cropped base image
        if (stepId >= 3 && stepId <= 5) return !!croppedImage;
        if (stepId === 6) return !!sheetImage; // Print needs sheet
        return false;
    };

    const handleStepClick = (stepId) => {
        if (isStepAvailable(stepId)) {
            setStep(stepId);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden text-slate-100 font-sans bg-slate-950">
            {/* Mobile Header */}
            <header className="flex md:hidden justify-between items-center p-4 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative z-20">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-2 rounded">
                        <ImageIcon size={24} />
                    </div>
                    <span className="text-xl font-bold">Passport Studio</span>
                </div>
                {/* Mobile User Menu Trigger */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-2 rounded-full transition-colors"
                    >
                        <div className="bg-indigo-500 rounded-full p-1">
                            <User size={20} />
                        </div>
                    </button>
                    {/* Simplified Mobile Dropdown */}
                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                            {user ? (
                                <div className="py-1">
                                    <div className="px-4 py-3 border-b border-slate-700">
                                        <p className="text-sm text-white truncate">{user.email}</p>
                                    </div>
                                    <button onClick={() => { handleLogout(); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"><LogOut size={16} /> Logout</button>
                                </div>
                            ) : (
                                <div className="py-1">
                                    <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-indigo-400 hover:bg-slate-700 flex items-center gap-2"><User size={16} /> Login</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Sidebar */}
            <aside className="w-full md:w-72 bg-slate-900 border-b md:border-r border-slate-800 md:border-slate-700 p-4 md:p-6 flex-shrink-0 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible no-scrollbar">
                <div className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 mb-0 md:mb-8 whitespace-nowrap hidden md:block" aria-label="Passport Studio navigation">
                    Passport Studio
                </div>

                <div className="flex flex-row md:flex-col gap-2 min-w-max md:min-w-0">
                    {STEPS.map((s) => {
                        const Icon = s.icon;
                        const active = step === s.id;
                        const avail = isStepAvailable(s.id);
                        return (
                            <button key={s.id}
                                onClick={() => handleStepClick(s.id)}
                                disabled={!avail}
                                className={`flex items-center gap-3 p-2 md:p-3 rounded-lg transition-all text-left whitespace-nowrap ${active ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' :
                                    avail ? 'text-slate-300 hover:bg-slate-800 cursor-pointer' : 'text-slate-600 cursor-not-allowed opacity-50'
                                    }`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0 ${active ? 'border-indigo-500 bg-indigo-500 text-white' :
                                    avail ? 'border-slate-500 bg-slate-700' : 'border-slate-700 bg-slate-800'
                                    }`}>
                                    {s.id}
                                </div>
                                <span className="font-medium text-sm md:text-base">{s.name}</span>
                            </button>
                        )
                    })}
                </div>
            </aside>

            {/* Main Section Wrapper */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header (Desktop) */}
                <header className="hidden md:flex justify-between items-center p-4 md:p-6 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-2 rounded">
                            <ImageIcon size={24} />
                        </div>
                        <span className="text-xl font-bold">Passport Studio</span>
                    </div>

                    {/* User Menu Trigger */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-2 rounded-full transition-colors"
                        >
                            <div className="bg-indigo-500 rounded-full p-1">
                                <User size={20} />
                            </div>
                            {user && <span className="text-sm font-medium pr-2">{user.email.split('@')[0]}</span>}
                        </button>

                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                                {user ? (
                                    <div className="py-1">
                                        <div className="px-4 py-3 border-b border-slate-700">
                                            <p className="text-sm text-white truncate">{user.email}</p>
                                            {user.role === 'pro' ? (
                                                <span className="text-xs text-black bg-yellow-500 font-bold px-2 py-0.5 rounded inline-block mt-1">PRO PLAN</span>
                                            ) : (
                                                <span className="text-xs text-slate-400">Free Plan</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => { handleLogout(); setShowUserMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                        >
                                            <LogOut size={16} /> Logout
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        <button
                                            onClick={() => { setAuthMode('login'); setShowAuthModal(true); setShowUserMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-indigo-400 hover:bg-slate-700 flex items-center gap-2"
                                        >
                                            <User size={16} /> Login
                                        </button>
                                        <button
                                            onClick={() => { setAuthMode('signup'); setShowAuthModal(true); setShowUserMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700"
                                        >
                                            Create Account
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-950 relative w-full">
                    {loading && (
                        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center backdrop-blur-sm px-8">
                            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-4" />
                            <p className="text-2xl font-bold text-white">
                                {bgProgress > 0 ? `${bgProgress}%` : (loadingMsg || 'Processing...')}
                            </p>
                            {bgProgress > 0 && (
                                <p className="text-slate-400 text-sm mt-2">Removing Background...</p>
                            )}
                        </div>
                    )}

                    {/* Auth Modal */}
                    {showAuthModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
                                <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                                <h3 className="text-2xl font-bold mb-6 text-center">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                                        <input type="email" required className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 outline-none"
                                            value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                                        <input type="password" required className="w-full bg-slate-800 border border-slate-700 rounded p-3 text-white focus:border-indigo-500 outline-none"
                                            value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="••••••••" />
                                    </div>
                                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors">
                                        {authMode === 'login' ? 'Login' : 'Sign Up'}
                                    </button>
                                </form>
                                <p className="text-center text-sm text-slate-500 mt-4">
                                    {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                    <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-400 hover:underline">
                                        {authMode === 'login' ? 'Sign Up' : 'Login'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Payment Modal */}
                    {showPaymentModal && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative">
                                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                                <h2 className="text-3xl font-bold mb-8 text-center">Select a Plan</h2>

                                <div className="grid md:grid-cols-2 gap-6 mb-8">
                                    {/* Plan 1: Single */}
                                    <div
                                        onClick={() => setSelectedPlan('single')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'single' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'}`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-lg">Single Sheet</span>
                                            <span className="text-xl font-bold">₹{PRICE_SINGLE_DOWNLOAD / 100}</span>
                                        </div>
                                        <p className="text-slate-400 text-sm text-left">One-time processing & download</p>
                                    </div>

                                    {/* Plan 2: Pro */}
                                    <div
                                        onClick={() => setSelectedPlan('pro')}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${selectedPlan === 'pro' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'}`}
                                    >
                                        <div className="absolute -top-3 right-4 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                                            BEST VALUE
                                        </div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-lg">Pro Subscription</span>
                                            <span className="text-xl font-bold">₹{PRICE_PRO_SUBSCRIPTION / 100}</span>
                                        </div>
                                        <p className="text-slate-400 text-sm text-left">Unlimited downloads for 1 month</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (selectedPlan === 'pro' && !user) {
                                            setAuthMode('signup');
                                            setShowAuthModal(true);
                                        } else {
                                            completePayment();
                                        }
                                    }}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-95"
                                >
                                    {selectedPlan === 'pro' ? `Subscribe for ₹${PRICE_PRO_SUBSCRIPTION / 100}` : `Pay ₹${PRICE_SINGLE_DOWNLOAD / 100} Now`}
                                </button>

                                <p className="text-center text-xs text-slate-500 mt-4">
                                    Secure payment powered by Razorpay
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="max-w-4xl mx-auto">
                        {step === 1 && (
                            <div className="bg-slate-800 rounded-xl p-12 border-2 border-dashed border-slate-600 text-center hover:border-indigo-500 transition-colors">
                                <Upload size={48} className="mx-auto text-indigo-400 mb-6" />
                                <h2 className="text-3xl font-bold mb-4">Upload Photo</h2>

                                <div className="flex justify-center gap-4">
                                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-lg cursor-pointer inline-block transition-colors">
                                        Select Image
                                        <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                    </label>

                                    <button onClick={startCamera} className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-lg text-lg flex items-center gap-2 transition-colors">
                                        <Camera size={24} /> Take Photo
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Camera Modal */}
                        {showCamera && (
                            <div className="fixed inset-0 z-[70] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
                                <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden border border-slate-700">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />

                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                        <button onClick={capturePhoto} className="bg-white text-black rounded-full p-4 hover:scale-105 transition-transform shadow-lg border-4 border-slate-300">
                                            <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                                        </button>
                                        <button onClick={stopCamera} className="bg-slate-800/80 text-white px-4 py-2 rounded-lg hover:bg-slate-700 backdrop-blur-md border border-slate-600">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && originalImage && (
                            <div className="h-[80vh] flex flex-col">
                                {/* Size Selector */}
                                <div className="mb-3">
                                    <p className="text-sm text-slate-400 mb-2">Select Country / Photo Size</p>
                                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                        {PHOTO_SIZES.map(size => (
                                            <button
                                                key={size.id}
                                                onClick={() => setSelectedSize(size.id)}
                                                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-all ${selectedSize === size.id
                                                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                                                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                                                    }`}
                                            >
                                                <span className="text-xl mb-1">{size.flag}</span>
                                                <span className="font-medium text-white whitespace-nowrap">{size.country}</span>
                                                <span className="text-slate-400">{size.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-between mb-3">
                                    <h2 className="text-xl font-bold">Crop
                                        <span className="ml-2 text-sm font-normal text-indigo-400">
                                            {PHOTO_SIZES.find(s => s.id === selectedSize)?.label}
                                        </span>
                                    </h2>
                                    <button className="bg-indigo-600 px-4 py-2 rounded text-sm hover:bg-indigo-700" onClick={handleCrop}>Apply Crop</button>
                                </div>

                                <div className="relative flex-1 bg-black rounded-lg overflow-hidden border border-slate-700 mb-4">
                                    <Cropper
                                        image={originalImage}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={aspect}
                                        onCropChange={setCrop}
                                        onCropComplete={onCropComplete}
                                        onZoomChange={setZoom}
                                        rotation={rotation}
                                        objectFit="contain"
                                    />
                                </div>

                                <div className="flex items-center gap-8 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-sm text-slate-400 mb-2">Zoom</label>
                                        <input
                                            type="range" min={1} max={3} step={0.1}
                                            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                                            className="w-full accent-indigo-600"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm text-slate-400 mb-2">Rotation</label>
                                        <input
                                            type="range" min={0} max={360}
                                            value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                                            className="w-full accent-indigo-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && croppedImage && (
                            <div className="card flex flex-col items-center">
                                <h2 className="text-2xl font-bold mb-8">Enhance Photo</h2>

                                <div className="grid grid-cols-2 gap-8 w-full mb-8">
                                    <div className="bg-slate-950 p-4 rounded-lg flex items-center justify-center border border-slate-800">
                                        <img
                                            src={croppedImage}
                                            alt="Cropped passport photo preview with enhancements applied"
                                            style={{
                                                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
                                                maxHeight: '400px'
                                            }}
                                            className="shadow-xl"
                                        />
                                    </div>

                                    <div className="space-y-6 self-center">
                                        <div>
                                            <label className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-400">Brightness</span>
                                                <span>{brightness}%</span>
                                            </label>
                                            <input
                                                type="range" min="50" max="150" value={brightness}
                                                onChange={e => setBrightness(e.target.value)}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-400">Contrast</span>
                                                <span>{contrast}%</span>
                                            </label>
                                            <input
                                                type="range" min="50" max="150" value={contrast}
                                                onChange={e => setContrast(e.target.value)}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-400">Saturation</span>
                                                <span>{saturation}%</span>
                                            </label>
                                            <input
                                                type="range" min="0" max="200" value={saturation}
                                                onChange={e => setSaturation(e.target.value)}
                                                className="w-full accent-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button className="btn-primary w-full max-w-md" onClick={applyEnhancements}>
                                    Apply Enhancements
                                </button>
                            </div>
                        )}

                        {step === 4 && enhancedImage && (
                            <div className="card flex flex-col items-center">
                                <h2 className="text-2xl font-bold mb-6">Background Removal</h2>

                                <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 mb-8">
                                    <div className="relative">
                                        {/* We just show preview here, actual removal happens on click */}
                                        <img src={enhancedImage} alt="Enhanced passport photo before background removal" className="max-h-[400px] shadow-lg" />
                                        <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded text-xs backdrop-blur-md">
                                            Current Image
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mb-8">
                                    <label className="text-sm">New Background Color:</label>
                                    <input
                                        type="color"
                                        value={bgColor}
                                        onChange={e => setBgColor(e.target.value)}
                                        className="h-10 w-20 rounded cursor-pointer bg-transparent border-0"
                                    />
                                </div>

                                <button className="btn-primary w-full max-w-md flex items-center justify-center gap-2" onClick={handleRemoveBackground}>
                                    <Wand2 size={20} />
                                    <span>Remove Background & Apply Color</span>
                                </button>

                            </div>
                        )}

                        {step === 5 && (bgRemovedImage || enhancedImage || croppedImage) && (
                            <div className="card flex flex-col items-center">
                                <h2 className="text-3xl font-bold mb-2">Preview Sheet</h2>
                                <p className="text-slate-400 mb-8">
                                    Using: {bgRemovedImage ? 'Background Removed Image' : 'Original/Enhanced Image'}
                                </p>

                                <div className="p-2 bg-white rounded-lg shadow-xl mb-8 relative overflow-hidden inline-block">
                                    <img
                                        src={bgRemovedImage || enhancedImage || croppedImage}
                                        alt="Passport photo preview with background removed"
                                        className="h-64 w-auto object-cover rounded"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
                                        <div className="transform -rotate-45 text-slate-500/30 text-2xl font-black whitespace-nowrap border-2 border-slate-500/30 p-2">
                                            PASSPORT STUDIO
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full max-w-md space-y-3">
                                    <button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                                        onClick={generateSheet}
                                    >
                                        Generate 4×6 Sheet
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-colors border border-slate-700 hover:border-slate-500 flex items-center justify-center gap-2"
                                            onClick={(e) => handleDownloadClick(e, 'single')}
                                        >
                                            <Download size={18} /> Get Single Digital
                                        </button>
                                        {navigator.share && (
                                            <button
                                                className="bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold px-4 py-3 rounded-lg transition-colors border border-slate-700 hover:border-indigo-500/50 flex items-center justify-center"
                                                onClick={handleShare}
                                                title="Share Website"
                                            >
                                                <Share2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        className="w-full text-slate-400 hover:text-white text-sm py-2 mt-2 border-t border-slate-800 pt-4"
                                        onClick={() => setStep(4)}
                                    >
                                        Go Back
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 6 && !isPaid && (
                            <div className="card text-center max-w-4xl mx-auto">
                                <h2 className="text-3xl font-bold mb-6">Review & Download</h2>
                                {sheetImage && (
                                    <div className="relative mb-8 inline-block">
                                        <div className="bg-white p-2 rounded-lg shadow-2xl relative overflow-hidden">
                                            <img
                                                src={sheetImage}
                                                alt="Blurred passport photo sheet preview — purchase to download"
                                                className="max-h-[500px] w-auto block filter blur-sm transition-all duration-300"
                                            />
                                            {/* Preview Mode Badge */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="bg-black/80 text-white px-6 py-2 rounded-full text-sm font-medium backdrop-blur-md border border-white/10 shadow-xl z-10">
                                                    Preview Mode
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                                        onClick={handlePrintClick}
                                    >
                                        <Printer size={20} /> Print Sheet
                                    </button>
                                    <button
                                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
                                        onClick={(e) => handleDownloadClick(e, 'sheet')}
                                    >
                                        <CreditCard size={20} /> Buy Sheet
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 6 && isPaid && (
                            <div className="card text-center">
                                <h2 className="text-3xl font-bold m-0 mb-2">Payment Successful!</h2>
                                <p className="text-green-400 mb-8">Your passport photo sheet is ready.</p>

                                <div className="inline-block p-4 bg-white rounded shadow-2xl mb-8 border border-slate-200">
                                    <img src={sheetImage} alt="Print-ready 4x6 passport photo sheet with 8 photos" className="max-h-[400px] w-auto block" />
                                </div>

                                <div className="flex flex-wrap justify-center gap-4">
                                    <button className="btn-primary px-6 py-3 text-lg flex items-center gap-2" onClick={handlePrintClick}>
                                        <Printer /> Print Sheet
                                    </button>
                                    <button onClick={(e) => handleDownloadClick(e, 'sheet')} className="btn-secondary px-6 py-3 text-lg flex items-center gap-2">
                                        <Download /> Download Sheet
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </main >
            </div >
        </div >
    );
}

export default App;
