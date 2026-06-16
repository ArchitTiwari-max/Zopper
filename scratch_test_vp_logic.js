require('dotenv').config();
const axios = require('axios');
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const sampleNames = [
    { storeName: "Value Plus -Jhansi (Sipri Bazaar)", city: "Ghaziabad" },
    { storeName: "Value Plus -M/S National Electronics (Kasganj)", city: "Ghaziabad" },
    { storeName: "Value Plus -Brl (Dd Puram)", city: "Ghaziabad" },
    { storeName: "Value Plus -Ddn (Rajpur Road)", city: "Dehradun" }
];

function buildSearchQuery(storeName, city) {
    // Replace -, (, ) with spaces
    let cleanName = storeName.replace(/[-\(\)]/g, ' ');
    // Remove M/S to simplify
    cleanName = cleanName.replace(/M\/S/ig, '');
    cleanName = cleanName.replace(/\s+/g, ' ').trim();
    
    // Sometimes the 'city' column is a regional office (like Ghaziabad for Kasganj)
    // We'll include the city but rely heavily on the store name's text
    return `${cleanName}, ${city}, India`;
}

async function geocode(query) {
    const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        { params: { query, key: GOOGLE_API_KEY } }
    );
    if (data.status === 'OK' && data.results.length > 0) {
        return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng, address: data.results[0].formatted_address };
    }
    return { status: data.status || 'ZERO_RESULTS' };
}

async function main() {
    for (const s of sampleNames) {
        const q = buildSearchQuery(s.storeName, s.city);
        console.log(`Original: ${s.storeName} | City: ${s.city}`);
        console.log(`Query:    ${q}`);
        const res = await geocode(q);
        console.log(`Result:   `, res, `\n`);
    }
}

main().catch(console.error);
