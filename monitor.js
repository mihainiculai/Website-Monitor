require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const TARGET_URL = process.env.TARGET_URL;
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS, 10);
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SENDER_NAME = process.env.SENDER_NAME || 'Website Monitor';

let previousContentHash = null;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

async function sendEmail(subject, body) {
    try {
        const mailOptions = {
            from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
            to: RECIPIENT_EMAIL,
            subject: subject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${subject}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

function getContentHash(content) {
    if (typeof content !== 'string') {
        return null;
    }

    return crypto.createHash('md5').update(content).digest('hex');
}

async function fetchWebsiteContent() {
    try {
        const response = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 WebsiteChangeMonitor/1.0'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${TARGET_URL}:`, error.message);
        return null;
    }
}

async function checkWebsite() {
    console.log(`Checking ${TARGET_URL} at ${new Date().toISOString()}`);
    const currentContent = await fetchWebsiteContent();

    if (currentContent === null) {
        console.log('Failed to fetch website content. Skipping this check.');
        return;
    }

    const bodyStart = currentContent.indexOf('<!-- Header / End -->');
    const bodyEnd = currentContent.indexOf('<!-- Footer ');

    const bodyContent = currentContent.substring(bodyStart, bodyEnd);
    const currentHash = getContentHash(bodyContent);

    if (previousContentHash === null) {
        previousContentHash = currentHash;
        console.log(`Initial scan complete. Content hash: ${currentHash}. Monitoring for changes.`);
    } else if (currentHash !== previousContentHash) {
        console.log(`Website content changed! Old hash: ${previousContentHash}, New hash: ${currentHash}`);
        const oldHashForEmail = previousContentHash;
        previousContentHash = currentHash;
        await sendEmail(
            `Website Changed: ${TARGET_URL}`,
            `The content of ${TARGET_URL} has changed.\n\nPrevious hash: ${oldHashForEmail}\nNew hash: ${currentHash}\n\nCheck the site: ${TARGET_URL}`
        );
    } else {
        console.log('No changes detected.');
    }
}

async function startMonitoring() {
    if (!TARGET_URL || !RECIPIENT_EMAIL || !SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SENDER_EMAIL) {
        console.error('Missing critical environment variables. Please check your .env file.');
        process.exit(1);
    }

    console.log('Starting website monitor...');
    await sendEmail(
        'Website Monitor Application Started',
        `The website monitoring application for ${TARGET_URL} has started successfully.\nIt will check for changes every ${CHECK_INTERVAL_MS / 1000} seconds.`
    );

    await checkWebsite();
    setInterval(checkWebsite, CHECK_INTERVAL_MS);
}

startMonitoring().catch(error => {
    console.error("Failed to start monitoring:", error);
    process.exit(1);
});
