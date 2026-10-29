package geo

import "time"

// CanonicalTamilNaduDistricts provides the 38 official districts of Tamil Nadu (state_code 33).
var CanonicalTamilNaduDistricts = []District{
	{DistrictCode: "610", DistrictName: "Ariyalur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "730", DistrictName: "Chengalpattu", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "568", DistrictName: "Chennai", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "569", DistrictName: "Coimbatore", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "570", DistrictName: "Cuddalore", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "571", DistrictName: "Dharmapuri", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "572", DistrictName: "Dindigul", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "573", DistrictName: "Erode", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "729", DistrictName: "Kallakurichi", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "574", DistrictName: "Kancheepuram", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "575", DistrictName: "Kanniyakumari", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "576", DistrictName: "Karur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "577", DistrictName: "Krishnagiri", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "578", DistrictName: "Madurai", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "735", DistrictName: "Mayiladuthurai", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "579", DistrictName: "Nagapattinam", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "580", DistrictName: "Namakkal", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "581", DistrictName: "Perambalur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "582", DistrictName: "Pudukkottai", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "583", DistrictName: "Ramanathapuram", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "731", DistrictName: "Ranipet", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "584", DistrictName: "Salem", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "585", DistrictName: "Sivaganga", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "733", DistrictName: "Tenkasi", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "586", DistrictName: "Thanjavur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "587", DistrictName: "The Nilgiris", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "588", DistrictName: "Theni", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "589", DistrictName: "Thiruvallur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "590", DistrictName: "Thiruvarur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "594", DistrictName: "Thoothukkudi", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "591", DistrictName: "Tiruchirappalli", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "592", DistrictName: "Tirunelveli", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "732", DistrictName: "Tirupathur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "634", DistrictName: "Tiruppur", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "593", DistrictName: "Tiruvannamalai", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "595", DistrictName: "Vellore", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "596", DistrictName: "Viluppuram", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
	{DistrictCode: "597", DistrictName: "Virudhunagar", StateCode: "33", StateName: "Tamil Nadu", CreatedAt: time.Now()},
}

// GetCanonicalDistricts returns the canonical 38 districts of Tamil Nadu.
func GetCanonicalDistricts() []District {
	out := make([]District, len(CanonicalTamilNaduDistricts))
	copy(out, CanonicalTamilNaduDistricts)
	return out
}

