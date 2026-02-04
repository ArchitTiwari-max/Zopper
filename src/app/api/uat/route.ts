import { NextRequest, NextResponse } from 'next/server';
import { verifyUatToken } from '@/lib/jwt';
// Import from the benepik-client folder
import { sendRewards } from '../../../../benepik-client/src/benepik.js';

export async function POST(req: NextRequest) {
    try {
        // 1. Internal Authorization (for other companies to test)
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = { success: false, error: 'Authorization header missing or invalid. Use Bearer <token>' };
            console.error('UAT API Error (401):', error);
            return NextResponse.json(error, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        try {
            // Use dedicated UAT verification to avoid sharing main project secret
            const decoded = verifyUatToken(token);

            // 1.1 Verify required fields in payload
            if (!decoded.clientId) {
                const error = { success: false, error: 'Invalid token payload. clientId is required.' };
                console.error('UAT API Error (401):', error);
                return NextResponse.json(error, { status: 401 });
            }

            // 1.2 Verify clientId matches UAT_CLIENT_ID
            const allowedClientId = process.env.UAT_CLIENT_ID;
            
            if (decoded.clientId !== allowedClientId) {
                const error = { success: false, error: 'Unauthorized client. Invalid clientId.' };
                console.error('UAT API Error (403):', error);
                return NextResponse.json(error, { status: 403 });
            }

        } catch (err: any) {
            const error = { success: false, error: 'Invalid or expired token', details: err.message };
            console.error('UAT API Error (401):', error);
            return NextResponse.json(error, { status: 401 });
        }

        // 2. Extract dynamic payload from request
        let payload;
        try {
            payload = await req.json();
        } catch (e) {
            const error = { success: false, error: 'Request body must be valid JSON' };
            console.error('UAT API Error (400):', error);
            return NextResponse.json(error, { status: 400 });
        }

        if (!payload || Object.keys(payload).length === 0) {
            const error = { success: false, error: 'Payload is missing or empty' };
            console.error('UAT API Error (400):', error);
            return NextResponse.json(error, { status: 400 });
        }

        // 3. Call Benepik API using existing logic
        const response = await sendRewards(payload);
// const response={data:{success:true,message:"Reward sent successfully"}}
        console.log('✅ Benepik API Success:', response.data);
        return NextResponse.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        if (error.response) {
            console.error('=== Benepik Error Response ===');
            console.error(JSON.stringify(error.response.data, null, 2));
            console.error('==============================');

            // Directly return Benepik's error response and status
            return NextResponse.json(error.response.data, { status: error.response.status });
        }

        console.error('UAT API Error:', error.message);
        return NextResponse.json({
            success: false,
            error: error.message || 'Processing failed'
        }, { status: 500 });
    }
}
