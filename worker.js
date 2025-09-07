export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'POST' && path === '/api/sign-out') {
            try {
                const data = await request.json();
                const { name, business, mobile, keyNumber, keyType, apartmentNumber } = data;

                if (!name || !mobile || !keyNumber || !keyType) {
                    return new Response(JSON.stringify({ message: 'Missing required fields' }), { status: 400, headers: headers });
                }

                const stmt = env.DB.prepare(
                    `INSERT INTO key_log (name, business, mobile, key_number, key_type, apartment_number, timestamp_out, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'OUT')`
                );

                await stmt.bind(
                    name,
                    business,
                    mobile,
                    keyNumber,
                    keyType,
                    apartmentNumber,
                    Date.now()
                ).run();

                return new Response(JSON.stringify({ success: true }), { status: 200, headers: headers });

            } catch (error) {
                console.error('Sign-out error:', error);
                return new Response(JSON.stringify({ message: 'Error processing sign-out request' }), { status: 500, headers: headers });
            }
        }

        if (request.method === 'POST' && path === '/api/sign-in') {
            try {
                const data = await request.json();
                const { keyNumber } = data;

                if (!keyNumber) {
                    return new Response(JSON.stringify({ message: 'Missing key number' }), { status: 400, headers: headers });
                }

                const stmt = env.DB.prepare(
                    `SELECT id FROM key_log WHERE key_number = ? AND status = 'OUT' ORDER BY timestamp_out DESC LIMIT 1`
                );
                const { results } = await stmt.bind(keyNumber).all();

                if (results.length === 0) {
                    return new Response(JSON.stringify({ message: 'No matching key found to sign in.' }), { status: 404, headers: headers });
                }
                
                const keyToUpdateId = results[0].id;

                const updateStmt = env.DB.prepare(
                    `UPDATE key_log SET timestamp_in = ?, status = 'IN' WHERE id = ?`
                );
                await updateStmt.bind(Date.now(), keyToUpdateId).run();

                return new Response(JSON.stringify({ success: true }), { status: 200, headers: headers });
            } catch (error) {
                console.error('Sign-in error:', error);
                return new Response(JSON.stringify({ message: 'Error processing sign-in request' }), { status: 500, headers: headers });
            }
        }

        if (request.method === 'GET' && path === '/api/report') {
            try {
                const { results } = await env.DB.prepare(
                    `SELECT name, business, mobile, key_number, key_type, apartment_number, timestamp_out, timestamp_in, status
                     FROM key_log
                     ORDER BY timestamp_out DESC`
                ).all();

                return new Response(JSON.stringify(results), { status: 200, headers: headers });
            } catch (error) {
                console.error('Report generation error:', error);
                return new Response(JSON.stringify({ message: 'Error fetching report data' }), { status: 500, headers: headers });
            }
        }
        
        return new Response('Not Found', { status: 404, headers: headers });
    }
};
