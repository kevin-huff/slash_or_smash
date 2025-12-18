import tmi from 'tmi.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testConnection() {
    console.log('--- Twitch Chat Connection Debugger ---');

    const username = process.env.TWITCH_CHAT_USERNAME;
    const token = process.env.TWITCH_CHAT_OAUTH_TOKEN;
    const channel = process.env.TWITCH_CHAT_CHANNEL;

    console.log('Environment Config:');
    console.log(`Username: ${username}`);
    console.log(`Token: ${token ? '***' + token.slice(-4) : 'MISSING'}`);
    console.log(`Channel: ${channel}`);

    if (!username || !token || !channel) {
        console.error('ERROR: Missing required environment variables.');
        return;
    }

    const client = new tmi.Client({
        identity: {
            username: username,
            password: token.startsWith('oauth:') ? token : `oauth:${token}`,
        },
        channels: [channel],
        connection: {
            secure: true,
            reconnect: true, // We want to see if it loops here in isolation
        },
        logger: {
            info: (msg) => console.log(`[tmi info] ${msg}`),
            warn: (msg) => console.warn(`[tmi warn] ${msg}`),
            error: (msg) => console.error(`[tmi error] ${msg}`),
        }
    });

    client.on('connected', (addr, port) => {
        console.log(`\n✅ SUCCESS! Connected to ${addr}:${port}`);
        console.log('Waiting 5 seconds before disconnecting...');
        setTimeout(() => {
            client.disconnect().then(() => {
                console.log('Disconnected cleanly.');
                process.exit(0);
            });
        }, 5000);
    });

    client.on('disconnected', (reason) => {
        console.log(`❌ Disconnected: ${reason}`);
    });

    try {
        console.log('\nAttempting connection...');
        await client.connect();
    } catch (err) {
        console.error('\n❌ Connection Failed:', err);
        process.exit(1);
    }
}

testConnection().catch(console.error);
