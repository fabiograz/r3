package data

import (
	"context"
	"encoding/json"
	"errors"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/tools"
	"r3/types"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

// delete data change logs according to retention settings
func DelLogsBackground() error {

	for _, r := range cache.RelationIdMap {

		// delete logs for relations with no retention
		if r.RetentionCount.Status != pgtype.Present && r.RetentionDays.Status != pgtype.Present {

			if _, err := db.Pool.Exec(db.Ctx, `
				DELETE FROM instance.data_log
				WHERE id IN (
					SELECT data_log_id
					FROM instance.data_log_value
					WHERE attribute_id IN (
						SELECT id
						FROM app.attribute
						WHERE relation_id = $1
					)
				)
			`, r.Id); err != nil {
				return err
			}
			continue
		}

		// delete logs according to retention settings
		now := tools.GetTimeUnix()

		if _, err := db.Pool.Exec(db.Ctx, `
			DELETE FROM instance.data_log AS p
			WHERE p.relation_id = $1
			
			-- exclude retained change logs per record by count
			AND p.id NOT IN (
				SELECT id
				FROM instance.data_log
				WHERE relation_id = p.relation_id
				AND record_id_wofk = p.record_id_wofk
				ORDER BY date_change DESC
				LIMIT $2
			)
			
			-- exclude retained change logs by age
			AND date_change < $3
		`, r.Id, r.RetentionCount.Int, now-(int64(r.RetentionDays.Int)*86400)); err != nil {
			return err
		}
	}
	return nil
}

// get data change logs for specified record and attributes
func GetLogs_tx(ctx context.Context, tx pgx.Tx, recordId int64,
	attributeIds []uuid.UUID, loginId int64) ([]types.DataLog, error) {

	logs := make([]types.DataLog, 0)

	// check for authorized access, READ(1) for GET
	for _, attributeId := range attributeIds {
		if !authorizedAttribute(loginId, attributeId, 1) {
			return logs, errors.New(handler.ErrUnauthorized)
		}
	}

	rows, err := tx.Query(ctx, `
		SELECT d.id, d.relation_id, l.name, d.date_change
		FROM instance.data_log as d
		LEFT JOIN instance.login AS l ON l.id = d.login_id_wofk
		WHERE d.record_id_wofk = $1
		AND d.id IN (
			SELECT data_log_id
			FROM instance.data_log_value
			WHERE attribute_id = ANY($2)
		)
		ORDER BY d.date_change DESC
	`, recordId, attributeIds)
	if err != nil {
		return logs, err
	}

	for rows.Next() {
		var l types.DataLog
		var name pgtype.Varchar

		if err := rows.Scan(&l.Id, &l.RelationId, &name, &l.DateChange); err != nil {
			return logs, err
		}
		l.RecordId = recordId
		l.LoginName = name.String
		logs = append(logs, l)
	}
	rows.Close()

	for i, log := range logs {
		log.Attributes, err = getLogValues_tx(ctx, tx, log.Id, attributeIds)
		if err != nil {
			return logs, err
		}
		logs[i] = log
	}
	return logs, nil
}
func getLogValues_tx(ctx context.Context, tx pgx.Tx, logId uuid.UUID,
	attributeIds []uuid.UUID) ([]types.DataSetAttribute, error) {

	attributes := make([]types.DataSetAttribute, 0)

	rows, err := tx.Query(ctx, `
		SELECT attribute_id, attribute_id_nm, outside_in, value
		FROM instance.data_log_value
		WHERE data_log_id = $1
		AND attribute_id = ANY($2)
	`, logId, attributeIds)
	if err != nil {
		return attributes, err
	}
	defer rows.Close()

	for rows.Next() {
		var a types.DataSetAttribute

		if err := rows.Scan(&a.AttributeId, &a.AttributeIdNm, &a.OutsideIn, &a.Value); err != nil {
			return attributes, err
		}
		attributes = append(attributes, a)
	}
	return attributes, nil
}

// set data change log for specific record that was either created or updated
func setLog_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID, attributes []types.DataSetAttribute,
	wasCreated bool, oldData types.DataGetResult, recordId int64, loginId int64) error {

	// new record, apply logs for record and its attribute values
	// even with no attribute values, record creation must be logged
	if wasCreated {
		logId, err := setLogRecord_tx(ctx, tx, relationId, loginId, recordId)
		if err != nil {
			return err
		}
		for _, attribute := range attributes {
			if attribute.Value == nil {
				// ignore null values for new record
				continue
			}
			if err := setLogValue_tx(ctx, tx, logId, attribute); err != nil {
				return err
			}
		}
		return nil
	}

	// existing record, apply log if any attribute values changed

	// compare old to new attribute values
	attributesChangedPos := make([]int, 0)
	for i, value := range oldData.Values {

		// both values are nil, no change
		if value == nil && attributes[i].Value == nil {
			continue
		}

		// only one value is nil, definite change
		if value == nil || attributes[i].Value == nil {
			attributesChangedPos = append(attributesChangedPos, i)
			continue
		}

		// compare JSON representations of old and new values
		jsonOld, err := json.Marshal(value)
		if err != nil {
			return err
		}
		jsonNew, err := json.Marshal(attributes[i].Value)
		if err != nil {
			return err
		}
		if string(jsonOld) != string(jsonNew) {
			attributesChangedPos = append(attributesChangedPos, i)
		}
	}

	if len(attributesChangedPos) == 0 {
		// return if no attribute values changed for existing record
		return nil
	}

	logId, err := setLogRecord_tx(ctx, tx, relationId, loginId, recordId)
	if err != nil {
		return err
	}
	for i, attribute := range attributes {

		if tools.IntInSlice(i, attributesChangedPos) {
			// log value even if null, as a change to null is still a change
			if err := setLogValue_tx(ctx, tx, logId, attribute); err != nil {
				return err
			}
		}
	}
	return nil
}
func setLogRecord_tx(ctx context.Context, tx pgx.Tx, relationId uuid.UUID,
	loginId int64, recordId int64) (uuid.UUID, error) {

	logId, err := uuid.NewV4()
	if err != nil {
		return logId, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.data_log (id, relation_id,
			login_id_wofk, record_id_wofk, date_change)
		VALUES ($1,$2,$3,$4,$5)
	`, logId, relationId, loginId, recordId, tools.GetTimeUnix()); err != nil {
		return logId, err
	}
	return logId, nil
}
func setLogValue_tx(ctx context.Context, tx pgx.Tx, logId uuid.UUID, atr types.DataSetAttribute) error {

	valueJson, err := json.Marshal(atr.Value)
	if err != nil {
		return err
	}

	valueInput := pgtype.Varchar{
		String: string(valueJson),
		Status: pgtype.Present,
	}

	if string(valueJson) == "null" {
		valueInput.Status = pgtype.Null
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO instance.data_log_value
			(data_log_id, attribute_id, attribute_id_nm, outside_in, value)
		VALUES ($1,$2,$3,$4,$5)
	`, logId, atr.AttributeId, atr.AttributeIdNm, atr.OutsideIn, valueInput); err != nil {
		return err
	}
	return nil
}
