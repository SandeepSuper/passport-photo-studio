// Vercel Serverless Function: creates a Razorpay order.
// Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel → Settings → Environment Variables.

// Prices are decided here on the server (in paise), never trusted from the browser.
const PRICES = {
    single: 1000,  // Rs. 10
    pro: 19900,    // Rs. 199
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        return res.status(500).json({ message: 'Razorpay credentials missing in environment variables' });
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
    const plan = body.plan === 'pro' ? 'pro' : 'single';
    const amount = PRICES[plan];

    try {
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
            },
            body: JSON.stringify({
                amount,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
                notes: { plan },
            }),
        });

        const order = await rzpRes.json();
        if (!rzpRes.ok) {
            console.error('Razorpay order error:', order);
            return res.status(502).json({
                message: order?.error?.description || 'Could not create Razorpay order',
            });
        }

        return res.status(200).json({ order_id: order.id, key_id: keyId, amount, plan });
    } catch (err) {
        console.error('Create order failed:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return {}; }
}
