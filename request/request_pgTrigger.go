package request

import (
	"encoding/json"
	"r3/schema/pgTrigger"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

func PgTriggerDel_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req struct {
		Id uuid.UUID `json:"id"`
	}

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := pgTrigger.Del_tx(tx, req.Id); err != nil {
		return nil, err
	}
	return nil, nil
}

func PgTriggerSet_tx(tx pgx.Tx, reqJson json.RawMessage) (interface{}, error) {

	var req types.PgTrigger

	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}
	if err := pgTrigger.Set_tx(tx, req.PgFunctionId, req.Id, req.RelationId,
		req.OnInsert, req.OnUpdate, req.OnDelete, req.IsConstraint,
		req.IsDeferrable, req.IsDeferred, req.PerRow, req.Fires,
		req.CodeCondition); err != nil {

		return nil, err
	}
	return nil, nil
}
