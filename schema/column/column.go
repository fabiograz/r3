package column

import (
	"r3/db"
	"r3/schema"
	"r3/schema/caption"
	"r3/schema/query"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

func Del_tx(tx pgx.Tx, id uuid.UUID) error {
	_, err := tx.Exec(db.Ctx, `DELETE FROM app.column WHERE id = $1`, id)
	return err
}

func Get(fieldId uuid.UUID) ([]types.Column, error) {

	columns := make([]types.Column, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		SELECT id, attribute_id, index, batch, basis, length, wrap, display,
			group_by, aggregator, distincted, sub_query, on_mobile
		FROM app.column
		WHERE field_id = $1
		ORDER BY position ASC
	`, fieldId)
	if err != nil {
		return columns, err
	}

	for rows.Next() {
		var c types.Column
		if err := rows.Scan(&c.Id, &c.AttributeId, &c.Index, &c.Batch, &c.Basis,
			&c.Length, &c.Wrap, &c.Display, &c.GroupBy, &c.Aggregator,
			&c.Distincted, &c.SubQuery, &c.OnMobile); err != nil {

			return columns, err
		}
		columns = append(columns, c)
	}
	rows.Close()

	for i, c := range columns {
		if c.SubQuery {
			c.Query, err = query.Get("column", c.Id, 0, 0)
			if err != nil {
				return columns, err
			}
		} else {
			c.Query.RelationId = pgtype.UUID{Status: pgtype.Null}
		}

		// get captions
		c.Captions, err = caption.Get("column", c.Id, []string{"columnTitle"})
		if err != nil {
			return columns, err
		}
		columns[i] = c
	}
	return columns, nil
}

func Set_tx(tx pgx.Tx, fieldId uuid.UUID, columns []types.Column) error {

	for position, c := range columns {

		known, err := schema.CheckCreateId_tx(tx, &c.Id, "column", "id")
		if err != nil {
			return err
		}

		if known {
			if _, err := tx.Exec(db.Ctx, `
				UPDATE app.column
				SET attribute_id = $1, index = $2, position = $3, batch = $4,
					basis = $5, length = $6, wrap = $7, display = $8,
					group_by = $9, aggregator = $10, distincted = $11,
					sub_query = $12, on_mobile = $13
				WHERE id = $14
			`, c.AttributeId, c.Index, position, c.Batch, c.Basis, c.Length,
				c.Wrap, c.Display, c.GroupBy, c.Aggregator, c.Distincted,
				c.SubQuery, c.OnMobile, c.Id); err != nil {

				return err
			}
		} else {
			if _, err := tx.Exec(db.Ctx, `
				INSERT INTO app.column (
					id, field_id, attribute_id, index, position, batch, basis,
					length, wrap, display, group_by, aggregator, distincted,
					on_mobile, sub_query
				)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
			`, c.Id, fieldId, c.AttributeId, c.Index, position, c.Batch,
				c.Basis, c.Length, c.Wrap, c.Display, c.GroupBy, c.Aggregator,
				c.Distincted, c.OnMobile, c.SubQuery); err != nil {

				return err
			}
		}

		if c.SubQuery {
			if err := query.Set_tx(tx, "column", c.Id, 0, 0, c.Query); err != nil {
				return err
			}
		}

		// set captions
		if err := caption.Set_tx(tx, c.Id, c.Captions); err != nil {
			return err
		}
	}
	return nil
}
