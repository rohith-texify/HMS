package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type contextKey string

const txKey contextKey = "database_transaction"

func WithTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, txKey, tx)
}

func TxFromContext(ctx context.Context) (pgx.Tx, bool) {
	tx, ok := ctx.Value(txKey).(pgx.Tx)
	return tx, ok
}
