package models

// PaginationMeta represents pagination metadata in API responses.
type PaginationMeta struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

// NewPaginationMeta creates a new pagination metadata object.
func NewPaginationMeta(limit, offset, total int) *PaginationMeta {
	return &PaginationMeta{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	}
}
