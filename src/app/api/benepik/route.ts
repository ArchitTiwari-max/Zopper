import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// Note: We are importing from the benepik-client folder as requested
import { sendRewards } from '../../../lib/benepik';

export async function POST(req: NextRequest) {
    try {
        // 1. Internal Authorization (for other companies to test)
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = { success: false, error: 'Authorization header missing or invalid. Use Bearer <token>' };
            console.error('Zopper_Benepik API Error (401):', error);
            return NextResponse.json(error, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        try {
            // Inline Zopper_Benepik token verification to avoid sharing main project secret
            const secret = process.env.BENEPIK_JWT_SECRET;
            if (!secret) throw new Error('BENEPIK_JWT_SECRET is not defined');
            const decoded = jwt.verify(token, secret) as any;

            // 1.1 Verify required fields in payload
            if (!decoded.clientId) {
                const error = { success: false, error: 'Invalid token payload. clientId is required.' };
                console.error('Zopper_Benepik API Error (401):', error);
                return NextResponse.json(error, { status: 401 });
            }

            // 1.2 Verify clientId matches BENEPIK_CLIENT_ID
            const allowedClientId = process.env.BENEPIK_CLIENT_ID;
            
            if (decoded.clientId !== allowedClientId) {
                const error = { success: false, error: 'Unauthorized client. Invalid clientId.' };
                console.error('Zopper_Benepik API Error (403):', error);
                return NextResponse.json(error, { status: 403 });
            }

        } catch (err: any) {
            const error = { success: false, error: 'Invalid or expired token', details: err.message };
            console.error('Zopper_Benepik API Error (401):', error);
            return NextResponse.json(error, { status: 401 });
        }

        // 2. Extract dynamic payload from request
        let payload;
        try {
            payload = await req.json();
        } catch (e) {
            const error = { success: false, error: 'Request body must be valid JSON' };
            console.error('Zopper_Benepik API Error (400):', error);
            return NextResponse.json(error, { status: 400 });
        }

        if (!payload || Object.keys(payload).length === 0) {
            const error = { success: false, error: 'Payload is missing or empty' };
            console.error('Zopper_Benepik API Error (400):', error);
            return NextResponse.json(error, { status: 400 });
        }

        // 3. Call Benepik API using existing logic
        const response = await sendRewards(payload);
// const response={data:{success:true,message:"Reward sent successfully"}}
        console.log('✅ Direct Response from Benepik Api',JSON.stringify(response.data, null, 2));
        return NextResponse.json({
            success: true,
            data: response.data
        });

    } catch (error: any) {
        if (error.response) {
            console.error('=== Direct Error Response from Benepik Api ===');
            console.error(JSON.stringify(error.response.data, null, 2));
            console.error('==============================');

            // Directly return Benepik's error response and status
            return NextResponse.json(error.response.data, { status: error.response.status });
        }

        console.error('Zopper_Benepik API Error:', error.message);
        return NextResponse.json({
            success: false,
            error: error.message || 'Processing failed'
        }, { status: 500 });
    }
}