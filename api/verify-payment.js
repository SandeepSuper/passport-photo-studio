// Vercel Serverless Function: verifies the Razorpay payment signature.
import crypto from 'node:crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        return res.status(500).json({ success: false, message: 'Razorpay credentials missing in environment variables' });
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) {
        return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    return res.status(200).json({ success: true, message: 'Payment verified successfully' });
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return {}; }
}
