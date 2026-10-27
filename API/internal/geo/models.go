package geo

import "time"

type District struct {
	DistrictCode      string    `json:"district_code"`
	DistrictVersion   *string   `json:"district_version,omitempty"`
	DistrictName      string    `json:"district_name"`
	DistrictNameLocal *string   `json:"district_name_local,omitempty"`
	Census2001Code    *string   `json:"census_2001_code,omitempty"`
	Census2011Code    *string   `json:"census_2011_code,omitempty"`
	StateCode         string    `json:"state_code"`
	StateName         string    `json:"state_name"`
	CreatedAt         time.Time `json:"created_at"`
}

type Subdistrict struct {
	SubdistrictCode    string    `json:"subdistrict_code"`
	DistrictCode       string    `json:"district_code"`
	DistrictName       *string   `json:"district_name,omitempty"`
	SubdistrictVersion *string   `json:"subdistrict_version,omitempty"`
	SubdistrictName    string    `json:"subdistrict_name"`
	Census2001Code     *string   `json:"census_2001_code,omitempty"`
	Census2011Code     *string   `json:"census_2011_code,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}

type Block struct {
	BlockCode    string    `json:"block_code"`
	DistrictCode string    `json:"district_code"`
	DistrictName *string   `json:"district_name,omitempty"`
	BlockVersion *string   `json:"block_version,omitempty"`
	BlockName    string    `json:"block_name"`
	CreatedAt    time.Time `json:"created_at"`
}

type Village struct {
	VillageCode      string    `json:"village_code"`
	DistrictCode     string    `json:"district_code"`
	DistrictName     *string   `json:"district_name,omitempty"`
	SubdistrictCode  *string   `json:"subdistrict_code,omitempty"`
	SubdistrictName  *string   `json:"subdistrict_name,omitempty"`
	VillageVersion   *string   `json:"village_version,omitempty"`
	VillageName      string    `json:"village_name"`
	VillageNameLocal *string   `json:"village_name_local,omitempty"`
	VillageStatus    *string   `json:"village_status,omitempty"`
	Census2001Code   *string   `json:"census_2001_code,omitempty"`
	Census2011Code   *string   `json:"census_2011_code,omitempty"`
	BlockCode        *string   `json:"block_code,omitempty"`
	BlockName        *string   `json:"block_name,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

type UrbanLocalBody struct {
	LocalBodyCode      string    `json:"local_body_code"`
	LocalBodyTypeCode  *string   `json:"local_body_type_code,omitempty"`
	LocalBodyTypeName  *string   `json:"local_body_type_name,omitempty"`
	LocalBodyVersion   *string   `json:"local_body_version,omitempty"`
	LocalBodyName      string    `json:"local_body_name"`
	LocalBodyNameLocal *string   `json:"local_body_name_local,omitempty"`
	Census2001Code     *string   `json:"census_2001_code,omitempty"`
	Census2011Code     *string   `json:"census_2011_code,omitempty"`
	DistrictCode       *string   `json:"district_code,omitempty"`
	DistrictName       *string   `json:"district_name,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}

type UrbanWard struct {
	WardCode      string    `json:"ward_code"`
	LocalBodyCode string    `json:"local_body_code"`
	LocalBodyName *string   `json:"local_body_name,omitempty"`
	WardNumber    *string   `json:"ward_number,omitempty"`
	WardName      *string   `json:"ward_name,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type UrbanCityArea struct {
	WardCode     string    `json:"ward_code"`
	StateCode    string    `json:"state_code"`
	StateName    string    `json:"state_name"`
	DistrictCode string    `json:"district_code"`
	DistrictName *string   `json:"district_name,omitempty"`
	CityCode     string    `json:"city_code"`
	CityName     *string   `json:"city_name,omitempty"`
	WardNumber   *string   `json:"ward_number,omitempty"`
	AreaName     *string   `json:"area_name,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type RuralPlaceHierarchy struct {
	VillageCode     string    `json:"village_code"`
	StateCode       string    `json:"state_code"`
	StateName       string    `json:"state_name"`
	DistrictCode    string    `json:"district_code"`
	DistrictName    *string   `json:"district_name,omitempty"`
	BlockCode       string    `json:"block_code"`
	BlockName       *string   `json:"block_name,omitempty"`
	SubdistrictCode *string   `json:"subdistrict_code,omitempty"`
	SubdistrictName *string   `json:"subdistrict_name,omitempty"`
	VillageName     *string   `json:"village_name,omitempty"`
	VillageStatus   *string   `json:"village_status,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
