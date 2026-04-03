import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { removeBackground, preload } from '@imgly/background-removal';
import { Upload, Scissors, Wand2, Image as ImageIcon, Printer, Grid, RefreshCw, Check, CreditCard, User, LogOut, Camera, Loader2, Share2, Download, Aperture, Sun, Moon, Palette, Lock } from 'lucide-react';
import getCroppedImg from './canvasUtils';
import './index.css';
import { auth, db, googleProvider } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import fpPromise from '@fingerprintjs/fingerprintjs';

// Initialize the fingerprint agent at application startup.
const fpInstancePromise = fpPromise.load();

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

const CROP_ASPECTS = [
    { label: '3.5 x 4.5 cm', value: 3.5 / 4.5 },
    { label: '2 x 2 inch', value: 1 },
    { label: '4 x 6 cm', value: 4 / 6 }
];

const THEME_HUES = { indigo: 0, emerald: -120, rose: 90, amber: 155 };

// ------- Reusable Protected Image Component -------
// Prevents right-click save, drag-save, and adds prominent tiled watermarks.
function ProtectedImage({ src, alt, className = '', isPro = false }) {
    const blockAction = (e) => e.preventDefault();
    // Generate a dense grid of watermark stamp positions
    const positions = [];
    for (let top = 8; top <= 105; top += 22) {
        for (let left = 5; left <= 105; left += 28) {
            positions.push({ top: `${top}%`, left: `${left}%` });
        }
    }

    // Outer wrapper rotated -30deg; inner text is two lines stacked
    const wrapperStyle = {
        transform: 'rotate(-30deg)',
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1.15,
    };
    const line1Style = {
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.12em',
        color: 'rgba(190,190,200,0.50)',
        textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        whiteSpace: 'nowrap',
        fontFamily: 'Arial, sans-serif',
        textTransform: 'capitalize',
    };
    const line2Style = {
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.12em',
        color: 'rgba(190,190,200,0.50)',
        textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        whiteSpace: 'nowrap',
        fontFamily: 'Arial, sans-serif',
    };
    return (
        <div className="relative inline-block select-none overflow-hidden" style={{ lineHeight: 0 }}>
            <img
                src={src}
                alt={alt}
                draggable={false}
                onContextMenu={blockAction}
                onDragStart={blockAction}
                className={className}
                style={{ pointerEvents: 'none', display: 'block', opacity: 1 }}
            />
            {/* Tiled two-line watermarks matching reference image style */}
            {!isPro && positions.map((pos, i) => (
                <div
                    key={i}
                    className="absolute pointer-events-none select-none"
                    style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
                >
                    <div style={wrapperStyle}>
                        <span style={line1Style}>Photo</span>
                        <span style={line2Style}>Passport.in</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
// ---------------------------------------------------

function App({ onHome, theme, toggleTheme, themeColor, setThemeColor }) {
    // --- Restore step from sessionStorage on refresh ---
    const [step, setStepRaw] = useState(() => {
        const saved = sessionStorage.getItem('pp_step');
        return saved ? parseInt(saved, 10) : 1;
    });
    // Wrapper so every setStep call also persists to sessionStorage
    const setStep = (s) => {
        sessionStorage.setItem('pp_step', s);
        setStepRaw(s);
    };

    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [bgProgress, setBgProgress] = useState(0); // 0-100 for background removal

    // Data — restored from sessionStorage so refresh keeps the user in studio
    const [originalImage, setOriginalImageRaw] = useState(() => sessionStorage.getItem('pp_originalImage') || null);
    const [croppedImage, setCroppedImageRaw] = useState(() => sessionStorage.getItem('pp_croppedImage') || null);
    const [enhancedImage, setEnhancedImageRaw] = useState(() => sessionStorage.getItem('pp_enhancedImage') || null);
    const [bgRemovedImage, setBgRemovedImageRaw] = useState(() => sessionStorage.getItem('pp_bgRemovedImage') || null);
    const [sheetImage, setSheetImageRaw] = useState(() => sessionStorage.getItem('pp_sheetImage') || null);
    const [secureSheetPreview, setSecureSheetPreviewRaw] = useState(() => sessionStorage.getItem('pp_secureSheetPreview') || null);
    const [securePhotoPreview, setSecurePhotoPreviewRaw] = useState(() => sessionStorage.getItem('pp_securePhotoPreview') || null);

    // Auto-persist helpers using try-catch to prevent QuotaExceededError crashes for large images
    const safeSetItem = (key, value) => {
        if (!value) {
            sessionStorage.removeItem(key);
            return;
        }
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.warn(`Could not persist ${key} to sessionStorage (likely QuotaExceededError). It will remain in memory.`);
        }
    };

    const setOriginalImage      = (v) => { safeSetItem('pp_originalImage', v); setOriginalImageRaw(v); };
    const setCroppedImage       = (v) => { safeSetItem('pp_croppedImage', v); setCroppedImageRaw(v); };
    const setEnhancedImage      = (v) => { safeSetItem('pp_enhancedImage', v); setEnhancedImageRaw(v); };
    const setBgRemovedImage     = (v) => { safeSetItem('pp_bgRemovedImage', v); setBgRemovedImageRaw(v); };
    const setSheetImage         = (v) => { safeSetItem('pp_sheetImage', v); setSheetImageRaw(v); };
    const setSecureSheetPreview = (v) => { safeSetItem('pp_secureSheetPreview', v); setSecureSheetPreviewRaw(v); };
    const setSecurePhotoPreview = (v) => { safeSetItem('pp_securePhotoPreview', v); setSecurePhotoPreviewRaw(v); };

    // Crop State
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [selectedSize, setSelectedSize] = useState(() => sessionStorage.getItem('pp_selectedSize') || 'india');
    const [aspect, setAspect] = useState(35 / 45);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Update aspect ratio when size changes
    useEffect(() => {
        const size = PHOTO_SIZES.find(s => s.id === selectedSize);
        if (size) setAspect(size.w / size.h);
    }, [selectedSize]);

    // Enhance State
    const [brightness, setBrightness] = useState(() => parseInt(sessionStorage.getItem('pp_brightness') || '100', 10));
    const [contrast,   setContrast]   = useState(() => parseInt(sessionStorage.getItem('pp_contrast')   || '100', 10));
    const [saturation, setSaturation] = useState(() => parseInt(sessionStorage.getItem('pp_saturation') || '100', 10));

    // Persist selectedSize whenever it changes
    useEffect(() => { sessionStorage.setItem('pp_selectedSize', selectedSize); }, [selectedSize]);
    useEffect(() => { sessionStorage.setItem('pp_brightness',   brightness);   }, [brightness]);
    useEffect(() => { sessionStorage.setItem('pp_contrast',     contrast);     }, [contrast]);
    useEffect(() => { sessionStorage.setItem('pp_saturation',   saturation);   }, [saturation]);

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
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", currentUser.email));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Grant Pro access to specific email
                        if (userData.email === 'sandeep.official.saini@gmail.com') {
                            userData.role = 'pro';
                            userData.expiry = new Date().getTime() + (365 * 24 * 60 * 60 * 1000); // 1 year
                        }
                        setUser(userData);
                        checkSubscription(userData);
                    } else {
                        const newUserData = { email: currentUser.email, role: 'free', freeDownloads: 1 };
                        // Grant Pro access to specific email (New User case)
                        if (currentUser.email === 'sandeep.official.saini@gmail.com') {
                            newUserData.role = 'pro';
                            newUserData.expiry = new Date().getTime() + (365 * 24 * 60 * 60 * 1000);
                        }
                        await setDoc(doc(db, "users", currentUser.email), newUserData);
                        setUser(newUserData);
                        checkSubscription(newUserData);
                    }
                } catch (e) {
                    console.error("Error fetching user data from Firestore", e);
                    // Fallback
                    const fallbackData = { email: currentUser.email, role: 'free', freeDownloads: 1 };
                    if (currentUser.email === 'sandeep.official.saini@gmail.com') {
                        fallbackData.role = 'pro';
                        fallbackData.expiry = new Date().getTime() + (365 * 24 * 60 * 60 * 1000);
                    }
                    setUser(fallbackData);
                }
            } else {
                setUser(null);
                setIsPaid(false);
            }
        });
        return () => unsubscribe();
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
                setIsPaid(false);
                updateUserInDB(updated);
            }
        } else {
            setIsPaid(false);
        }
    };

    const updateUserInDB = async (userData) => {
        try {
            await setDoc(doc(db, "users", userData.email), userData);
        } catch (error) {
            console.error("Error updating user in DB:", error);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!authEmail || !authPass) return;
        setLoading(true);
        setLoadingMsg(authMode === 'login' ? 'Logging in...' : 'Creating Account...');
        
        try {
            if (authMode === 'signup') {
                await createUserWithEmailAndPassword(auth, authEmail, authPass);
                const newUserData = { email: authEmail, role: 'free', freeDownloads: 1 };
                await setDoc(doc(db, "users", authEmail), newUserData);
                setUser(newUserData);
            } else {
                await signInWithEmailAndPassword(auth, authEmail, authPass);
            }
            setShowAuthModal(false);
        } catch (error) {
            console.error("Auth error:", error);
            const msg = error.code ? error.code.split('/')[1].replace(/-/g, ' ') : error.message;
            alert(`Authentication Failed: ${msg.toUpperCase()}`);
        } finally {
            setLoading(false);
            setLoadingMsg('');
            setAuthPass(''); // clear password field
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout error", error);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setLoadingMsg('Signing in with Google...');
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, "users", user.email));
            if (!userDoc.exists()) {
                // If new Google user, create a free tier record
                const newUserData = { email: user.email, role: 'free', freeDownloads: 1 };
                await setDoc(doc(db, "users", user.email), newUserData);
                setUser(newUserData);
            }
            setShowAuthModal(false);
        } catch (error) {
            console.error("Google Auth error:", error);
            const msg = error.code ? error.code.split('/')[1].replace(/-/g, ' ') : error.message;
            if (error.code !== 'auth/popup-closed-by-user') {
                alert(`Google Sign-In Failed: ${msg.toUpperCase()}`);
            }
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
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
                    // Library fires progress for each file download separately (model, wasm etc.)
                    // Each new file resets current=0, which was causing progress to go backwards.
                    // Fix: only update if new calculated value is HIGHER than current.
                    if (total > 0) {
                        const percent = 5 + Math.round((current / total) * 85);
                        const newVal = Math.min(percent, 90);
                        if (newVal > currentProgress) {
                            setBgProgress(newVal);
                            currentProgress = newVal;
                        }
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

            const fullUrl = canvas.toDataURL('image/jpeg', 0.95);
            setBgRemovedImage(fullUrl);

            // Generate a full-res secure preview for Step 5 (watermarked for non-pro)
            const previewW = img.width;
            const previewH = img.height;
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = previewW;
            previewCanvas.height = previewH;
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.fillStyle = bgColor;
            previewCtx.fillRect(0, 0, previewW, previewH);
            previewCtx.drawImage(img, 0, 0, previewW, previewH);
            
            // --- PHOTO PASSPORT WATERMARK (Two-line style matching reference image) ---
            previewCtx.save();
            previewCtx.rotate(-Math.PI / 6); // -30 degrees
            previewCtx.textAlign = 'center';
            previewCtx.textBaseline = 'middle';

            // Line 1: "Photo"  |  Line 2: "Passport.in"
            const wmFontSize = Math.round(previewW * 0.072);
            const wmLineGap = Math.round(wmFontSize * 1.2); // space between two lines
            previewCtx.font = `800 ${wmFontSize}px Arial, sans-serif`;
            previewCtx.fillStyle = 'rgba(200, 200, 210, 0.45)';
            previewCtx.strokeStyle = 'rgba(0,0,0,0.07)';
            previewCtx.lineWidth = 1;

            // Dense tiling
            const stepX = previewW * 0.52;
            const stepY = previewH * 0.34;
            for (let y = -previewH * 1.5; y < previewH * 2.5; y += stepY) {
                for (let x = -previewW * 1.5; x < previewW * 2.5; x += stepX) {
                    // Line 1: "Photo"
                    previewCtx.strokeText('Photo', x, y - wmLineGap / 2);
                    previewCtx.fillText('Photo', x, y - wmLineGap / 2);
                    // Line 2: "Passport.in"
                    previewCtx.strokeText('Passport.in', x, y + wmLineGap / 2);
                    previewCtx.fillText('Passport.in', x, y + wmLineGap / 2);
                }
            }
            previewCtx.restore();

            // Maximum quality — watermark only, no quality reduction
            setSecurePhotoPreview(previewCanvas.toDataURL('image/jpeg', 1.0));

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

            // Count cols/rows purely by photo size (no pre-assumed gap)
            const cols = Math.floor(sheetW / photoWidth);
            const rows = Math.floor(sheetH / photoHeight);

            // Distribute leftover space evenly as gaps (including outer margins)
            const gapX = (sheetW - cols * photoWidth) / (cols + 1);
            const gapY = (sheetH - rows * photoHeight) / (rows + 1);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = Math.round(gapX + c * (photoWidth + gapX));
                    const y = Math.round(gapY + r * (photoHeight + gapY));
                    ctx.drawImage(img, x, y, photoWidth, photoHeight);
                    ctx.strokeStyle = '#ccc';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, photoWidth, photoHeight);
                }
            }

            setSheetImage(canvas.toDataURL('image/jpeg', 1.0));
            
            // --- Two-line Watermark (matching reference image: Photo / Passport.in) ---
            const wmCanvas = document.createElement('canvas');
            wmCanvas.width = sheetW;
            wmCanvas.height = sheetH;
            const wmCtx = wmCanvas.getContext('2d');
            wmCtx.drawImage(canvas, 0, 0); // Copy the full clean sheet

            wmCtx.save();
            wmCtx.rotate(-Math.PI / 6); // -30 degrees
            wmCtx.textAlign = 'center';
            wmCtx.textBaseline = 'middle';

            const sheetFontSize = Math.round(sheetW * 0.036);
            const sheetLineGap = Math.round(sheetFontSize * 1.25);
            wmCtx.font = `800 ${sheetFontSize}px Arial, sans-serif`;
            wmCtx.fillStyle = 'rgba(200, 200, 210, 0.42)';
            wmCtx.strokeStyle = 'rgba(0,0,0,0.07)';
            wmCtx.lineWidth = 2;

            // Dense tiling for full sheet coverage
            const tileStepX = sheetW * 0.22;
            const tileStepY = sheetH * 0.20;
            for (let ty = -sheetH * 1.5; ty < sheetH * 2.5; ty += tileStepY) {
                for (let tx = -sheetW * 1.5; tx < sheetW * 2.5; tx += tileStepX) {
                    // Line 1: "Photo"
                    wmCtx.strokeText('Photo', tx, ty - sheetLineGap / 2);
                    wmCtx.fillText('Photo', tx, ty - sheetLineGap / 2);
                    // Line 2: "Passport.in"
                    wmCtx.strokeText('Passport.in', tx, ty + sheetLineGap / 2);
                    wmCtx.fillText('Passport.in', tx, ty + sheetLineGap / 2);
                }
            }
            wmCtx.restore();

            // Maximum quality — no quality loss, only watermark added
            setSecureSheetPreview(wmCanvas.toDataURL('image/jpeg', 1.0));

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
                    "name": user ? user.email.split('@')[0] : "User Name",
                    "email": user ? user.email : "user@example.com",
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

    const handlePrintClick = async () => {
        if (!user) {
            alert("Please Login or Create an Account to print your photo.");
            setAuthMode('login');
            setShowAuthModal(true);
            return;
        }

        if (isPaid || user.role === 'pro') {
            doPrint();
            return;
        }

        if (user.role === 'free' && user.freeDownloads > 0) {
            const confirmFree = window.confirm("You have 1 Free Print/Download available! Use it now?");
            if (confirmFree) {
                try {
                    setLoading(true); setLoadingMsg('Verifying Device ID...');
                    
                    // --- DEVICE FINGERPRINT CHECK ---
                    const fp = await fpInstancePromise;
                    const result = await fp.get();
                    const visitorId = result.visitorId;

                    const deviceRef = doc(db, 'devices', visitorId);
                    const deviceSnap = await getDoc(deviceRef);
                    
                    if (deviceSnap.exists() && deviceSnap.data().usedFree) {
                        alert("A free photo has already been downloaded from this device using another account. Please purchase a single download or upgrade to Pro.");
                        setLoading(false);
                        triggerPayment('print');
                        return;
                    }
                    
                    setLoadingMsg('Using Free Credit...');
                    
                    // Burn credit on Device
                    await setDoc(deviceRef, { usedFree: true, email: user.email, timestamp: new Date().toISOString() }, { merge: true });
                    
                    // Burn credit on Account
                    const updatedUser = { ...user, freeDownloads: user.freeDownloads - 1 };
                    await updateUserInDB(updatedUser);
                    setUser(updatedUser);
                    setIsPaid(true); // Grant temporary access for this session
                    doPrint();
                } catch(e) {
                    console.error(e);
                    alert("Error applying free credit.");
                } finally {
                    setLoading(false); setLoadingMsg('');
                }
            }
            return;
        }

        triggerPayment('print');
    };

    const handleDownloadClick = async (e, type = 'sheet') => {
        e.preventDefault();
        
        if (!user) {
            alert("Please Login or Create an Account to download your photo.");
            setAuthMode('login');
            setShowAuthModal(true);
            return;
        }

        if (isPaid || user.role === 'pro') {
            if (type === 'sheet') downloadSheet();
            else downloadSingle();
            return;
        }

        if (user.role === 'free' && user.freeDownloads > 0) {
            const confirmFree = window.confirm(`You have 1 Free ${type === 'sheet' ? 'Sheet' : 'Single Photo'} Download available! Use it now?`);
            if (confirmFree) {
                try {
                    setLoading(true); setLoadingMsg('Verifying Device ID...');
                    
                    // --- DEVICE FINGERPRINT CHECK ---
                    const fp = await fpInstancePromise;
                    const result = await fp.get();
                    const visitorId = result.visitorId;

                    const deviceRef = doc(db, 'devices', visitorId);
                    const deviceSnap = await getDoc(deviceRef);
                    
                    if (deviceSnap.exists() && deviceSnap.data().usedFree) {
                        alert("A free photo has already been downloaded from this device using another account. Please purchase a single download or upgrade to Pro.");
                        setLoading(false);
                        triggerPayment(type === 'sheet' ? 'download' : 'download-single');
                        return;
                    }
                    
                    setLoadingMsg('Using Free Credit...');
                    
                    // Burn credit on Device
                    await setDoc(deviceRef, { usedFree: true, email: user.email, timestamp: new Date().toISOString() }, { merge: true });

                    // Burn credit on Account
                    const updatedUser = { ...user, freeDownloads: user.freeDownloads - 1 };
                    await updateUserInDB(updatedUser);
                    setUser(updatedUser);
                    setIsPaid(true); // Grant temporary access
                    if (type === 'sheet') downloadSheet();
                    else downloadSingle();
                } catch(e) {
                    console.error(e);
                    alert("Error applying free credit.");
                } finally {
                    setLoading(false); setLoadingMsg('');
                }
            }
            return;
        }

        triggerPayment(type === 'sheet' ? 'download' : 'download-single');
    };

    const isStepAvailable = (stepId) => {
        if (stepId === 1) return true; // Upload always avail
        if (stepId === 2) return !!originalImage; // Crop needs original
        // For 3,4,5 we just need a cropped base image
        if (stepId >= 3 && stepId <= 5) return !!croppedImage;
        if (stepId === 6) return !!sheetImage; // Print needs sheet
        return false;
    };

    // --- Generate a watermarked preview from any source image (used when BG removal is skipped) ---
    const generateWatermarkedPreview = async (sourceUrl) => {
        if (!sourceUrl) return;
        try {
            const img = new Image();
            img.src = sourceUrl;
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Two-line watermark: "Photo" / "Passport.in" — same style as BG-removed preview
            ctx.save();
            ctx.rotate(-Math.PI / 6);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fs = Math.round(img.width * 0.072);
            const gap = Math.round(fs * 1.2);
            ctx.font = `800 ${fs}px Arial, sans-serif`;
            ctx.fillStyle = 'rgba(200, 200, 210, 0.45)';
            ctx.strokeStyle = 'rgba(0,0,0,0.07)';
            ctx.lineWidth = 1;
            const sx = img.width * 0.52;
            const sy = img.height * 0.34;
            for (let y = -img.height * 1.5; y < img.height * 2.5; y += sy) {
                for (let x = -img.width * 1.5; x < img.width * 2.5; x += sx) {
                    ctx.strokeText('Photo', x, y - gap / 2);
                    ctx.fillText('Photo', x, y - gap / 2);
                    ctx.strokeText('Passport.in', x, y + gap / 2);
                    ctx.fillText('Passport.in', x, y + gap / 2);
                }
            }
            ctx.restore();
            setSecurePhotoPreview(canvas.toDataURL('image/jpeg', 1.0));
        } catch (e) {
            console.error('Watermark generation failed', e);
        }
    };

    const handleStepClick = (stepId) => {
        if (isStepAvailable(stepId)) {
            setStep(stepId);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden text-slate-100 font-sans bg-slate-950">
            {/* Mobile Header */}
            <header className="flex md:hidden justify-between items-center p-4 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative z-50">
                <div onClick={onHome} className="flex items-center gap-2 group cursor-pointer" aria-label="photopassport.in home">
                    <div className="relative">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30 group-hover:border-indigo-500/60 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <Aperture className="text-indigo-400 group-hover:rotate-180 transition-transform duration-700" size={24} />
                        </div>
                    </div>
                    <div className="flex flex-col leading-none">
                        <div className="flex items-center gap-1">
                            <span className="text-xl font-black tracking-tight text-white italic">photo</span>
                            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">passport.in</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold ml-0.5">Premium Studio</span>
                    </div>
                </div>
                {/* Mobile User Menu & Theme Trigger */}
                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-800 text-slate-300 border border-slate-700/50">
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <div className="relative">
                        <button onClick={() => setShowThemeMenu(!showThemeMenu)} className="p-2 rounded-full hover:bg-slate-800 text-slate-300 border border-slate-700/50">
                            <Palette size={20} />
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
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-1.5 rounded-full transition-colors"
                        >
                            <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white uppercase shadow-inner">
                                {user && user.email ? user.email.charAt(0) : <User size={18} />}
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
                </div>
            </header>

            {/* Sidebar */}
            <aside className="w-full md:w-72 bg-slate-900 border-b md:border-r border-slate-800 md:border-slate-700 p-4 md:p-6 flex-shrink-0 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible no-scrollbar">
                <div onClick={onHome} className="mb-0 md:mb-12 hidden md:flex items-center gap-3 px-2 group cursor-pointer" aria-label="photopassport.in home">
                    <div className="relative">
                        <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30 group-hover:border-indigo-500/60 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                            <Aperture className="text-indigo-400 group-hover:rotate-180 transition-transform duration-1000" size={32} />
                        </div>
                    </div>
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
                <header className="hidden md:flex justify-between items-center p-4 md:p-6 border-b border-slate-800 bg-slate-900 flex-shrink-0 relative z-50">
                    <div onClick={onHome} className="flex items-center gap-2 group cursor-pointer" aria-label="photopassport.in home">
                        <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30 group-hover:border-indigo-500/60 transition-colors">
                            <Aperture className="text-indigo-400 group-hover:rotate-180 transition-transform duration-700" size={24} />
                        </div>
                        <div className="flex flex-col leading-none">
                            <div className="flex items-center gap-1">
                                <span className="text-xl font-black tracking-tight text-white italic">photo</span>
                                <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">passport.in</span>
                            </div>
                        </div>
                    </div>

                    {/* User Menu & Theme Trigger */}
                    <div className="flex items-center gap-4">
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-800 text-slate-300 border border-slate-700">
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="relative">
                            <button onClick={() => setShowThemeMenu(!showThemeMenu)} className="p-2 rounded-full hover:bg-slate-800 text-slate-300 border border-slate-700">
                                <Palette size={20} />
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
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 p-1.5 rounded-full transition-colors"
                            >
                                <div className="bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white uppercase shadow-inner">
                                    {user && user.email ? user.email.charAt(0) : <User size={18} />}
                                </div>
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
                                            onClick={() => { setShowAuthModal(true); setShowUserMenu(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-indigo-400 hover:bg-slate-700 flex items-center gap-2"
                                        >
                                            <User size={16} /> Sign in with Google
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative text-center">
                                <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                                <div className="bg-indigo-600/20 p-4 rounded-full inline-flex mb-4">
                                    <User size={32} className="text-indigo-400" />
                                </div>
                                <h3 className="text-2xl font-bold mb-2">Sign In</h3>
                                <p className="text-slate-400 text-sm mb-8">Sign in with your Google account to continue. No password needed.</p>
                                <button
                                    onClick={handleGoogleLogin}
                                    type="button"
                                    className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors shadow-lg text-base"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continue with Google
                                </button>
                                <p className="text-xs text-slate-500 mt-6">By signing in, you agree to our Terms of Service.</p>
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
                                        onRotationChange={setRotation}
                                        objectFit="contain"
                                    />
                                </div>

                                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 mb-4 w-full">
                                    <div className="w-full md:flex-1">
                                        <label className="block text-sm text-slate-400 mb-2 flex justify-between items-center">
                                            <span>Zoom</span>
                                            <span className="text-white text-xs bg-slate-800 px-2 py-1 rounded">{zoom.toFixed(1)}x</span>
                                        </label>
                                        <input
                                            type="range" min={1} max={3} step={0.1}
                                            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                                            className="w-full accent-indigo-600 cursor-pointer"
                                        />
                                    </div>
                                    <div className="w-full md:flex-1">
                                        <label className="block text-sm text-slate-400 mb-2 flex justify-between items-center">
                                            <span>Rotation</span>
                                            <button 
                                                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 shadow-sm"
                                            >
                                                <RefreshCw size={12} /> Rotate 90°
                                            </button>
                                        </label>
                                        <input
                                            type="range" min={0} max={360}
                                            value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                                            className="w-full accent-indigo-600 cursor-pointer"
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
                                            className="enhance-img shadow-xl"
                                            style={{
                                                '--ep-brightness': `${brightness}%`,
                                                '--ep-contrast': `${contrast}%`,
                                                '--ep-saturation': `${saturation}%`,
                                                maxHeight: '400px'
                                            }}
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
                                        {/* Protected — right-click & drag blocked, NO watermark on this step */}
                                        <ProtectedImage
                                            src={enhancedImage}
                                            alt="Enhanced passport photo before background removal"
                                            className="max-h-[400px] shadow-lg"
                                            isPro={true}
                                        />
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

                                {/* Skip BG removal — proceed to step 5 with plain photo, no watermark */}
                                <button
                                    className="w-full max-w-md mt-3 text-slate-400 hover:text-white text-sm py-2 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
                                    onClick={() => setStep(5)}
                                >
                                    Skip — Use Photo As-Is →
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
                                    <ProtectedImage
                                        src={
                                            bgRemovedImage
                                                // BG was removed: pro sees clean image, free sees watermarked canvas
                                                ? (isPaid ? bgRemovedImage : (securePhotoPreview || bgRemovedImage))
                                                // BG was NOT removed: show plain image, no watermark for anyone
                                                : (enhancedImage || croppedImage)
                                        }
                                        // Only show DOM watermark overlay when BG was removed AND user is free
                                        isPro={!bgRemovedImage || isPaid}
                                        alt="Passport photo secure preview"
                                        className="h-64 w-auto object-cover rounded"
                                    />
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
                                            <Download size={18} /> {user && user.role === 'free' && user.freeDownloads > 0 ? "Get Single Free" : "Get Single Digital"}
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
                                {secureSheetPreview && (
                                    <div className="relative mb-8 inline-block">
                                        <div className="bg-white p-2 rounded-lg shadow-2xl overflow-hidden leading-none">
                                            <img
                                                src={isPaid ? sheetImage : secureSheetPreview}
                                                alt={isPaid ? "Passport photo sheet" : "Passport photo sheet preview with watermark"}
                                                className="max-h-[500px] w-auto block select-none pointer-events-none"
                                                draggable={false}
                                                onContextMenu={e => e.preventDefault()}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg"
                                        onClick={handlePrintClick}
                                    >
                                        <Printer size={20} /> {user && user.role === 'free' && user.freeDownloads > 0 ? "Print for Free (1 Left)" : "Print Sheet"}
                                    </button>
                                    <button
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg"
                                        onClick={(e) => handleDownloadClick(e, 'sheet')}
                                    >
                                        {user && user.role === 'free' && user.freeDownloads > 0 ? <Download size={20} /> : <CreditCard size={20} />} 
                                        {user && user.role === 'free' && user.freeDownloads > 0 ? "Download Free (1 Left)" : "Buy Sheet"}
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
