# Passport Photo Web

A client-side specific passport photo generator built with React.

## Features
- **Upload**: Support for standard image formats.
- **Crop**: Auto-aspect ratio for Passport (35x45mm) or Postcard sizes. Uses `react-easy-crop`.
- **Enhance**: Adjust Brightness, Contrast, and Saturation.
- **Background Removal**: Uses **AI** (via `@imgly/background-removal`) running entirely in the browser to remove backgrounds and replace them with white (or any color).
- **Generate Sheet**: Creates a printable 4x6" sheet with multiple photos.
- **Print**: Direct printing integration.

## How to Run

Since this project was manually created, you need to install dependencies first.

1.  **Install Node.js**: Download from [nodejs.org](https://nodejs.org/) if you don't have it.
2.  **Open Terminal** in this folder.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
5.  Open the link shown (usually `http://localhost:5173`).

## Tech Stack
- React + Vite
- Tailwind-like CSS variables (custom implementation)
- Lucide React (Icons)
