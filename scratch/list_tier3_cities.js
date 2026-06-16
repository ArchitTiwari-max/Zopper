const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'SalesDost Working Store.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

const tier1Cities = new Set([
  'delhi', 'new delhi', 'mumbai', 'bombay', 'bengaluru', 'bangalore', 'chennai', 'madras', 'hyderabad', 'kolkata', 'calcutta', 'pune', 'ahmedabad', 'ahmedbad'
]);

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
  'noida', 'greater noida', 'patna', 'pimpri-chinchwad', 'puducherry', 'pondicherry', 'purulia', 'prayagraj', 'allahabad',
  'raipur', 'rajamahendravaram', 'rajahmundry', 'rajkot', 'ranchi', 'rourkela', 'ratlam', 'raichur', 'saharanpur',
  'salem', 'sangli', 'shimla', 'siliguri', 'solapur', 'srinagar', 'surat', 'thanjavur', 'thiruvananthapuram',
  'trivandrum', 'thrissur', 'tiruchirappalli', 'trichy', 'tirunelveli', 'tiruvannamalai', 'ujjain', 'vijayapura',
  'bijapur', 'vadodara', 'baroda', 'varanasi', 'vasai-virar', 'vijayawada', 'visakhapatnam', 'vizag', 'vellore', 'warangal'
]);

function getCityTier(cityName) {
  if (!cityName) return 'Tier 3';
  const clean = cityName.trim().toLowerCase();
  if (tier1Cities.has(clean)) return 'Tier 1';
  if (tier2Cities.has(clean)) return 'Tier 2';
  return 'Tier 3';
}

const tier3Cities = new Set();
data.forEach(row => {
  const city = row.City;
  if (city && getCityTier(city) === 'Tier 3') {
    tier3Cities.add(city.trim());
  }
});

console.log('Tier 3 Cities List (total ' + tier3Cities.size + '):');
console.log(Array.from(tier3Cities).sort().join(', '));
