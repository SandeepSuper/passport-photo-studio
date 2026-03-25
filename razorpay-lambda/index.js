const Razorpay = require('razorpay');
const crypto = require('crypto');

exports.handler = async (event) => {
    console.log("Event:", JSON.stringify(event));
    
    // Support for both AWS API Gateway HTTP APIs and REST APIs payload format
    const path = event.rawPath || event.path;
    let body = {};
    if (event.body) {
        try {
            body = JSON.parse(event.body);
        } catch(e) {
            console.error("Invalid JSON body");
        }
    }

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow S3 frontend to call this
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS Preflight request
    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Ensure environment variables are set
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Razorpay credentials missing in environment variables" })
        };
    }

    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    try {
        // ROUTE 1: Create Order
        if (path === '/create-order') {
            const amountInPaise = body.amount || 6900; // Default 69 INR in paise
            
            const options = {
                amount: amountInPaise,
                currency: "INR",
                receipt: `receipt_${Date.now()}`
            };
            
            const order = await razorpay.orders.create(options);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ order_id: order.id, key_id: process.env.RAZORPAY_KEY_ID })
            };
        } 
        
        // ROUTE 2: Verify Payment
        else if (path === '/verify-payment') {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
            
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                 return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: "Missing verification parameters" })
                };
            }
            
            const generated_signature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(razorpay_order_id + "|" + razorpay_payment_id)
                .digest('hex');
                
            if (generated_signature === razorpay_signature) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, message: "Payment verified successfully" })
                };
            } else {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: "Invalid signature" })
                };
            }
        }

        // 404 Not Found
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: "Route not found. Use /create-order or /verify-payment" })
        };
        
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Internal server error", error: error.message })
        };
    }
};
