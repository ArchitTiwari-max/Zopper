const XLSX = require('xlsx');
const path = require('path');

const inputFilePath = path.join(__dirname, 'SalesDost Working Store.xlsx');
const outputFilePath = path.join(__dirname, 'SalesDost Working Store with Tiers.xlsx');

// Read the workbook
const workbook = XLSX.readFile(inputFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Read as array of arrays to preserve exact layout and columns
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

if (rows.length === 0) {
  console.error('The excel sheet is empty!');
  process.exit(1);
}

// Define Tier 1 (X) cities (normalized to lowercase)
const tier1Cities = new Set([
  'delhi', 'new delhi', 'mumbai', 'bombay', 'bengaluru', 'bangalore', 'chennai', 'madras', 'hyderabad', 'kolkata', 'calcutta', 'pune', 'ahmedabad', 'ahmedbad'
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
  const clean = cityName.toString().trim().toLowerCase();
  if (tier1Cities.has(clean)) return 'Tier 1';
  if (tier2Cities.has(clean)) return 'Tier 2';
  return 'Tier 3';
}

const headerRow = rows[0];
const cityColIndex = headerRow.findIndex(h => h && h.toString().trim().toLowerCase() === 'city');

if (cityColIndex === -1) {
  console.error('Could not find "City" column in header row!');
  process.exit(1);
}

// Insert "City Tier" column header right after the "City" column
headerRow.splice(cityColIndex + 1, 0, 'City Tier');

// Process all data rows
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const cityName = row[cityColIndex];
  const tier = getCityTier(cityName);
  // Insert the tier value at the same index + 1
  row.splice(cityColIndex + 1, 0, tier);
}

// Create new sheet and workbook
const newWorksheet = XLSX.utils.aoa_to_sheet(rows);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

// Write to the output file
XLSX.writeFile(newWorkbook, outputFilePath);

console.log('Successfully added City Tier mappings!');
console.log('Output written to:', outputFilePath);
