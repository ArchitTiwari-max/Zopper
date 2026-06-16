const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, 'SalesDost Working Store.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Define Tier 1 (X) cities (normalized to lowercase)
const tier1Cities = new Set([
  'delhi',
  'new delhi',
  'mumbai',
  'bombay',
  'bengaluru',
  'bangalore',
  'chennai',
  'madras',
  'hyderabad',
  'kolkata',
  'calcutta',
  'pune',
  'ahmedabad',
  'ahmedbad'
]);

// Define Tier 2 (Y) cities (normalized to lowercase)
const tier2Cities = new Set([
  'agra', 'ajmer', 'akola', 'aligarh', 'amravati', 'amritsar', 'anand', 'asansol', 'aurangabad', 'aurangabadh',
  'bareilly', 'bareily', 'bardhaman', 'bardhman', 'belagavi', 'belgaum', 'berhampur', 'bhavnagar', 'bhiwandi',
  'bhopal', 'bhubaneswar', 'bhubneswar', 'bikaner', 'bilaspur', 'bokaro', 'bokaro steel city', 'bellary', 'ballari', 'bhilai',
  'chandigarh', 'coimbatore', 'cuttack', 'dahod', 'dehradun', 'dhule', 'dombivli', 'dhanbad', 'durgapur',
  'erode', 'faridabad', 'ghaziabad', 'gorakhpur', 'guntur', 'gurgaon', 'gurugram', 'guwahati', 'gwalior',
  'hamirpur', 'hubli', 'hubballi', 'hubli–dharwad', 'hubballi–dharwad', 'indore', 'jabalpur', 'jaipur', 'jalandhar', 'jalgaon',
  'jammu', 'jamshedpur', 'jamnagar', 'jhansi', 'jodhpur', 'kalaburagi', 'gulbarga', 'kakinada', 'kannur',
  'kanpur', 'karimnagar', 'karnal', 'kochi', 'cochin', 'kolhapur', 'kollam', 'kota', 'kozhikode', 'calicut',
  'kumbakonam', 'kurnool', 'ludhiana', 'lucknow', 'madurai', 'malappuram', 'mathura', 'mangalore', 'mangaluru',
  'meerut', 'mohali', 'moradabad', 'mysore', 'mysuru', 'nagpur', 'nanded', 'nadiad', 'nashik', 'nellore',
  'noida', 'greater noida', 'patna', 'pimpri-Chinchwad', 'puducherry', 'pondicherry', 'purulia', 'prayagraj', 'allahabad',
  'raipur', 'rajamahendravaram', 'rajahmundry', 'rajkot', 'ranchi', 'rourkela', 'ratlam', 'raichur', 'saharanpur',
  'salem', 'sangli', 'shimla', 'siliguri', 'solapur', 'srinagar', 'surat', 'thanjavur', 'thiruvananthapuram',
  'trivandrum', 'thrissur', 'tiruchirappalli', 'trichy', 'tirunelveli', 'tiruvannamalai', 'ujjain', 'vijayapura',
  'bijapur', 'vadodara', 'baroda', 'varanasi', 'vasai-virar', 'vijayawada', 'visakhapatnam', 'vizag', 'vellore', 'warangal'
]);

function getCityTier(cityName) {
  if (!cityName) return 'Tier 3';
  const clean = cityName.trim().toLowerCase();
  
  if (tier1Cities.has(clean)) {
    return 'Tier 1';
  }
  if (tier2Cities.has(clean)) {
    return 'Tier 2';
  }
  return 'Tier 3';
}

const mappingResults = {};
const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };

data.forEach(row => {
  const city = row.City;
  const tier = getCityTier(city);
  counts[tier]++;
  
  if (city) {
    mappingResults[city] = tier;
  }
});

console.log('Tier Counts in Excel Rows:');
console.log(counts);

// Print first 50 city mappings
console.log('\nSample Mappings:');
const sampleKeys = Object.keys(mappingResults).sort().slice(0, 80);
sampleKeys.forEach(city => {
  console.log(`  ${city}: ${mappingResults[city]}`);
});
