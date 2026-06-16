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
  'bijapur', 'vadodara', 'baroda', 'varanasi', 'vasai-virar', 'vijayawada', 'visakhapatnam', 'vizag', 'vellore', 'warangal',
  
  // Extra verified Y-class / Tier 2 cities:
  'thane', 'howrah', 'secunderabad', 'gandhinagar', 'panchkula', 'tirupati', 'tiruppur', 'tirupur', 'udaipur', 
  'muzaffarpur', 'muzzafarpur', 'muzaffarnagar', 'patiala', 'rohtak', 'shimoga', 'shivamogga', 'dewas', 
  'davanagere', 'durg', 'durg-bhilainagar', 'eluru', 'ernakulam', 'haridwar', 'hisar', 'hospet', 'hosur', 
  'jalna', 'junagadh', 'junagarh', 'kadapa', 'cuddapah', 'khammam', 'latur', 'machilipatnam', 'mehsana', 
  'mahesana', 'nandyal', 'ongole', 'panaji', 'panipat', 'pathankot', 'puri', 'purnea', 'raebareli', 'rampur', 
  'rewa', 'satara', 'satna', 'sikar', 'silchar', 'sirsa', 'siwan', 'sonipat', 'sonepat', 'tenali', 'tumkur', 
  'udupi', 'valsad', 'vapi', 'vizianagaram', 'wardha', 'yamunanagar', 'yamuna nagar', 'yavatmal', 'zirakpur', 
  'zirakhpur', 'agartala', 'ahmednagar', 'alwar', 'ambala', 'anantapur', 'ayodhya', 'faizabad', 'baharampur', 
  'bathinda', 'beed', 'begusarai', 'bharatpur', 'bharuch', 'bhilwara', 'bhiwadi', 'bhiwani', 'bhuj', 'bidar', 
  'bulandshahr', 'bulandsahar', 'cuddalore', 'dindigul', 'dibrugarh', 'dimapur', 'etawah', 'firozabad', 
  'gandhidham', 'shri ganganagar', 'sriganganagar', 'gangtok', 'giridih', 'hajipur', 'haldia', 'haldwani', 
  'hassan', 'hooghly', 'hoshiarpur', 'ichalkaranji', 'ichalkranjii', 'itanagar', 'jagdalpur', 'jaunpur', 
  'jind', 'jorhat', 'kanchipuram', 'karur', 'katihar', 'kharagpur', 'kolar', 'korba', 'kottayam', 
  'krishnanagar', 'krishna nagar', 'kurukshetra', 'lakhimpur', 'malda', 'mandya', 'mau', 'miraj', 'mirzapur', 
  'moga', 'morbi', 'motihari', 'muktsar', 'mukstar', 'nagercoil', 'namakkal', 'navsari', 'nizamabad', 
  'palakkad', 'palwal', 'patan', 'pollachi', 'porbandar', 'proddatur', 'pudukkottai', 'raiganj', 'raigarh', 
  'rajnandgaon', 'raniganj', 'ratnagiri', 'rewari', 'roorkee', 'rudrapur', 'sagar', 'samastipur', 'sambalpur', 
  'sanand', 'sangrur', 'sasaram', 'serampore', 'sreerampore', 'shahjahanpur', 'shillong', 'sitapur', 
  'srikakulam', 'surendranagar', 'tezpur', 'thiruvallur', 'viluppuram',
  
  // Additional spelling variations / synonyms
  'chhatrapati sambhaji nagar', 'burdwan', 'darbhanga', 'dharwad', 'ganganagar', 'nagarcoil', 'raurkela', 
  'thiruvannamalai', 'warrangal', 'chandrapur', 'davangere'
]);

function getCityTier(cityName) {
  if (!cityName) return 'Tier 3';
  const clean = cityName.trim().toLowerCase();
  if (tier1Cities.has(clean)) return 'Tier 1';
  if (tier2Cities.has(clean)) return 'Tier 2';
  return 'Tier 3';
}

const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };
const tier3Cities = new Set();

data.forEach(row => {
  const city = row.City;
  const tier = getCityTier(city);
  counts[tier]++;
  if (tier === 'Tier 3' && city) {
    tier3Cities.add(city.trim());
  }
});

console.log('Final Tier Counts:');
console.log(counts);
console.log('Remaining Tier 3 unique cities:', tier3Cities.size);
console.log('Remaining Tier 3 cities:');
console.log(Array.from(tier3Cities).sort().join(', '));
