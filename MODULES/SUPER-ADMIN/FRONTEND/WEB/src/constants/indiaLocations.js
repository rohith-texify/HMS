/**
 * Canonical Indian Geographic Directory for Super Admin College Onboarding
 * Structure: State -> Cities -> Areas
 */

export const INDIAN_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST - Indian Standard Time, UTC+05:30)' },
];

export const INDIAN_LOCATIONS = {
  'Andaman and Nicobar Islands': {
    'Port Blair': ['Aberdeen Bazar', 'Garacharma', 'Dollygunj', 'Shadipur', 'Haddo', 'Brookshabad / DBRAIT Campus'],
  },
  'Andhra Pradesh': {
    'Visakhapatnam': ['Andhra University Campus', 'Rushikonda / IT SEZ', 'Madhurawada', 'MVP Colony', 'Gajuwaka', 'Dwaraka Nagar', 'Pendurthi'],
    'Vijayawada': ['Benz Circle', 'Kanuru / Siddhartha Nagar', 'Auto Nagar', 'Governorpet', 'Bhavanipuram', 'Gannavaram'],
    'Tirupati': ['SV University Campus', 'SVIMS Campus', 'Yerpedu / IIT Tirupati', 'Chandragiri', 'Alipiri', 'Renigunta'],
    'Guntur': ['Brodipet', 'Arundelpet', 'Nallapadu', 'Vadlamudi / Vignan Campus', 'Pattabhipuram'],
    'Kurnool': ['Jagannatha Gattu / IIITDM', 'C-Camp', 'B-Camp', 'Nandyal Checkpost'],
    'Kakinada': ['JNTUK Campus', 'Bhanugudi', 'Suryaraopeta', 'Collectorate Area'],
    'Anantapur': ['JNTUA Campus', 'Clock Tower Area', 'Subash Nagar'],
  },
  'Arunachal Pradesh': {
    'Itanagar': ['Nirjuli / NERIST Campus', 'Ganga', 'Chimpu', 'Naharlagun', 'Pappu Nallah'],
    'Pasighat': ['Central Agricultural University', 'Mirsam', 'Hilltop'],
  },
  'Assam': {
    'Guwahati': ['Jalukbari / Gauhati University', 'North Guwahati / IITG Campus', 'Dispur', 'Six Mile', 'Pan Bazaar', 'Khanapara'],
    'Silchar': ['NIT Silchar Campus', 'Tarapur', 'Meherpur', 'Rangirkhari'],
    'Dibrugarh': ['Dibrugarh University Campus', 'Boiragimoth', 'Chowkidinghee', 'Milan Nagar'],
    'Jorhat': ['AAU Jorhat Campus', 'Tarajan', 'Gar-Ali', 'Cinnamara'],
    'Tezpur': ['Napaam / Tezpur University', 'Mission Chariali', 'Ketekibari'],
  },
  'Bihar': {
    'Patna': ['Bihta / IIT Patna', 'Bailey Road', 'Boring Road', 'Kankarbagh', 'Patna University Campus / Ashok Rajpath', 'Rajendra Nagar'],
    'Gaya': ['Bodh Gaya / Central University', 'Civil Lines', 'AP Colony', 'Delha'],
    'Bhagalpur': ['Tilkamanjhi / TMBU Campus', 'Adampur', 'Barari', 'Zero Mile'],
    'Muzaffarpur': ['Brahmpura', 'Mithanpura', 'Kalambagh Chowk', 'Bela Industrial Area'],
    'Darbhanga': ['Kameshwaranagar / LNMU Campus', 'Laheriasarai', 'Tower Chowk'],
  },
  'Chandigarh': {
    'Chandigarh': ['Sector 14 / Panjab University', 'Sector 12 / PEC Campus', 'Sector 17', 'Sector 22', 'Sector 26', 'Sector 35', 'Sector 43'],
  },
  'Chhattisgarh': {
    'Raipur': ['Tatibandh / AIIMS Campus', 'Telibandha', 'Naya Raipur / IIIT Campus', 'Pandri', 'Shankar Nagar', 'NIT Raipur Area'],
    'Bhilai': ['Sector 6', 'Nehru Nagar', 'Smriti Nagar', 'Junwani / BIT Durg', 'Supela'],
    'Bilaspur': ['Koni / GGV Campus', 'Vyapar Vihar', 'Link Road', 'Torwa'],
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    'Daman': ['Nani Daman', 'Moti Daman', 'Dunetha', 'Kadaiya'],
    'Silvassa': ['Dokmardi / Medical College Campus', 'Tokarkhada', 'Amli', 'Samarvarni'],
  },
  'Delhi (NCT)': {
    'New Delhi': ['Hauz Khas / IIT Delhi', 'Connaught Place', 'Chanakyapuri', 'Vasant Kunj', 'Dwarka / GGSIPU Campus', 'Civil Lines / North Campus DU', 'South Extension', 'Rohini / DTU Campus', 'Okhla / IIIT-Delhi', 'Janakpuri', 'Pitampura', 'Mayur Vihar'],
  },
  'Goa': {
    'Panaji': ['Taleigao / Goa University', 'Miramar', 'Altinho', 'Campal', 'Caranzalem'],
    'Vasco da Gama': ['Zuarinagar / BITS Pilani Goa', 'Chicalim', 'Mangor Hill'],
    'Margao': ['Fatorda', 'Pajifond', 'Aquem', 'Gogol'],
  },
  'Gujarat': {
    'Ahmedabad': ['Navrangpura / Gujarat University', 'Vastrapur / IIM-A', 'Satellite', 'Bodakdev', 'SG Highway', 'Chandkheda / GTU Campus', 'Paldi'],
    'Gandhinagar': ['Raysan / PDEU Campus', 'Infocity', 'Sector 7', 'Sector 21', 'Sector 28', 'Kudasan / DA-IICT'],
    'Vadodara': ['Fatehgunj / MSU Campus', 'Alkapuri', 'Sayajigunj', 'Gotri', 'Manjalpur', 'Waghodia Road / Parul Campus'],
    'Surat': ['Vesu / SVNIT Campus', 'Piplod', 'Athwalines', 'Adajan', 'City Light'],
    'Rajkot': ['University Road / Saurashtra University', 'Kalawad Road', 'Yagnik Road', '150 Feet Ring Road'],
  },
  'Haryana': {
    'Gurugram': ['Cyber City', 'Sector 14', 'Sector 29', 'Sector 56', 'Sohna Road', 'Manesar'],
    'Faridabad': ['Sector 15', 'Sector 16', 'NIT 1-5', 'Greater Faridabad', 'YMCA Campus Area'],
    'Kurukshetra': ['Kurukshetra University Campus', 'NIT Kurukshetra Area', 'Thanesar', 'Pipli'],
    'Rohtak': ['MDU Campus', 'Model Town', 'Delhi Road', 'Subhash Nagar'],
    'Hisar': ['HAU Campus', 'GJU Campus', 'Model Town', 'Urban Estate'],
  },
  'Himachal Pradesh': {
    'Shimla': ['Summer Hill / HPU Campus', 'Mall Road', 'Sanjauli', 'Chotta Shimla'],
    'Mandi': ['Kamand / IIT Mandi', 'Sauli Khad', 'Jail Road', 'Bhiuli'],
    'Hamirpur': ['Anu / NIT Hamirpur', 'Gandhi Chowk', 'Salasi'],
    'Dharamsala': ['Central University Campus', 'Kotwali Bazaar', 'McLeodGanj', 'Dari'],
    'Solan': ['Nauni / YSP University', 'Mall Road', 'Chambaghat'],
  },
  'Jammu and Kashmir': {
    'Srinagar': ['Hazratbal / NIT Srinagar & Kashmir University', 'Lal Chowk', 'Rajbagh', 'Karan Nagar'],
    'Jammu': ['Jammu University Campus', 'Gandhi Nagar', 'Trikuta Nagar', 'Channi Himmat', 'Bari Brahmana'],
  },
  'Jharkhand': {
    'Ranchi': ['Mesra / BIT Mesra Campus', 'Morabadi / Ranchi University', 'Lalpur', 'Kanke / BAU Campus', 'Doranda', 'Hinoo'],
    'Jamshedpur': ['Adityapur / NIT Jamshedpur', 'Bistupur', 'Sakchi', 'Telco', 'Kadma', 'Sonari'],
    'Dhanbad': ['IIT ISM Campus', 'Bank More', 'Saraidhela', 'Hirapur', 'Steel Gate'],
    'Bokaro': ['Sector 4', 'Sector 1', 'Chas', 'Sector 9'],
  },
  'Karnataka': {
    'Bengaluru': ['Malleshwaram / IISc Campus', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield', 'Electronic City', 'Yelahanka', 'HSR Layout', 'Rajajinagar', 'Hebbal', 'Basavanagudi', 'BTM Layout', 'Banashankari'],
    'Mangalore': ['Surathkal / NITK Campus', 'Srinivasnagar', 'Konaje / Mangalore University', 'Hampankatta', 'Kadri', 'Kottara', 'Derlakatte', 'Bejai', 'Urwa', 'Kankanady'],
    'Mysuru': ['Manasagangotri / University of Mysore', 'Saraswathipuram', 'Jayalakshmipuram', 'Kuvempunagar', 'Gokulam', 'Vijayanagar'],
    'Manipal / Udupi': ['Madhav Nagar / MAHE Campus', 'Tiger Circle', 'Eshwar Nagar', 'Vidyaratna Nagar', 'Manipal End Point', 'Udupi Town'],
    'Hubballi-Dharwad': ['Dharwad University Campus', 'IIT Dharwad Area', 'Vidyanagar', 'Keshwapur', 'Gokul Road', 'Navanagar'],
    'Belagavi': ['VTU Campus / Machhe', 'Tilakwadi', 'Camp', 'Udyambag'],
    'Kalaburagi': ['Central University Campus', 'Sedam Road', 'Station Road'],
    'Davanagere': ['MCC ' + "'A' Block", "MCC 'B' Block", 'Vidyanagar', 'Hadadi Road'],
    'Shivamogga': ['Kuvempu University Area', 'Vinoba Nagara', 'Gandhi Nagara'],
    'Tumakuru': ['SIT Campus / Batawadi', 'Ashok Nagar', 'SS Puram'],
  },
  'Kerala': {
    'Thiruvananthapuram': ['Kariavattom / Kerala University', 'Kazhakkoottam / Technopark', 'Palayam', 'Pattom', 'Vellayambalam', 'Kowdiar'],
    'Kochi': ['Kalamassery / CUSAT Campus', 'Kakkanad / Infopark', 'Edappally', 'MG Road', 'Thrikkakara', 'Kaloor'],
    'Kozhikode': ['Kunnamangalam / IIMK & NITC', 'Mavoor Road', 'Palayam', 'Medical College Campus'],
    'Thrissur': ['Ayyanthole', 'Round North', 'Mannuthy / KAU Campus', 'Ramavarmapuram'],
    'Kottayam': ['Athirampuzha / MG University', 'Gandhinagar', 'Collectorate Area'],
  },
  'Ladakh': {
    'Leh': ['Choglamsar / University Campus', 'Main Bazaar', 'Skara', 'Shey'],
    'Kargil': ['Main Market', 'Baroo', 'Biamathang'],
  },
  'Lakshadweep': {
    'Kavaratti': ['Island Central', 'North Jetty Area', 'Court Complex Area'],
  },
  'Madhya Pradesh': {
    'Bhopal': ['MANIT Campus', 'MP Nagar', 'Arera Colony', 'Kolar Road', 'Hoshangabad Road', 'Barkatullah University Area'],
    'Indore': ['Simrol / IIT Indore', 'Vijay Nagar', 'Palasia', 'Bhawarkua / DAVV Campus', 'Super Corridor'],
    'Gwalior': ['Gwalior City Centre', 'Jiwaji University Area', 'Morar', 'Lashkar'],
    'Jabalpur': ['Civil Lines', 'Wright Town', 'Napier Town', 'Madan Mahal', 'IIITDM Campus Area'],
    'Ujjain': ['Vikram University Campus', 'Freeganj', 'Madhav Nagar'],
  },
  'Maharashtra': {
    'Mumbai': ['Powai / IIT Bombay', 'Andheri East', 'Andheri West', 'Bandra West', 'Dadar', 'Nariman Point', 'Borivali', 'Chembur', 'Vile Parle', 'Ghatkopar', 'Fort / Mumbai University'],
    'Pune': ['Shivajinagar / COEP', 'Kothrud', 'Baner', 'Hinjawadi IT Park', 'Aundh', 'Viman Nagar', 'Katraj / Bharati Vidyapeeth', 'Wakad', 'Deccan Gymkhana', 'Hadapsar', 'Pimpri-Chinchwad'],
    'Nagpur': ['VNIT Campus', 'Dharampeth', 'Ramdaspeth', 'Wardha Road', 'Sitabuldi', 'Sadar', 'Hingna'],
    'Navi Mumbai': ['Kharghar / Bharati Vidyapeeth & NIFT', 'Vashi', 'Nerul', 'Belapur', 'Seawoods', 'Airoli'],
    'Thane': ['Ghodbunder Road', 'Naupada', 'Panchpakhadi', 'Majiwada'],
    'Nashik': ['Gangapur Road', 'College Road', 'Panchavati', 'Indira Nagar'],
    'Chhatrapati Sambhajinagar': ['BAMU University Campus', 'CIDCO', 'Samarth Nagar', 'Waluj'],
  },
  'Manipur': {
    'Imphal': ['Canchipur / Manipur University', 'NIT Manipur Area', 'Thangal Bazaar', 'Lamphelpat', 'Porompat'],
  },
  'Meghalaya': {
    'Shillong': ['Mawkynroh / NEHU Campus', 'Police Bazar', 'Laitumkhrah', 'Mawlai', 'Nongthymmai'],
  },
  'Mizoram': {
    'Aizawl': ['Tanhril / Mizoram University', 'Zarkawt', 'Dawrpui', 'Khatla', 'Bawngkawn'],
  },
  'Nagaland': {
    'Kohima': ['Meriema / Nagaland University', 'High School Colony', 'Razhu Point', 'PR Hill'],
    'Dimapur': ['Chumukedima / NIT Nagaland', 'Circular Road', 'Duncan Bosti'],
  },
  'Odisha': {
    'Bhubaneswar': ['Patia / KIIT Campus', 'Chandrasekharpur', 'Jayadev Vihar', 'Nayapalli', 'Saheed Nagar', 'Infacity', 'Khandagiri'],
    'Cuttack': ['Ravenshaw University Campus', 'CDA Sector 1-10', 'Badambadi', 'Mangalabag'],
    'Rourkela': ['Sector 1 / NIT Rourkela', 'Civil Township', 'Panposh', 'Udit Nagar'],
    'Sambalpur': ['Burla / VSSUT & Sambalpur University', 'Budharaja', 'Dhanupali'],
  },
  'Puducherry': {
    'Puducherry': ['Kalapet / Pondicherry University', 'White Town', 'Lawspet', 'Muthialpet', 'Saram'],
  },
  'Punjab': {
    'Amritsar': ['GNDU Campus', 'Ranjit Avenue', 'Mall Road', 'Lawrence Road'],
    'Ludhiana': ['PAU Campus', 'Sarabha Nagar', 'Model Town', 'Civil Lines', 'Ferozepur Road'],
    'Jalandhar': ['NIT Jalandhar Campus', 'Model Town', 'Urban Estate', 'BMC Chowk'],
    'Patiala': ['Thapar University Campus', 'Punjabi University Campus', 'Model Town', 'Leela Bhawan'],
    'Mohali': ['Sector 81 / IISER Campus', 'Phase 7', 'Phase 8', 'Sector 68', 'Sector 70'],
  },
  'Rajasthan': {
    'Jaipur': ['Malviya Nagar / MNIT Campus', 'Mansarovar', 'Vaishali Nagar', 'Jagatpura', 'Tonk Road', 'Raja Park', 'Pratap Nagar'],
    'Jodhpur': ['Karwar / IIT Jodhpur', 'Ratanada', 'Shastri Nagar', 'Sardarpura'],
    'Kota': ['Rajeev Gandhi Nagar / Coaching Hub', 'Talwandi', 'Vigyan Nagar', 'Mahaveer Nagar', 'Kunhari'],
    'Pilani': ['BITS Pilani Campus', 'Vidya Vihar', 'Nayapara'],
    'Udaipur': ['MLSU University Campus', 'Madhuban', 'Hiran Magri', 'Sukhadia Circle'],
  },
  'Sikkim': {
    'Gangtok': ['Tadong / Sikkim University', 'Deorali', 'MG Marg', 'Sichey'],
  },
  'Tamil Nadu': {
    'Chennai': ['Guindy / Anna University', 'IIT Madras Campus / Adyar', 'T. Nagar', 'Velachery', 'OMR / IT Corridor', 'Anna Nagar', 'Tambaram / MCC', 'Porur / Sri Ramachandra', 'Mylapore', 'Sholinganallur', 'Nungambakkam'],
    'Coimbatore': ['Peelamedu / PSG Tech Area', 'RS Puram', 'Gandhipuram', 'Saravanampatti / IT Corridor', 'Saibaba Colony', 'Vadavalli / Bharathiar University'],
    'Tiruchirappalli': ['Thuvakudi / NIT Trichy', 'Thillai Nagar', 'Cantonment', 'KK Nagar', 'Srirangam'],
    'Madurai': ['Madurai Kamaraj University Area', 'KK Nagar', 'Anna Nagar', 'Goripalayam', 'Pasumalai'],
    'Salem': ['Periyar University Area', 'Fairlands', 'Alagapuram', 'Hasthampatti'],
    'Vellore': ['Katpadi / VIT University Campus', 'Bagayam / CMC Campus', 'Gandhi Nagar', 'Sathuvachari'],
    'Tirunelveli': ['Palayamkottai', 'Vannarpettai', 'Perumalpuram'],
  },
  'Telangana': {
    'Hyderabad': ['Gachibowli / IIIT-H & HCU', 'Hitec City / Madhapur', 'Kandi / IIT Hyderabad', 'Kukatpally / JNTU', 'Tarnaka / Osmania University', 'Banjara Hills', 'Jubilee Hills', 'Begumpet', 'Secunderabad', 'Kondapur', 'Dilsukhnagar'],
    'Warangal': ['Kazipet / NIT Warangal', 'Hanamkonda', 'Subedari', 'Nayeem Nagar'],
    'Karimnagar': ['Mukarrampura', 'Mankammathota', 'Vidyanagar'],
    'Nizamabad': ['Khaleelwadi', 'Subhash Nagar', 'Pragathi Nagar'],
  },
  'Tripura': {
    'Agartala': ['Jirania / NIT Agartala', 'Suryamaninagar / Tripura University', 'Banamalipur', 'Kunjaban', 'Ramnagar'],
  },
  'Uttar Pradesh': {
    'Lucknow': ['Gomti Nagar', 'Jankipuram / AKTU Campus', 'IIM Road / IIM Lucknow', 'Aliganj', 'Hazratganj', 'Indira Nagar', 'Lucknow University Campus / Babuganj'],
    'Kanpur': ['Kalyanpur / IIT Kanpur', 'Swaroop Nagar', 'Civil Lines', 'Kakadeo / Coaching Hub', 'Kidwai Nagar'],
    'Varanasi': ['BHU Campus / IIT BHU', 'Lanka', 'Sigra', 'Cantt', 'Orderly Bazar'],
    'Noida & Greater Noida': ['Knowledge Park I-III / University Cluster', 'Pari Chowk', 'Sector 62', 'Sector 18', 'Sector 128', 'Sector 137'],
    'Prayagraj': ['Teliyarganj / MNNIT Campus', 'Jhalwa / IIIT Allahabad', 'Civil Lines', 'Georgetown', 'Katra / AU Campus'],
    'Aligarh': ['AMU Campus', 'Civil Lines', 'Marris Road', 'Ramghat Road'],
    'Agra': ['Dayalbagh University Area', 'Sanjay Place', 'Civil Lines', 'Kamla Nagar'],
    'Meerut': ['CCSU University Campus', 'Modipuram', 'Shastri Nagar', 'Meerut Cantt'],
    'Ghaziabad': ['Raj Nagar Extension', 'Indirapuram', 'Vaishali', 'Crossings Republik'],
    'Gorakhpur': ['MMMUT Campus', 'Civil Lines', 'Golghar', 'Taramandal'],
  },
  'Uttarakhand': {
    'Dehradun': ['Bidholi / UPES Campus', 'Prem Nagar / Uttaranchal University', 'Rajpur Road', 'Jakhan', 'Clement Town / Graphic Era', 'Sahastradhara Road'],
    'Roorkee': ['IIT Roorkee Campus', 'Civil Lines', 'Ramnagar', 'Solani Puram'],
    'Haridwar': ['Gurukul Kangri Campus', 'Ranipur / BHEL', 'Shivalik Nagar'],
    'Pantnagar': ['GBPUAT University Campus', 'Nagla', 'Kichha Road'],
  },
  'West Bengal': {
    'Kolkata': ['Jadavpur / JU Campus', 'Salt Lake / Sector V & Techno India', 'New Town', 'College Street / Calcutta University', 'Ballygunge', 'Park Street', 'Howrah / IIEST Shibpur', 'Rajarhat', 'Garia'],
    'Kharagpur': ['IIT Kharagpur Campus', 'Prembazar', 'Inda', 'Golbazar'],
    'Durgapur': ['NIT Durgapur Campus / City Centre', 'B-Zone', 'Benachity', 'A-Zone'],
    'Siliguri': ['Shivmandir / North Bengal University', 'Pradhan Nagar', 'Hakim Para', 'Matigara'],
  },
};

export const INDIAN_STATES = Object.keys(INDIAN_LOCATIONS).sort();

export function getCitiesForState(state) {
  if (!state || !INDIAN_LOCATIONS[state]) return [];
  return Object.keys(INDIAN_LOCATIONS[state]).sort();
}

export function getAreasForCity(state, city) {
  if (!state || !city || !INDIAN_LOCATIONS[state] || !INDIAN_LOCATIONS[state][city]) return [];
  return [...INDIAN_LOCATIONS[state][city]].sort();
}
