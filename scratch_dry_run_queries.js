const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cleanStoreName(storeName, city) {
    let cleanName = storeName.replace(/\bASP\b/gi, '');
    
    if (city) {
        const escapedCity = city.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'gi');
        cleanName = cleanName.replace(cityRegex, '');
    }

    cleanName = cleanName.replace(/\(\s*\)/g, ' ');
    cleanName = cleanName.replace(/[-\(\)]/g, ' ');
    return cleanName.replace(/\s+/g, ' ').trim();
}

async function main() {
    const allStores = await prisma.store.findMany({
        select: { id: true, storeName: true, city: true }
    });

    const excludeTerms = [
        'reliance',
        'croma',
        'value plus',
        'vasanth',
        'hotspot',
        'vijay sales'
    ];

    const localStores = allStores.filter(store => {
        if (!store.storeName) return true;
        const nameLower = store.storeName.toLowerCase();
        if (excludeTerms.some(term => nameLower.includes(term))) return false;
        if (nameLower.includes('vs-') || nameLower.startsWith('vs ')) return false;
        return true;
    });

    console.log(`First 25 Search Queries:`);
    localStores.slice(0, 25).forEach((store, i) => {
        const cleanedName = cleanStoreName(store.storeName, store.city);
        const citySuffix = store.city ? `, ${store.city}` : '';
        const query = `${cleanedName}${citySuffix}, India`;
        console.log(`${i+1}. Original: "${store.storeName}" (${store.city}) => Query: "${query}"`);
    });

    console.log(`\nSample of stores with 'ASP' to check cleaning logic:`);
    const aspStores = localStores.filter(s => s.storeName.includes('ASP'));
    aspStores.slice(0, 10).forEach((store, i) => {
        const cleanedName = cleanStoreName(store.storeName, store.city);
        const citySuffix = store.city ? `, ${store.city}` : '';
        const query = `${cleanedName}${citySuffix}, India`;
        console.log(`${i+1}. Original: "${store.storeName}" (${store.city}) => Query: "${query}"`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
