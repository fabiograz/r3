package lookups

import (
	"fmt"
	"r3/db"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgx/v4"
)

// constants
var PkName = "id"

func GetModuleNameById_tx(tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT name
		FROM app.module
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get module name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetModuleDetailsByRelationId_tx(tx pgx.Tx, id uuid.UUID) (uuid.UUID, string, error) {
	var moduleId uuid.UUID
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT id, name
		FROM app.module
		WHERE id = (
			SELECT module_id
			FROM app.relation
			WHERE id = $1
		)
	`, id).Scan(&moduleId, &name); err != nil {
		return moduleId, "", fmt.Errorf("failed to get module details by relation ID %s: %w", id, err)
	}
	return moduleId, name, nil
}

// returns module and relation names for given relation ID
func GetRelationNamesById_tx(tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT r.name, m.name
		FROM app.relation AS r
		INNER JOIN app.module AS m ON m.id = r.module_id
		WHERE r.id = $1
	`, id).Scan(&name, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get relation/module names by relation ID %s: %w", id, err)
	}
	return moduleName, name, nil
}
func GetRelationNameById_tx(tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT name
		FROM app.relation
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get relation name by ID %s: %w", id, err)
	}
	return name, nil
}

// returns module, relation and attribute names as well as attribute content for given attribute ID
func GetAttributeDetailsById_tx(tx pgx.Tx, id uuid.UUID) (string,
	string, string, string, error) {

	var moduleName, relationName, name, content string
	if err := tx.QueryRow(db.Ctx, `
		SELECT m.name, r.name, a.name, a.content
		FROM app.attribute AS a
		INNER JOIN app.relation AS r ON r.id = a.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE a.id = $1
	`, id).Scan(&moduleName, &relationName, &name, &content); err != nil {
		return "", "", "", "", fmt.Errorf("failed to get attribute details by ID %s: %w", id, err)
	}
	return moduleName, relationName, name, content, nil
}
func GetAttributeNameById_tx(tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT name
		FROM app.attribute
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get attribute name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetAttributeContentByRelationPk_tx(tx pgx.Tx, relationId uuid.UUID) (string, error) {
	var content string
	if err := tx.QueryRow(db.Ctx, `
		SELECT content
		FROM app.attribute
		WHERE relation_id = $1
		AND name = $2
	`, relationId, PkName).Scan(&content); err != nil {
		return "", fmt.Errorf("failed to get content name of PK attribute from relation ID %s: %w",
			relationId, err)
	}
	return content, nil
}

func GetFormNameById_tx(tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT name
		FROM app.form
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get form name by ID %s: %w", id, err)
	}
	return name, nil
}

// returns module and PG function names+arguments for given PG function ID
func GetPgFunctionNameById_tx(tx pgx.Tx, id uuid.UUID) (string, error) {
	var name string
	if err := tx.QueryRow(db.Ctx, `
		SELECT name
		FROM app.pg_function
		WHERE id = $1
	`, id).Scan(&name); err != nil {
		return "", fmt.Errorf("failed to get PG function name by ID %s: %w", id, err)
	}
	return name, nil
}
func GetPgFunctionDetailsById_tx(tx pgx.Tx, id uuid.UUID) (string, string, string, error) {
	var moduleName, name, args string
	if err := tx.QueryRow(db.Ctx, `
		SELECT f.name, f.code_args, m.name
		FROM app.pg_function AS f
		INNER JOIN app.module AS m ON m.id = f.module_id
		WHERE f.id = $1
	`, id).Scan(&name, &args, &moduleName); err != nil {
		return "", "", "", fmt.Errorf("failed to get PG function details by ID %s: %w", id, err)
	}
	return moduleName, name, args, nil
}

// returns module and relation names for given PG trigger ID
func GetPgTriggerNamesById_tx(tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, relationName string
	if err := tx.QueryRow(db.Ctx, `
		SELECT r.name, m.name
		FROM app.pg_trigger AS t
		INNER JOIN app.relation AS r ON r.id = t.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE t.id = $1
	`, id).Scan(&relationName, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get PG trigger/relation names by PG trigger ID %s: %w", id, err)
	}
	return moduleName, relationName, nil
}

// returns module and relation names for given PG index ID
func GetPgIndexNamesById_tx(tx pgx.Tx, id uuid.UUID) (string, string, error) {
	var moduleName, relationName string
	if err := tx.QueryRow(db.Ctx, `
		SELECT r.name, m.name
		FROM app.pg_index AS i
		INNER JOIN app.relation AS r ON r.id = i.relation_id
		INNER JOIN app.module   AS m ON m.id = r.module_id
		WHERE i.id = $1
	`, id).Scan(&relationName, &moduleName); err != nil {
		return "", "", fmt.Errorf("failed to get relation/modules names by PG index ID %s: %w", id, err)
	}
	return moduleName, relationName, nil
}

func GetPKConstraintName(relationId uuid.UUID) string {
	return fmt.Sprintf("pk_%s", relationId.String())
}
func GetFKConstraintName(attributeId uuid.UUID) string {
	return fmt.Sprintf("fk_%s", attributeId.String())
}
func GetSequenceName(relationId uuid.UUID) string {
	return fmt.Sprintf("sq_%s", relationId.String())
}
func GetPgIndexName(pgIndexId uuid.UUID) string {
	return fmt.Sprintf("ind_%s", pgIndexId.String())
}

// attribute checks
func IsContentFiles(content string) bool {
	return content == "files"
}
func IsContentNumeric(content string) bool {
	return content == "numeric"
}
func IsContentRelationship(content string) bool {
	return content == "1:1" || content == "n:1"
}
func IsContentText(content string) bool {
	return content == "varchar" || content == "text"
}
