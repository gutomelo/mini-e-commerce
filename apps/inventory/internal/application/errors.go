package application

import "errors"

// ErrNotFound is returned by GetStockUseCase when no stock row exists for
// the requested product id. The presentation layer maps it to a 404
// response.
var ErrNotFound = errors.New("stock: not found")

// ErrInvalidQuantity is returned by SetStockUseCase when the requested
// quantity is negative. The presentation layer maps it to a 400 response.
var ErrInvalidQuantity = errors.New("stock: quantity must be >= 0")
