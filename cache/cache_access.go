package cache

import (
	"errors"
	"r3/db"
	"r3/types"
	"sync"

	"github.com/gofrs/uuid"
)

var (
	access_mx        sync.Mutex
	loginIdMapAccess = make(map[int64]types.LoginAccess) // access permissions by login ID
)

// get effective access for specified login
func GetAccessById(loginId int64) (types.LoginAccess, error) {

	if loginId == 0 {
		return types.LoginAccess{}, errors.New("invalid login ID 0")
	}

	access_mx.Lock()
	defer access_mx.Unlock()

	_, exists := loginIdMapAccess[loginId]
	if !exists {
		if err := load(loginId, false); err != nil {
			return types.LoginAccess{}, err
		}
	}
	return loginIdMapAccess[loginId], nil
}

// renew permissions for all cached logins
func RenewAccessAll() error {
	for loginId, _ := range loginIdMapAccess {
		if err := RenewAccessById(loginId); err != nil {
			return err
		}
	}
	return nil
}

// renew permissions for one login
func RenewAccessById(loginId int64) error {

	access_mx.Lock()
	defer access_mx.Unlock()

	return load(loginId, true)
}

// update clients
func KickLoginById(loginId int64) { // kick single login
	ClientEvent_handlerChan <- types.ClientEvent{LoginId: loginId, Kick: true}
}
func KickNonAdmins() { // kick all non-admins
	ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, KickNonAdmin: true}
}
func ChangedBuilderMode(modeActive bool) {
	if modeActive {
		ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, BuilderOn: true}
	} else {
		ClientEvent_handlerChan <- types.ClientEvent{LoginId: 0, BuilderOff: true}
	}
}

// load access permissions for login ID into cache
func load(loginId int64, renewal bool) error {

	roleIds, err := loadRoleIds(loginId)
	if err != nil {
		return err
	}

	loginIdMapAccess[loginId] = types.LoginAccess{
		RoleIds:   roleIds,
		Relation:  make(map[uuid.UUID]int),
		Attribute: make(map[uuid.UUID]int),
		Menu:      make(map[uuid.UUID]int),
	}

	for _, roleId := range roleIds {

		role, _ := RoleIdMap[roleId]

		// because access rights work cumulatively, apply highest right only
		for id, access := range role.AccessRelations {
			if _, exists := loginIdMapAccess[loginId].Relation[id]; !exists ||
				loginIdMapAccess[loginId].Relation[id] < access {

				loginIdMapAccess[loginId].Relation[id] = access
			}
		}
		for id, access := range role.AccessAttributes {
			if _, exists := loginIdMapAccess[loginId].Attribute[id]; !exists ||
				loginIdMapAccess[loginId].Attribute[id] < access {

				loginIdMapAccess[loginId].Attribute[id] = access
			}
		}
		for id, access := range role.AccessMenus {
			if _, exists := loginIdMapAccess[loginId].Menu[id]; !exists ||
				loginIdMapAccess[loginId].Menu[id] < access {

				loginIdMapAccess[loginId].Menu[id] = access
			}
		}
	}

	if renewal {
		ClientEvent_handlerChan <- types.ClientEvent{LoginId: loginId, Renew: true}
	}
	return nil
}

func loadRoleIds(loginId int64) ([]uuid.UUID, error) {

	roleIds := make([]uuid.UUID, 0)

	rows, err := db.Pool.Query(db.Ctx, `
		-- get nested children of assigned roles
		WITH RECURSIVE child_ids AS (
			SELECT role_id_child
			FROM app.role_child
			WHERE role_id IN (
				SELECT role_id
				FROM instance.login_role
				WHERE login_id = $1
			)
			UNION
				SELECT c.role_id_child
				FROM app.role_child AS c
				INNER JOIN child_ids AS r ON c.role_id = r.role_id_child
		)
		SELECT *
		FROM child_ids
		
		UNION
		
		-- get assigned roles
		SELECT role_id
		FROM instance.login_role
		WHERE login_id = $2
		
		UNION
		
		-- get 'everyone' roles from all modules
		SELECT id
		FROM app.role
		WHERE name = 'everyone'
	`, loginId, loginId)
	if err != nil {
		return roleIds, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return roleIds, err
		}
		roleIds = append(roleIds, id)
	}
	return roleIds, nil
}
