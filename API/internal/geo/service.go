package geo

import (
	"context"
	"fmt"
	"strings"
)

type Service interface {
	GetDistricts(ctx context.Context) ([]District, error)
	GetSubdistrictsByDistrict(ctx context.Context, districtCode string) ([]Subdistrict, error)
	GetBlocksByDistrict(ctx context.Context, districtCode string) ([]Block, error)
	GetVillages(ctx context.Context, districtCode, subdistrictCode, blockCode, search string, limit, offset int) ([]Village, int, error)
	GetUrbanLocalBodiesByDistrict(ctx context.Context, districtCode string) ([]UrbanLocalBody, error)
	GetUrbanWardsByLocalBody(ctx context.Context, localBodyCode string) ([]UrbanWard, error)
	GetUrbanCityAreas(ctx context.Context, districtCode, cityCode string) ([]UrbanCityArea, error)
	GetRuralHierarchy(ctx context.Context, districtCode, blockCode string, limit, offset int) ([]RuralPlaceHierarchy, int, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetDistricts(ctx context.Context) ([]District, error) {
	return s.repo.GetDistricts(ctx)
}

func (s *service) GetSubdistrictsByDistrict(ctx context.Context, districtCode string) ([]Subdistrict, error) {
	districtCode = strings.TrimSpace(districtCode)
	if districtCode == "" {
		return nil, fmt.Errorf("district_code is required")
	}
	return s.repo.GetSubdistrictsByDistrict(ctx, districtCode)
}

func (s *service) GetBlocksByDistrict(ctx context.Context, districtCode string) ([]Block, error) {
	districtCode = strings.TrimSpace(districtCode)
	if districtCode == "" {
		return nil, fmt.Errorf("district_code is required")
	}
	return s.repo.GetBlocksByDistrict(ctx, districtCode)
}

func (s *service) GetVillages(ctx context.Context, districtCode, subdistrictCode, blockCode, search string, limit, offset int) ([]Village, int, error) {
	return s.repo.GetVillages(ctx, strings.TrimSpace(districtCode), strings.TrimSpace(subdistrictCode), strings.TrimSpace(blockCode), strings.TrimSpace(search), limit, offset)
}

func (s *service) GetUrbanLocalBodiesByDistrict(ctx context.Context, districtCode string) ([]UrbanLocalBody, error) {
	districtCode = strings.TrimSpace(districtCode)
	if districtCode == "" {
		return nil, fmt.Errorf("district_code is required")
	}
	return s.repo.GetUrbanLocalBodiesByDistrict(ctx, districtCode)
}

func (s *service) GetUrbanWardsByLocalBody(ctx context.Context, localBodyCode string) ([]UrbanWard, error) {
	localBodyCode = strings.TrimSpace(localBodyCode)
	if localBodyCode == "" {
		return nil, fmt.Errorf("local_body_code is required")
	}
	return s.repo.GetUrbanWardsByLocalBody(ctx, localBodyCode)
}

func (s *service) GetUrbanCityAreas(ctx context.Context, districtCode, cityCode string) ([]UrbanCityArea, error) {
	return s.repo.GetUrbanCityAreas(ctx, strings.TrimSpace(districtCode), strings.TrimSpace(cityCode))
}

func (s *service) GetRuralHierarchy(ctx context.Context, districtCode, blockCode string, limit, offset int) ([]RuralPlaceHierarchy, int, error) {
	return s.repo.GetRuralHierarchy(ctx, strings.TrimSpace(districtCode), strings.TrimSpace(blockCode), limit, offset)
}
