import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { removeBackground } from '@imgly/background-removal';
import { Upload, Scissors, Wand2, Image as ImageIcon, Printer, Grid, RefreshCw, Check, CreditCard } from 'lucide-react';
import getCroppedImg from './canvasUtils';
import './index.css';

const STEPS = [
    { id: 1, name: 'Upload', icon: Upload },
    { id: 2, name: 'Crop', icon: Scissors },
    { id: 3, name: 'Enhance', icon: Wand2 },
    { id: 4, name: 'Background', icon: ImageIcon },
    { id: 5, name: 'Generate', icon: Grid },
    { id: 6, name: 'Payment', icon: CreditCard },
    { id: 7, name: 'Print', icon: Printer },
];

function App() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');

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
    const [aspect, setAspect] = useState(35 / 45); // Standard passport
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Enhance State
    const [brightness, setBrightness] = useState(100); // 100% is default
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);

    // Background State
    const [bgColor, setBgColor] = useState('#ffffff');
    const [isPaid, setIsPaid] = useState(false);

    // --- Handlers ---

    const onFileChange = async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setOriginalImage(URL.createObjectURL(file));
            setStep(2);
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
        setLoadingMsg('Downloading AI models & processing... (This happens locally)');

        try {
            // 1. Remove BG -> Returns Blob (PNG with transparency)
            const blob = await removeBackground(enhancedImage);
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
            console.error(e);
            alert('Background removal failed: ' + e.message);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };

    const generateSheet = async () => {
        if (!bgRemovedImage) return;
        setLoading(true);

        try {
            // A4 or 4x6 inch canvas at 300 DPI
            // 4x6" = 1200x1800 px
            const dpi = 300;
            const width = 6 * dpi;
            const height = 4 * dpi;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // White Sheet
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            const img = new Image();
            img.src = bgRemovedImage;
            await new Promise(r => img.onload = r);

            // Grid 4x2
            const cols = 4;
            const rows = 2;
            const photoWidth = 413; // 35mm at 300dpi
            const photoHeight = 531; // 45mm at 300dpi
            const gap = 30; // padding

            const startX = (width - ((cols * photoWidth) + ((cols - 1) * gap))) / 2;
            const startY = (height - ((rows * photoHeight) + ((rows - 1) * gap))) / 2;

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

    const handlePayment = async () => {
        setLoading(true);
        setLoadingMsg('Processing Payment...');
        try {
            // Mock API Call
            await new Promise(resolve => setTimeout(resolve, 2000));
            setIsPaid(true);
            setStep(7);
        } catch (e) {
            alert("Payment Failed");
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    }

    const handlePrint = () => {
        const win = window.open('');
        win.document.write(`<img src="${sheetImage}" style="width:100%; height:auto;" onload="window.print();window.close()" />`);
        win.document.close();
    };

    return (
        <div className="app-container flex min-h-screen custom-bg text-white">
            {/* Sidebar */}
            <aside className="w-72 bg-slate-900 border-r border-slate-700 p-6 flex-shrink-0">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 mb-8">
                    Passport Studio
                </h1>

                <div className="space-y-2">
                    {STEPS.map((s) => (
                        <div
                            key={s.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${step === s.id
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                                : step > s.id
                                    ? 'text-green-400'
                                    : 'text-slate-500'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${step === s.id ? 'border-indigo-500 bg-indigo-500 text-white' :
                                step > s.id ? 'border-green-500 bg-green-500 text-white' : 'border-slate-600 bg-slate-800'
                                }`}>
                                {step > s.id ? <Check size={16} /> : s.id}
                            </div>
                            <span className="font-medium">{s.name}</span>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                {loading && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                        <RefreshCw className="animate-spin text-indigo-500 mb-4" size={48} />
                        <p className="text-xl font-medium">{loadingMsg || 'Processing...'}</p>
                    </div>
                )}

                <div className="max-w-4xl mx-auto">
                    {step === 1 && (
                        <div className="card text-center py-20 border-dashed border-2 border-slate-600 hover:border-indigo-500 transition-colors">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Upload size={40} className="text-indigo-400" />
                            </div>
                            <h2 className="text-3xl font-bold mb-4">Upload your photo</h2>
                            <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                Select a high quality portrait photo with good lighting. We'll help you crop and professionally format it.
                            </p>
                            <label className="btn-primary px-8 py-3 rounded-lg text-lg cursor-pointer inline-flex items-center gap-2">
                                <Upload size={20} />
                                <span>Select Image</span>
                                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                            </label>
                        </div>
                    )}

                    {step === 2 && originalImage && (
                        <div className="card h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Crop & Rotate</h2>
                                <div className="flex gap-4">
                                    <select
                                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
                                        value={aspect}
                                        onChange={(e) => setAspect(Number(e.target.value))}
                                    >
                                        <option value={35 / 45}>Passport (35x45mm)</option>
                                        <option value={4 / 6}>Postcard (4x6")</option>
                                        <option value={1}>Square (1:1)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="relative flex-1 bg-slate-950 rounded-lg overflow-hidden border border-slate-700 mb-6">
                                <Cropper
                                    image={originalImage}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspect}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    rotation={rotation}
                                />
                            </div>

                            <div className="flex items-center gap-8 mb-6">
                                <div className="flex-1">
                                    <label className="block text-sm text-slate-400 mb-2">Zoom</label>
                                    <input
                                        type="range" min={1} max={3} step={0.1}
                                        value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm text-slate-400 mb-2">Rotation</label>
                                    <input
                                        type="range" min={0} max={360}
                                        value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <button className="btn-primary w-full py-3" onClick={handleCrop}>
                                Confirm Crop
                            </button>
                        </div>
                    )}

                    {step === 3 && croppedImage && (
                        <div className="card flex flex-col items-center">
                            <h2 className="text-2xl font-bold mb-8">Enhance Photo</h2>

                            <div className="grid grid-cols-2 gap-8 w-full mb-8">
                                <div className="bg-slate-950 p-4 rounded-lg flex items-center justify-center border border-slate-800">
                                    <img
                                        src={croppedImage}
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
                                    <img src={enhancedImage} className="max-h-[400px] shadow-lg" />
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
                            <p className="text-xs text-slate-500 mt-4 max-w-xs text-center">
                                * This downloads ~40MB of AI models the first time. It runs entirely in your browser.
                            </p>
                        </div>
                    )}

                    {step === 5 && bgRemovedImage && (
                        <div className="card flex flex-col items-center">
                            <h2 className="text-2xl font-bold mb-6">Review Final Photo</h2>
                            <div className="p-4 bg-white rounded shadow-lg mb-8">
                                <img src={bgRemovedImage} className="max-h-[400px]" />
                            </div>

                            <div className="flex gap-4">
                                <button className="btn-secondary" onClick={() => setStep(4)}>Back</button>
                                <button className="btn-primary" onClick={generateSheet}>Generate 4x6 Sheet</button>
                            </div>
                        </div>
                    )}

                    {step === 6 && sheetImage && !isPaid && (
                        <div className="card text-center max-w-xl mx-auto">
                            <h2 className="text-3xl font-bold mb-6">Order Summary</h2>

                            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 mb-8 text-left">
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-400">Passport Photo Sheet (4x6)</span>
                                    <span className="font-bold">$4.99</span>
                                </div>
                                <div className="flex justify-between mb-4">
                                    <span className="text-slate-400">AI Background Removal</span>
                                    <span className="font-bold">$2.00</span>
                                </div>
                                <div className="h-px bg-slate-700 my-4"></div>
                                <div className="flex justify-between text-xl">
                                    <span className="font-bold">Total</span>
                                    <span className="font-bold text-green-400">$6.99</span>
                                </div>
                            </div>

                            <p className="text-slate-400 mb-8 text-sm">
                                Secure payment processing. Your photo will be available for instant download and printing immediately after payment.
                            </p>

                            <button
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-3 transition-transform active:scale-95"
                                onClick={handlePayment}
                            >
                                <CreditCard /> Pay $6.99 & Download
                            </button>
                        </div>
                    )}

                    {step === 7 && sheetImage && isPaid && (
                        <div className="card text-center">
                            <h2 className="text-3xl font-bold m-0 mb-2">Payment Successful!</h2>
                            <p className="text-green-400 mb-8">Your passport photo sheet is ready.</p>

                            <div className="inline-block p-4 bg-white rounded shadow-2xl mb-8 border border-slate-200">
                                <img src={sheetImage} className="max-h-[400px] w-auto block" />
                            </div>

                            <div className="flex justify-center gap-4">
                                <button className="btn-primary px-8 py-3 text-lg flex items-center gap-2" onClick={handlePrint}>
                                    <Printer /> Print Sheet
                                </button>
                                <a href={sheetImage} download="passport-sheet.jpg" className="btn-secondary px-8 py-3 text-lg flex items-center gap-2">
                                    Download
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
