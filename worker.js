export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // API for signing a key out
        if (request.method === 'POST' && path === '/api/sign-out') {
            try {
                const data = await request.json();
                const { name, business, mobile, keyNumber, keyType, apartmentNumber, signature } = data;

                if (!name || !mobile || !keyNumber || !keyType || !signature) {
                    return new Response(JSON.stringify({ message: 'Missing required fields' }), { status: 400 });
                }

                const stmt = env.DB.prepare(
                    `INSERT INTO key_log (name, business, mobile, key_number, key_type, apartment_number, signature_out, timestamp_out, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OUT')`
                );

                await stmt.bind(
                    name,
                    business,
                    mobile,
                    keyNumber,
                    keyType,
                    apartmentNumber,
                    signature,
                    Date.now()
                ).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' },
                });

            } catch (error) {
                console.error('Sign-out error:', error);
                return new Response(JSON.stringify({ message: 'Error processing sign-out request' }), { status: 500 });
            }
        }

        // API for returning a key
        if (request.method === 'POST' && path === '/api/sign-in') {
            try {
                const data = await request.json();
                const { keyNumber, signature } = data;

                if (!keyNumber || !signature) {
                    return new Response(JSON.stringify({ message: 'Missing key number or signature' }), { status: 400 });
                }

                // Find the most recent 'OUT' record for the key
                const stmt = env.DB.prepare(
                    `SELECT id FROM key_log WHERE key_number = ? AND status = 'OUT' ORDER BY timestamp_out DESC LIMIT 1`
                );
                const { results } = await stmt.bind(keyNumber).all();

                if (results.length === 0) {
                    return new Response(JSON.stringify({ message: 'No matching key found to sign in.' }), { status: 404 });
                }
                
                const keyToUpdateId = results[0].id;

                // Update the record with return details
                const updateStmt = env.DB.prepare(
                    `UPDATE key_log SET signature_in = ?, timestamp_in = ?, status = 'IN' WHERE id = ?`
                );
                await updateStmt.bind(signature, Date.now(), keyToUpdateId).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Sign-in error:', error);
                return new Response(JSON.stringify({ message: 'Error processing sign-in request' }), { status: 500 });
            }
        }

        // API for fetching the report data
        if (request.method === 'GET' && path === '/api/report') {
            try {
                const { results } = await env.DB.prepare(
                    `SELECT name, business, mobile, key_number, key_type, apartment_number, signature_out, signature_in, timestamp_out, timestamp_in, status
                     FROM key_log
                     ORDER BY timestamp_out DESC`
                ).all();

                return new Response(JSON.stringify(results), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                console.error('Report generation error:', error);
                return new Response(JSON.stringify({ message: 'Error fetching report data' }), { status: 500 });
            }
        }
        
        // Return a 404 for unknown routes
        return new Response('Not Found', { status: 404 });
    }
};
